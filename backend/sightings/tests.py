from datetime import timedelta
from io import BytesIO
from tempfile import TemporaryDirectory
from uuid import uuid4

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.services import create_token_pair
from reports.models import LostCatReport, LostCatReportTimelineEvent

from .models import Sighting, SightingPhoto


class SightingCreateApiTests(APITestCase):
    def setUp(self):
        self.media_root = TemporaryDirectory()
        self.addCleanup(self.media_root.cleanup)
        media_override = override_settings(MEDIA_ROOT=self.media_root.name)
        media_override.enable()
        self.addCleanup(media_override.disable)

        self.owner = get_user_model().objects.create_user(
            email='owner@example.com',
            password='StrongPass123!',
            is_email_verified=True,
        )
        self.helper = get_user_model().objects.create_user(
            email='helper@example.com',
            password='StrongPass123!',
            is_email_verified=True,
        )

    def _authenticate(self, user):
        tokens = create_token_pair(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    def _create_report(self, **overrides):
        defaults = {
            'owner': self.owner,
            'cat_name': 'Luna',
            'coat_color': 'Black',
            'description': 'Likely hiding near gardens.',
            'last_seen_address': '12 Private Home Street',
            'last_seen_landmark': 'Near the playground',
            'contact_name': 'Marta Owner',
            'contact_phone': '+48 600 111 222',
            'contact_email': 'owner@example.com',
            'notify_email': True,
        }
        defaults.update(overrides)
        return LostCatReport.objects.create(**defaults)

    def _url(self, report):
        return reverse('public-report-sighting-create', args=[report.public_id])

    def _payload(self, **overrides):
        payload = {
            'seen_at': timezone.now().isoformat(),
            'location_description': 'Behind the bakery',
            'latitude': 52.2297,
            'longitude': 21.0122,
            'confidence': Sighting.Confidence.HIGH,
            'notes': 'The cat was walking slowly toward the courtyard.',
        }
        payload.update(overrides)
        return payload

    def _image_upload(
        self,
        *,
        filename='sighting.jpg',
        content_type='image/jpeg',
        image_format='JPEG',
    ):
        image_bytes = BytesIO()
        image = Image.new('RGB', (4, 4), color='white')
        image.save(image_bytes, format=image_format)
        image.close()
        return SimpleUploadedFile(
            filename,
            image_bytes.getvalue(),
            content_type=content_type,
        )

    def test_sighting_submission_requires_authentication(self):
        report = self._create_report()

        response = self.client.post(self._url(report), self._payload(), format='json')

        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )
        self.assertFalse(Sighting.objects.exists())

    def test_authenticated_user_can_submit_sighting_for_public_report(self):
        report = self._create_report(status=LostCatReport.Status.MISSING)
        self._authenticate(self.helper)

        response = self.client.post(self._url(report), self._payload(), format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['report_public_id'], str(report.public_id))
        self.assertEqual(response.data['confidence'], Sighting.Confidence.HIGH)
        self.assertEqual(response.data['location_description'], 'Behind the bakery')
        self.assertEqual(response.data['verification_status'], Sighting.VerificationStatus.PENDING)
        self.assertNotIn('submitted_by', response.data)
        self.assertNotIn('owner', response.data)
        self.assertNotIn('contact_email', response.data)
        self.assertEqual(response['Cache-Control'], 'no-store')

        sighting = Sighting.objects.get()
        self.assertEqual(sighting.report, report)
        self.assertEqual(sighting.submitted_by, self.helper)
        self.assertEqual(sighting.latitude, 52.2297)
        self.assertEqual(sighting.longitude, 21.0122)

        timeline_event = LostCatReportTimelineEvent.objects.get(report=report)
        self.assertEqual(
            timeline_event.event_type,
            LostCatReportTimelineEvent.EventType.SIGHTING_CREATED,
        )
        self.assertEqual(timeline_event.actor, self.helper)
        self.assertEqual(timeline_event.location_summary, 'Behind the bakery')

    def test_authenticated_user_can_submit_sighting_with_photo(self):
        report = self._create_report(status=LostCatReport.Status.MISSING)
        self._authenticate(self.helper)
        payload = self._payload(photo=self._image_upload())

        response = self.client.post(self._url(report), payload, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        sighting = Sighting.objects.get()
        photo = SightingPhoto.objects.get(sighting=sighting)
        self.assertEqual(photo.uploaded_by, self.helper)
        self.assertTrue(photo.image.name.startswith('sighting-photos/'))
        self.assertNotIn(str(sighting.id), photo.image.name)
        self.assertNotIn(str(report.id), photo.image.name)
        self.assertEqual(len(response.data['photos']), 1)
        self.assertEqual(response.data['photos'][0]['id'], str(photo.id))
        self.assertEqual(
            response.data['photos'][0]['url'],
            f'http://testserver{photo.image.url}',
        )
        self.assertNotIn('image', response.data['photos'][0])
        self.assertNotIn('path', response.data['photos'][0])
        self.assertNotIn('uploaded_by', response.data['photos'][0])

    def test_sighting_photo_rejects_unsupported_type(self):
        report = self._create_report()
        self._authenticate(self.helper)
        payload = self._payload(
            photo=self._image_upload(
                filename='sighting.gif',
                content_type='image/gif',
                image_format='GIF',
            )
        )

        response = self.client.post(self._url(report), payload, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('photo', response.data)
        self.assertFalse(Sighting.objects.exists())
        self.assertFalse(SightingPhoto.objects.exists())

    def test_sighting_photo_rejects_oversized_file(self):
        report = self._create_report()
        self._authenticate(self.helper)
        payload = self._payload(photo=self._image_upload())

        with override_settings(SIGHTING_PHOTO_MAX_SIZE_BYTES=10):
            response = self.client.post(self._url(report), payload, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('photo', response.data)
        self.assertFalse(Sighting.objects.exists())
        self.assertFalse(SightingPhoto.objects.exists())

    def test_sighting_submission_rejects_invalid_location(self):
        report = self._create_report()
        self._authenticate(self.helper)

        response = self.client.post(
            self._url(report),
            self._payload(latitude=91),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('latitude', response.data)
        self.assertFalse(Sighting.objects.exists())

    def test_sighting_submission_rejects_future_seen_at(self):
        report = self._create_report()
        self._authenticate(self.helper)

        response = self.client.post(
            self._url(report),
            self._payload(
                seen_at=(timezone.now() + timedelta(hours=1)).isoformat(),
            ),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('seen_at', response.data)
        self.assertFalse(Sighting.objects.exists())

    def test_sighting_submission_rejects_resolved_report(self):
        report = self._create_report(
            status=LostCatReport.Status.FOUND,
            resolved_at=timezone.now(),
        )
        self._authenticate(self.helper)

        response = self.client.post(self._url(report), self._payload(), format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('report', response.data)
        self.assertFalse(Sighting.objects.exists())

    def test_sighting_submission_hides_moderated_report(self):
        report = self._create_report(
            moderation_status=LostCatReport.ModerationStatus.HIDDEN,
        )
        self._authenticate(self.helper)

        response = self.client.post(self._url(report), self._payload(), format='json')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(Sighting.objects.exists())

    def test_sighting_submission_returns_404_for_unknown_public_id(self):
        self._authenticate(self.helper)

        response = self.client.post(
            reverse('public-report-sighting-create', args=[uuid4()]),
            self._payload(),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_sighting_is_registered_in_admin(self):
        self.assertTrue(admin.site.is_registered(Sighting))
        self.assertTrue(admin.site.is_registered(SightingPhoto))

# Create your tests here.
