from datetime import timedelta
from io import BytesIO
from tempfile import TemporaryDirectory
from uuid import uuid4

from PIL import Image
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.services import create_token_pair
from reports.models import LostCatReport, LostCatReportTimelineEvent

from .models import Sighting, SightingPhoto, VolunteerSearch
from .services import create_sighting


class SightingCreateApiTests(APITestCase):
    def setUp(self):
        self.media_root = TemporaryDirectory()
        self.addCleanup(self.media_root.cleanup)
        media_override = override_settings(MEDIA_ROOT=self.media_root.name)
        media_override.enable()
        self.addCleanup(media_override.disable)
        cache.clear()

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
        self.staff = get_user_model().objects.create_user(
            email='staff@example.com',
            password='StrongPass123!',
            is_email_verified=True,
            is_staff=True,
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

    def _owner_list_url(self, report):
        return reverse('report-sighting-list', args=[report.id])

    def _verification_url(self, report, sighting):
        return reverse('report-sighting-verification', args=[report.id, sighting.id])

    def _volunteer_search_url(self, report):
        return reverse('public-report-volunteer-search-create', args=[report.public_id])

    def _owner_volunteer_search_list_url(self, report):
        return reverse('report-volunteer-search-list', args=[report.id])

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

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
        FRONTEND_URL='https://app.catsos.example',
    )
    def test_sighting_submission_sends_owner_email_notification_after_commit(self):
        report = self._create_report(
            status=LostCatReport.Status.MISSING,
            notify_email=True,
        )
        self._authenticate(self.helper)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                self._url(report),
                self._payload(notes='Private helper note with helper@example.com'),
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertEqual(email.to, ['owner@example.com'])
        self.assertIn('New sighting for Luna', email.subject)
        self.assertIn('Behind the bakery', email.body)
        self.assertIn(
            f'https://app.catsos.example/reports/{report.public_id}',
            email.body,
        )
        self.assertNotIn('helper@example.com', email.body)
        self.assertNotIn('Private helper note', email.body)

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

    def test_owner_can_list_sightings_including_false_reports(self):
        self.helper.display_name = 'Helpful Neighbor'
        self.helper.save(update_fields=('display_name',))
        report = self._create_report()
        useful_sighting = create_sighting(
            report=report,
            submitted_by=self.helper,
            validated_data=self._payload(),
        )
        false_sighting = create_sighting(
            report=report,
            submitted_by=self.helper,
            validated_data=self._payload(location_description='Wrong courtyard'),
        )
        false_sighting.verification_status = Sighting.VerificationStatus.FALSE
        false_sighting.verified_by = self.owner
        false_sighting.verified_at = timezone.now()
        false_sighting.save(
            update_fields=('verification_status', 'verified_by', 'verified_at'),
        )
        self._authenticate(self.owner)

        response = self.client.get(self._owner_list_url(report))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)
        statuses = {
            item['id']: item['verification_status']
            for item in response.data['results']
        }
        self.assertEqual(statuses[str(useful_sighting.id)], Sighting.VerificationStatus.PENDING)
        self.assertEqual(statuses[str(false_sighting.id)], Sighting.VerificationStatus.FALSE)
        first_sighting = response.data['results'][0]
        self.assertEqual(first_sighting['submitted_by']['display_name'], 'Helpful Neighbor')
        self.assertNotIn('email', first_sighting['submitted_by'])
        self.assertNotIn('contact_email', first_sighting)
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_owner_can_mark_sighting_as_useful(self):
        report = self._create_report()
        sighting = create_sighting(
            report=report,
            submitted_by=self.helper,
            validated_data=self._payload(),
        )
        self._authenticate(self.owner)

        response = self.client.patch(
            self._verification_url(report, sighting),
            {'verification_status': Sighting.VerificationStatus.USEFUL},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['verification_status'], Sighting.VerificationStatus.USEFUL)
        self.assertEqual(response.data['verified_by']['display_name'], 'CatSOS user')
        self.assertIsNotNone(response.data['verified_at'])
        self.assertNotIn('email', response.data['verified_by'])
        sighting.refresh_from_db()
        self.assertEqual(sighting.verification_status, Sighting.VerificationStatus.USEFUL)
        self.assertEqual(sighting.verified_by, self.owner)
        self.assertIsNotNone(sighting.verified_at)

        timeline_event = LostCatReportTimelineEvent.objects.get(
            report=report,
            event_type=LostCatReportTimelineEvent.EventType.SIGHTING_MARKED_USEFUL,
        )
        self.assertEqual(timeline_event.actor, self.owner)
        self.assertEqual(timeline_event.location_summary, 'Behind the bakery')

        public_list_response = self.client.get(reverse('lost-report-public-list'))
        self.assertEqual(public_list_response.status_code, status.HTTP_200_OK)
        latest_sighting = public_list_response.data['results'][0]['latest_sighting']
        self.assertEqual(latest_sighting['location_description'], 'Behind the bakery')
        self.assertEqual(latest_sighting['latitude'], 52.2297)
        self.assertEqual(latest_sighting['longitude'], 21.0122)
        self.assertEqual(latest_sighting['confidence'], Sighting.Confidence.HIGH)
        self.assertNotIn('submitted_by', latest_sighting)
        self.assertNotIn('notes', latest_sighting)

        public_detail_response = self.client.get(
            reverse('lost-report-public-detail', args=[report.public_id])
        )
        self.assertEqual(public_detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            public_detail_response.data['latest_sighting']['location_description'],
            'Behind the bakery',
        )

    def test_owner_can_reset_sighting_verification_to_pending(self):
        report = self._create_report()
        sighting = create_sighting(
            report=report,
            submitted_by=self.helper,
            validated_data=self._payload(),
        )
        sighting.verification_status = Sighting.VerificationStatus.FALSE
        sighting.verified_by = self.owner
        sighting.verified_at = timezone.now()
        sighting.save(
            update_fields=('verification_status', 'verified_by', 'verified_at'),
        )
        self._authenticate(self.owner)

        response = self.client.patch(
            self._verification_url(report, sighting),
            {'verification_status': Sighting.VerificationStatus.PENDING},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['verification_status'], Sighting.VerificationStatus.PENDING)
        self.assertIsNone(response.data['verified_by'])
        self.assertIsNone(response.data['verified_at'])
        sighting.refresh_from_db()
        self.assertIsNone(sighting.verified_by)
        self.assertIsNone(sighting.verified_at)

    def test_staff_can_verify_sighting_for_any_report(self):
        report = self._create_report()
        sighting = create_sighting(
            report=report,
            submitted_by=self.helper,
            validated_data=self._payload(),
        )
        self._authenticate(self.staff)

        response = self.client.patch(
            self._verification_url(report, sighting),
            {'verification_status': Sighting.VerificationStatus.FALSE},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        sighting.refresh_from_db()
        self.assertEqual(sighting.verification_status, Sighting.VerificationStatus.FALSE)
        self.assertEqual(sighting.verified_by, self.staff)
        self.assertTrue(
            LostCatReportTimelineEvent.objects.filter(
                report=report,
                event_type=LostCatReportTimelineEvent.EventType.SIGHTING_MARKED_FALSE,
                actor=self.staff,
            ).exists()
        )

        public_list_response = self.client.get(reverse('lost-report-public-list'))
        self.assertEqual(public_list_response.status_code, status.HTTP_200_OK)
        self.assertIsNone(public_list_response.data['results'][0]['latest_sighting'])

    def test_helper_cannot_list_or_verify_report_sightings(self):
        report = self._create_report()
        sighting = create_sighting(
            report=report,
            submitted_by=self.helper,
            validated_data=self._payload(),
        )
        self._authenticate(self.helper)

        list_response = self.client.get(self._owner_list_url(report))
        verify_response = self.client.patch(
            self._verification_url(report, sighting),
            {'verification_status': Sighting.VerificationStatus.USEFUL},
            format='json',
        )

        self.assertEqual(list_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(verify_response.status_code, status.HTTP_404_NOT_FOUND)
        sighting.refresh_from_db()
        self.assertEqual(sighting.verification_status, Sighting.VerificationStatus.PENDING)

    def test_sighting_verification_rejects_invalid_status(self):
        report = self._create_report()
        sighting = create_sighting(
            report=report,
            submitted_by=self.helper,
            validated_data=self._payload(),
        )
        self._authenticate(self.owner)

        response = self.client.patch(
            self._verification_url(report, sighting),
            {'verification_status': 'MAYBE'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('verification_status', response.data)
        sighting.refresh_from_db()
        self.assertEqual(sighting.verification_status, Sighting.VerificationStatus.PENDING)

    def test_volunteer_search_requires_authentication(self):
        report = self._create_report()

        response = self.client.post(
            self._volunteer_search_url(report),
            {},
            format='json',
        )

        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )
        self.assertFalse(VolunteerSearch.objects.exists())

    def test_authenticated_user_can_mark_searching_nearby(self):
        self.helper.display_name = 'Helpful Neighbor'
        self.helper.save(update_fields=('display_name',))
        report = self._create_report(status=LostCatReport.Status.MISSING)
        self._authenticate(self.helper)

        response = self.client.post(
            self._volunteer_search_url(report),
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['report_public_id'], str(report.public_id))
        self.assertEqual(response.data['volunteer']['display_name'], 'Helpful Neighbor')
        self.assertEqual(response.data['volunteer']['avatar_fallback'], 'HN')
        self.assertNotIn('email', response.data['volunteer'])
        self.assertNotIn('contact_email', response.data)
        self.assertEqual(response['Cache-Control'], 'no-store')

        volunteer_search = VolunteerSearch.objects.get(report=report)
        self.assertEqual(volunteer_search.volunteer, self.helper)
        timeline_event = LostCatReportTimelineEvent.objects.get(report=report)
        self.assertEqual(
            timeline_event.event_type,
            LostCatReportTimelineEvent.EventType.VOLUNTEER_SEARCH_STARTED,
        )
        self.assertEqual(timeline_event.actor, self.helper)
        self.assertEqual(timeline_event.location_summary, 'Near the playground')

    def test_volunteer_search_is_idempotent_for_same_report_and_user(self):
        report = self._create_report(status=LostCatReport.Status.MISSING)
        self._authenticate(self.helper)

        first_response = self.client.post(
            self._volunteer_search_url(report),
            {},
            format='json',
        )
        second_response = self.client.post(
            self._volunteer_search_url(report),
            {},
            format='json',
        )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(VolunteerSearch.objects.filter(report=report).count(), 1)
        self.assertEqual(
            LostCatReportTimelineEvent.objects.filter(
                report=report,
                event_type=LostCatReportTimelineEvent.EventType.VOLUNTEER_SEARCH_STARTED,
            ).count(),
            1,
        )

    def test_volunteer_search_rejects_hidden_and_resolved_reports(self):
        hidden_report = self._create_report(
            moderation_status=LostCatReport.ModerationStatus.HIDDEN,
        )
        resolved_report = self._create_report(
            status=LostCatReport.Status.FOUND,
            resolved_at=timezone.now(),
        )
        self._authenticate(self.helper)

        hidden_response = self.client.post(
            self._volunteer_search_url(hidden_report),
            {},
            format='json',
        )
        resolved_response = self.client.post(
            self._volunteer_search_url(resolved_report),
            {},
            format='json',
        )

        self.assertEqual(hidden_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(resolved_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('report', resolved_response.data)
        self.assertFalse(VolunteerSearch.objects.exists())

    def test_owner_and_staff_can_list_volunteer_searches(self):
        self.helper.display_name = 'Helpful Neighbor'
        self.helper.save(update_fields=('display_name',))
        report = self._create_report(status=LostCatReport.Status.MISSING)
        VolunteerSearch.objects.create(report=report, volunteer=self.helper)

        self._authenticate(self.owner)
        owner_response = self.client.get(self._owner_volunteer_search_list_url(report))
        self._authenticate(self.staff)
        staff_response = self.client.get(self._owner_volunteer_search_list_url(report))

        self.assertEqual(owner_response.status_code, status.HTTP_200_OK)
        self.assertEqual(owner_response.data['count'], 1)
        volunteer_search = owner_response.data['results'][0]
        self.assertEqual(
            volunteer_search['volunteer']['display_name'],
            'Helpful Neighbor',
        )
        self.assertNotIn('email', volunteer_search['volunteer'])
        self.assertNotIn('contact_email', volunteer_search)
        self.assertEqual(owner_response['Cache-Control'], 'no-store')

        self.assertEqual(staff_response.status_code, status.HTTP_200_OK)
        self.assertEqual(staff_response.data['count'], 1)

    def test_other_helper_cannot_list_report_volunteer_searches(self):
        report = self._create_report(status=LostCatReport.Status.MISSING)
        VolunteerSearch.objects.create(report=report, volunteer=self.helper)
        self._authenticate(self.helper)

        response = self.client.get(self._owner_volunteer_search_list_url(report))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_sighting_is_registered_in_admin(self):
        self.assertTrue(admin.site.is_registered(Sighting))
        self.assertTrue(admin.site.is_registered(SightingPhoto))
        self.assertTrue(admin.site.is_registered(VolunteerSearch))
