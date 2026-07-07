from datetime import timedelta
from io import BytesIO
from tempfile import TemporaryDirectory
from uuid import uuid4

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.services import create_token_pair
from sightings.models import Sighting
from sightings.services import create_sighting

from .models import LostCatReport, LostCatReportPhoto, LostCatReportTimelineEvent


class LostCatReportCreateApiTests(APITestCase):
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
        self.other_user = get_user_model().objects.create_user(
            email='other@example.com',
            password='StrongPass123!',
            is_email_verified=True,
        )

    def _authenticate(self, user):
        tokens = create_token_pair(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    def _payload(self, **overrides):
        payload = {
            'cat_name': 'Luna',
            'age_years': 4,
            'breed': 'Domestic shorthair',
            'coat_color': 'Black with a white chest spot',
            'eye_color': 'Green',
            'gender': LostCatReport.Gender.FEMALE,
            'collar_description': 'Red reflective collar with bell',
            'has_microchip': True,
            'chip_number': '985112003456789',
            'personality': 'Shy with strangers, responds to treats.',
            'description': 'Indoor cat, likely hiding close to home.',
            'disappeared_at': timezone.now().isoformat(),
            'last_seen_address': '12 Maple Street',
            'last_seen_landmark': 'Near the playground',
            'last_seen_lat': 52.2297,
            'last_seen_lng': 21.0122,
            'reward_amount': '100.00',
            'reward_note': 'Reward for confirmed recovery.',
            'contact_name': 'Marta Owner',
            'contact_phone': '+48 600 111 222',
            'contact_email': 'owner@example.com',
            'contact_visibility': LostCatReport.ContactVisibility.APP_ONLY,
            'notify_push': True,
            'notify_sms': True,
            'notify_email': False,
        }
        payload.update(overrides)
        return payload

    def _image_upload(
        self,
        *,
        filename='luna.jpg',
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

    def _create_report(self, owner, **overrides):
        defaults = {
            'cat_name': 'Milo',
            'coat_color': 'Ginger',
            'description': 'Friendly outdoor cat.',
            'last_seen_address': '4 Oak Street',
            'contact_name': 'Milo Owner',
            'contact_phone': '+48 600 000 000',
            'contact_email': 'milo@example.com',
        }
        defaults.update(overrides)
        return LostCatReport.objects.create(owner=owner, **defaults)

    def _detail_url(self, report):
        return reverse('lost-report-detail', args=[report.id])

    def _status_url(self, report):
        return reverse('lost-report-status', args=[report.id])

    def _timeline_url(self, report):
        return reverse('lost-report-timeline', args=[report.id])

    def _similar_url(self, report):
        return reverse('lost-report-similar', args=[report.id])

    def _photos_url(self, report):
        return reverse('lost-report-photo-list', args=[report.id])

    def _photo_main_url(self, report, photo):
        return reverse('lost-report-photo-main', args=[report.id, photo.id])

    def _photo_detail_url(self, report, photo):
        return reverse('lost-report-photo-detail', args=[report.id, photo.id])

    def _public_url(self, report):
        return reverse('lost-report-public-detail', args=[report.public_id])

    def _public_list_url(self):
        return reverse('lost-report-public-list')

    def test_create_report_requires_authentication(self):
        response = self.client.post(
            reverse('lost-report-list'),
            self._payload(),
            format='json',
        )

        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )
        self.assertFalse(LostCatReport.objects.exists())

    def test_list_reports_requires_authentication(self):
        response = self.client.get(reverse('lost-report-list'))

        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )

    def test_authenticated_owner_can_create_detailed_lost_cat_report(self):
        self._authenticate(self.owner)

        response = self.client.post(
            reverse('lost-report-list'),
            self._payload(),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('public_id', response.data)
        self.assertEqual(response.data['cat_name'], 'Luna')
        self.assertEqual(response.data['status'], LostCatReport.Status.MISSING)
        self.assertEqual(response.data['coat_color'], 'Black with a white chest spot')
        self.assertEqual(response.data['contact_visibility'], LostCatReport.ContactVisibility.APP_ONLY)
        self.assertNotIn('owner', response.data)
        self.assertNotIn('moderation_notes', response.data)
        self.assertNotIn('moderation_status', response.data)
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertEqual(response['Pragma'], 'no-cache')

        report = LostCatReport.objects.get()
        self.assertEqual(report.owner, self.owner)
        self.assertEqual(report.cat_name, 'Luna')
        self.assertEqual(report.status, LostCatReport.Status.MISSING)
        self.assertEqual(report.reward_amount, 100)

        timeline_event = LostCatReportTimelineEvent.objects.get(report=report)
        self.assertEqual(
            timeline_event.event_type,
            LostCatReportTimelineEvent.EventType.REPORT_CREATED,
        )
        self.assertEqual(timeline_event.actor, self.owner)
        self.assertEqual(timeline_event.location_summary, 'Near the playground')

    def test_authenticated_owner_can_create_report_with_main_photo(self):
        self._authenticate(self.owner)
        payload = self._payload(photo=self._image_upload())

        response = self.client.post(
            reverse('lost-report-list'),
            payload,
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        report = LostCatReport.objects.get()
        photo = LostCatReportPhoto.objects.get(report=report)
        self.assertTrue(photo.is_main)
        self.assertTrue(photo.image.name.startswith('lost-cat-report-photos/'))
        self.assertNotIn(str(report.id), photo.image.name)
        self.assertTrue(photo.image.name.endswith('.jpg'))

    def test_create_report_rejects_unsupported_photo_type(self):
        self._authenticate(self.owner)
        payload = self._payload(
            photo=self._image_upload(
                filename='luna.gif',
                content_type='image/gif',
                image_format='GIF',
            )
        )

        response = self.client.post(
            reverse('lost-report-list'),
            payload,
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('photo', response.data)
        self.assertFalse(LostCatReport.objects.exists())
        self.assertFalse(LostCatReportPhoto.objects.exists())

    def test_create_report_rejects_oversized_photo(self):
        self._authenticate(self.owner)
        payload = self._payload(photo=self._image_upload())

        with override_settings(REPORT_PHOTO_MAX_SIZE_BYTES=10):
            response = self.client.post(
                reverse('lost-report-list'),
                payload,
                format='multipart',
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('photo', response.data)
        self.assertFalse(LostCatReport.objects.exists())
        self.assertFalse(LostCatReportPhoto.objects.exists())

    def test_owner_can_list_report_photo_gallery(self):
        report = self._create_report(self.owner)
        main_photo = LostCatReportPhoto.objects.create(
            report=report,
            image=self._image_upload(filename='main.jpg'),
            is_main=True,
        )
        secondary_photo = LostCatReportPhoto.objects.create(
            report=report,
            image=self._image_upload(filename='secondary.jpg'),
        )
        self._authenticate(self.owner)

        response = self.client.get(self._photos_url(report))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(response.data[0]['id'], str(main_photo.id))
        self.assertEqual(response.data[0]['is_main'], True)
        self.assertEqual(
            response.data[0]['url'],
            f'http://testserver{main_photo.image.url}',
        )
        self.assertEqual(response.data[1]['id'], str(secondary_photo.id))
        self.assertEqual(response.data[1]['is_main'], False)
        self.assertNotIn('image', response.data[0])
        self.assertNotIn('path', response.data[0])

    def test_owner_can_upload_additional_report_photo(self):
        report = self._create_report(self.owner)
        existing_main = LostCatReportPhoto.objects.create(
            report=report,
            image=self._image_upload(filename='main.jpg'),
            is_main=True,
        )
        self._authenticate(self.owner)

        response = self.client.post(
            self._photos_url(report),
            {
                'photo': self._image_upload(
                    filename='new-main.png',
                    content_type='image/png',
                    image_format='PNG',
                ),
                'is_main': 'true',
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['is_main'])
        new_photo = LostCatReportPhoto.objects.get(pk=response.data['id'])
        existing_main.refresh_from_db()
        self.assertFalse(existing_main.is_main)
        self.assertTrue(new_photo.is_main)
        self.assertTrue(new_photo.image.name.endswith('.png'))

    def test_photo_gallery_rejects_unsupported_upload(self):
        report = self._create_report(self.owner)
        self._authenticate(self.owner)

        response = self.client.post(
            self._photos_url(report),
            {
                'photo': self._image_upload(
                    filename='bad.gif',
                    content_type='image/gif',
                    image_format='GIF',
                )
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('photo', response.data)
        self.assertFalse(LostCatReportPhoto.objects.exists())

    def test_owner_can_set_main_report_photo_for_public_cards(self):
        report = self._create_report(self.owner, status=LostCatReport.Status.MISSING)
        old_main = LostCatReportPhoto.objects.create(
            report=report,
            image=self._image_upload(filename='old-main.jpg'),
            is_main=True,
        )
        new_main = LostCatReportPhoto.objects.create(
            report=report,
            image=self._image_upload(filename='new-main.jpg'),
        )
        self._authenticate(self.owner)

        response = self.client.patch(self._photo_main_url(report, new_main))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_main'])
        old_main.refresh_from_db()
        new_main.refresh_from_db()
        self.assertFalse(old_main.is_main)
        self.assertTrue(new_main.is_main)

        public_response = self.client.get(self._public_list_url())
        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        expected_url = f'http://testserver{new_main.image.url}'
        self.assertEqual(
            public_response.data['results'][0]['main_photo'],
            {'url': expected_url},
        )

    def test_owner_can_delete_photo_and_main_photo_is_promoted(self):
        report = self._create_report(self.owner)
        old_main = LostCatReportPhoto.objects.create(
            report=report,
            image=self._image_upload(filename='old-main.jpg'),
            is_main=True,
        )
        replacement = LostCatReportPhoto.objects.create(
            report=report,
            image=self._image_upload(filename='replacement.jpg'),
        )
        old_image_name = old_main.image.name
        self.assertTrue(default_storage.exists(old_image_name))
        self._authenticate(self.owner)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(self._photo_detail_url(report, old_main))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(LostCatReportPhoto.objects.filter(pk=old_main.pk).exists())
        self.assertFalse(default_storage.exists(old_image_name))
        replacement.refresh_from_db()
        self.assertTrue(replacement.is_main)

        public_response = self.client.get(self._public_url(report))
        expected_url = f'http://testserver{replacement.image.url}'
        self.assertEqual(public_response.data['main_photo'], {'url': expected_url})

    def test_photo_gallery_requires_authentication(self):
        report = self._create_report(self.owner)

        list_response = self.client.get(self._photos_url(report))
        upload_response = self.client.post(
            self._photos_url(report),
            {'photo': self._image_upload()},
            format='multipart',
        )

        self.assertIn(
            list_response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )
        self.assertIn(
            upload_response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )

    def test_photo_gallery_requires_report_ownership(self):
        report = self._create_report(self.other_user)
        photo = LostCatReportPhoto.objects.create(
            report=report,
            image=self._image_upload(filename='other.jpg'),
            is_main=True,
        )
        self._authenticate(self.owner)

        list_response = self.client.get(self._photos_url(report))
        main_response = self.client.patch(self._photo_main_url(report, photo))
        delete_response = self.client.delete(self._photo_detail_url(report, photo))

        self.assertEqual(list_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(main_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(delete_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(LostCatReportPhoto.objects.filter(pk=photo.pk).exists())

    def test_list_returns_only_authenticated_owners_reports(self):
        owner_report = self._create_report(self.owner, cat_name='Luna')
        self._create_report(self.other_user, cat_name='Other cat')
        self._authenticate(self.owner)

        response = self.client.get(reverse('lost-report-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertIsNone(response.data['next'])
        self.assertIsNone(response.data['previous'])
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['id'], str(owner_report.id))
        self.assertEqual(response.data['results'][0]['cat_name'], 'Luna')
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_list_reports_is_paginated(self):
        for index in range(3):
            self._create_report(self.owner, cat_name=f'Cat {index}')
        self._authenticate(self.owner)

        response = self.client.get(reverse('lost-report-list'), {'page_size': 2})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 3)
        self.assertEqual(len(response.data['results']), 2)
        self.assertIsNotNone(response.data['next'])

    def test_create_report_returns_field_errors_for_missing_required_data(self):
        self._authenticate(self.owner)

        response = self.client.post(reverse('lost-report-list'), {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cat_name', response.data)
        self.assertIn('coat_color', response.data)
        self.assertIn('description', response.data)
        self.assertIn('last_seen_address', response.data)
        self.assertIn('contact_name', response.data)
        self.assertIn('contact_phone', response.data)
        self.assertIn('contact_email', response.data)

    def test_coordinates_must_be_supplied_as_a_pair(self):
        self._authenticate(self.owner)

        response = self.client.post(
            reverse('lost-report-list'),
            self._payload(last_seen_lng=None),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('last_seen_location', response.data)
        self.assertFalse(LostCatReport.objects.exists())

    def test_age_is_capped_to_plausible_cat_age(self):
        self._authenticate(self.owner)

        response = self.client.post(
            reverse('lost-report-list'),
            self._payload(age_years=31),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('age_years', response.data)

    def test_chip_number_is_not_stored_when_report_says_no_microchip(self):
        self._authenticate(self.owner)

        response = self.client.post(
            reverse('lost-report-list'),
            self._payload(has_microchip=False, chip_number='should-clear'),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data['has_microchip'])
        self.assertEqual(response.data['chip_number'], '')
        report = LostCatReport.objects.get()
        self.assertEqual(report.chip_number, '')

    def test_lost_cat_report_is_registered_in_admin(self):
        self.assertTrue(admin.site.is_registered(LostCatReport))
        self.assertTrue(admin.site.is_registered(LostCatReportPhoto))
        self.assertTrue(admin.site.is_registered(LostCatReportTimelineEvent))

    def test_owner_can_retrieve_report_detail_for_editing(self):
        report = self._create_report(
            self.owner,
            cat_name='Luna',
            contact_phone='+48 600 999 111',
            contact_email='private-owner@example.com',
        )
        self._authenticate(self.owner)

        response = self.client.get(self._detail_url(report))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], str(report.id))
        self.assertEqual(response.data['public_id'], str(report.public_id))
        self.assertEqual(response.data['cat_name'], 'Luna')
        self.assertEqual(response.data['contact_phone'], '+48 600 999 111')
        self.assertEqual(response.data['contact_email'], 'private-owner@example.com')
        self.assertNotIn('owner', response.data)
        self.assertNotIn('moderation_status', response.data)
        self.assertNotIn('moderation_notes', response.data)
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_get_report_detail_requires_authentication(self):
        report = self._create_report(self.owner)

        response = self.client.get(self._detail_url(report))

        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )

    def test_get_report_detail_requires_ownership(self):
        report = self._create_report(self.other_user)
        self._authenticate(self.owner)

        response = self.client.get(self._detail_url(report))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_owner_can_patch_editable_report_fields(self):
        report = self._create_report(
            self.owner,
            has_microchip=True,
            chip_number='985112003456789',
            last_seen_lat=52.2297,
            last_seen_lng=21.0122,
        )
        self._authenticate(self.owner)

        response = self.client.patch(
            self._detail_url(report),
            {
                'cat_name': 'Luna',
                'description': 'Likely hiding near the school.',
                'last_seen_address': '8 School Road',
                'last_seen_landmark': 'Behind the gym',
                'last_seen_lat': 52.2401,
                'last_seen_lng': 21.0202,
                'contact_visibility': LostCatReport.ContactVisibility.PUBLIC,
                'notify_sms': False,
                'has_microchip': False,
                'chip_number': 'should-not-persist',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['cat_name'], 'Luna')
        self.assertEqual(response.data['description'], 'Likely hiding near the school.')
        self.assertEqual(response.data['last_seen_address'], '8 School Road')
        self.assertEqual(response.data['contact_visibility'], LostCatReport.ContactVisibility.PUBLIC)
        self.assertFalse(response.data['notify_sms'])
        self.assertFalse(response.data['has_microchip'])
        self.assertEqual(response.data['chip_number'], '')

        report.refresh_from_db()
        self.assertEqual(report.cat_name, 'Luna')
        self.assertEqual(report.last_seen_landmark, 'Behind the gym')
        self.assertEqual(report.last_seen_lat, 52.2401)
        self.assertEqual(report.last_seen_lng, 21.0202)
        self.assertEqual(report.chip_number, '')

    def test_owner_can_put_full_editable_report_payload(self):
        report = self._create_report(self.owner)
        self._authenticate(self.owner)

        response = self.client.put(
            self._detail_url(report),
            self._payload(
                cat_name='Updated Luna',
                coat_color='Grey tabby',
                description='Updated search description.',
                last_seen_address='91 River Road',
                contact_email='updated-owner@example.com',
            ),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['cat_name'], 'Updated Luna')
        self.assertEqual(response.data['coat_color'], 'Grey tabby')
        self.assertEqual(response.data['description'], 'Updated search description.')
        self.assertEqual(response.data['last_seen_address'], '91 River Road')
        self.assertEqual(response.data['contact_email'], 'updated-owner@example.com')

        report.refresh_from_db()
        self.assertEqual(report.owner, self.owner)
        self.assertEqual(report.cat_name, 'Updated Luna')

    def test_put_returns_field_errors_when_required_fields_are_missing(self):
        report = self._create_report(self.owner)
        self._authenticate(self.owner)

        response = self.client.put(self._detail_url(report), {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cat_name', response.data)
        self.assertIn('coat_color', response.data)
        self.assertIn('description', response.data)
        self.assertIn('last_seen_address', response.data)
        self.assertIn('contact_name', response.data)
        self.assertIn('contact_phone', response.data)
        self.assertIn('contact_email', response.data)

    def test_patch_requires_coordinate_pair_for_final_state(self):
        report = self._create_report(self.owner)
        self._authenticate(self.owner)

        response = self.client.patch(
            self._detail_url(report),
            {'last_seen_lat': 52.2401},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('last_seen_location', response.data)
        report.refresh_from_db()
        self.assertIsNone(report.last_seen_lat)
        self.assertIsNone(report.last_seen_lng)

    def test_non_owner_cannot_patch_report(self):
        report = self._create_report(self.other_user, cat_name='Other cat')
        self._authenticate(self.owner)

        response = self.client.patch(
            self._detail_url(report),
            {'cat_name': 'Should not change'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        report.refresh_from_db()
        self.assertEqual(report.cat_name, 'Other cat')

    def test_staff_cannot_edit_someone_elses_report_through_owner_api(self):
        staff_user = get_user_model().objects.create_user(
            email='staff@example.com',
            password='StrongPass123!',
            is_email_verified=True,
            is_staff=True,
        )
        report = self._create_report(self.owner, cat_name='Owner cat')
        self._authenticate(staff_user)

        response = self.client.patch(
            self._detail_url(report),
            {'cat_name': 'Staff changed'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        report.refresh_from_db()
        self.assertEqual(report.cat_name, 'Owner cat')

    def test_update_does_not_change_lifecycle_or_moderation_fields(self):
        report = self._create_report(
            self.owner,
            status=LostCatReport.Status.MISSING,
            moderation_status=LostCatReport.ModerationStatus.PENDING,
            moderation_notes='',
        )
        self._authenticate(self.owner)

        response = self.client.patch(
            self._detail_url(report),
            {
                'cat_name': 'Still missing Luna',
                'status': LostCatReport.Status.FOUND,
                'moderation_status': LostCatReport.ModerationStatus.HIDDEN,
                'moderation_notes': 'malicious moderation change',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['cat_name'], 'Still missing Luna')
        self.assertEqual(response.data['status'], LostCatReport.Status.MISSING)
        self.assertNotIn('moderation_status', response.data)
        self.assertNotIn('moderation_notes', response.data)

        report.refresh_from_db()
        self.assertEqual(report.status, LostCatReport.Status.MISSING)
        self.assertEqual(report.moderation_status, LostCatReport.ModerationStatus.PENDING)
        self.assertEqual(report.moderation_notes, '')

    def test_change_status_requires_authentication(self):
        report = self._create_report(self.owner)

        response = self.client.patch(
            self._status_url(report),
            {'status': LostCatReport.Status.FOUND},
            format='json',
        )

        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )
        report.refresh_from_db()
        self.assertEqual(report.status, LostCatReport.Status.MISSING)
        self.assertFalse(LostCatReportTimelineEvent.objects.exists())

    def test_owner_can_change_report_status_and_create_timeline_event(self):
        self.owner.display_name = 'Marta Owner'
        self.owner.save(update_fields=('display_name',))
        report = self._create_report(
            self.owner,
            status=LostCatReport.Status.MISSING,
            last_seen_landmark='Near the school',
        )
        self._authenticate(self.owner)

        response = self.client.patch(
            self._status_url(report),
            {'status': LostCatReport.Status.RECENTLY_SEEN},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], LostCatReport.Status.RECENTLY_SEEN)
        self.assertTrue(response.data['is_active_search'])
        self.assertEqual(response.data['found_message'], '')
        self.assertIsNone(response.data['resolved_at'])
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertNotIn('moderation_status', response.data)
        self.assertNotIn('moderation_notes', response.data)

        report.refresh_from_db()
        self.assertEqual(report.status, LostCatReport.Status.RECENTLY_SEEN)

        timeline_event = LostCatReportTimelineEvent.objects.get(report=report)
        self.assertEqual(
            timeline_event.event_type,
            LostCatReportTimelineEvent.EventType.STATUS_CHANGED,
        )
        self.assertEqual(timeline_event.actor, self.owner)
        self.assertEqual(timeline_event.from_status, LostCatReport.Status.MISSING)
        self.assertEqual(timeline_event.to_status, LostCatReport.Status.RECENTLY_SEEN)
        self.assertEqual(timeline_event.location_summary, 'Near the school')

    def test_owner_can_mark_report_found_with_safe_found_message(self):
        report = self._create_report(self.owner, status=LostCatReport.Status.MISSING)
        self._authenticate(self.owner)

        response = self.client.patch(
            self._status_url(report),
            {
                'status': LostCatReport.Status.FOUND,
                'found_message': 'Luna is home. Thank you for helping.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], LostCatReport.Status.FOUND)
        self.assertEqual(
            response.data['found_message'],
            'Luna is home. Thank you for helping.',
        )
        self.assertFalse(response.data['is_active_search'])
        self.assertIsNotNone(response.data['resolved_at'])

        report.refresh_from_db()
        self.assertEqual(report.status, LostCatReport.Status.FOUND)
        self.assertEqual(
            report.found_message,
            'Luna is home. Thank you for helping.',
        )
        self.assertIsNotNone(report.resolved_at)
        self.assertFalse(report.is_active_search)
        self.assertEqual(
            LostCatReportTimelineEvent.objects.filter(report=report).count(),
            1,
        )

    def test_owner_can_update_found_message_without_duplicate_timeline_event(self):
        report = self._create_report(
            self.owner,
            status=LostCatReport.Status.FOUND,
            found_message='Found yesterday.',
            resolved_at=timezone.now(),
        )
        LostCatReportTimelineEvent.objects.create(
            report=report,
            actor=self.owner,
            event_type=LostCatReportTimelineEvent.EventType.STATUS_CHANGED,
            from_status=LostCatReport.Status.MISSING,
            to_status=LostCatReport.Status.FOUND,
        )
        self._authenticate(self.owner)

        response = self.client.patch(
            self._status_url(report),
            {
                'status': LostCatReport.Status.FOUND,
                'found_message': 'Found safe and healthy.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['found_message'], 'Found safe and healthy.')
        report.refresh_from_db()
        self.assertEqual(report.found_message, 'Found safe and healthy.')
        self.assertEqual(
            LostCatReportTimelineEvent.objects.filter(report=report).count(),
            1,
        )

    def test_reopening_report_clears_resolved_metadata(self):
        report = self._create_report(
            self.owner,
            status=LostCatReport.Status.CLOSED,
            found_message='Search closed.',
            resolved_at=timezone.now(),
        )
        self._authenticate(self.owner)

        response = self.client.patch(
            self._status_url(report),
            {'status': LostCatReport.Status.MISSING},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], LostCatReport.Status.MISSING)
        self.assertTrue(response.data['is_active_search'])
        self.assertEqual(response.data['found_message'], '')
        self.assertIsNone(response.data['resolved_at'])

        report.refresh_from_db()
        self.assertEqual(report.status, LostCatReport.Status.MISSING)
        self.assertEqual(report.found_message, '')
        self.assertIsNone(report.resolved_at)
        timeline_event = LostCatReportTimelineEvent.objects.get(report=report)
        self.assertEqual(timeline_event.from_status, LostCatReport.Status.CLOSED)
        self.assertEqual(timeline_event.to_status, LostCatReport.Status.MISSING)

    def test_found_message_requires_resolved_status(self):
        report = self._create_report(self.owner, status=LostCatReport.Status.MISSING)
        self._authenticate(self.owner)

        response = self.client.patch(
            self._status_url(report),
            {
                'status': LostCatReport.Status.RECENTLY_SEEN,
                'found_message': 'This should not be saved.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('found_message', response.data)
        report.refresh_from_db()
        self.assertEqual(report.status, LostCatReport.Status.MISSING)
        self.assertEqual(report.found_message, '')

    def test_found_message_rejects_private_contact_details(self):
        report = self._create_report(self.owner, status=LostCatReport.Status.MISSING)
        self._authenticate(self.owner)

        response = self.client.patch(
            self._status_url(report),
            {
                'status': LostCatReport.Status.FOUND,
                'found_message': 'Call me at +48 600 111 222 for details.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('found_message', response.data)
        report.refresh_from_db()
        self.assertEqual(report.status, LostCatReport.Status.MISSING)
        self.assertEqual(report.found_message, '')
        self.assertIsNone(report.resolved_at)

    def test_changed_status_appears_on_report_list_and_detail(self):
        report = self._create_report(self.owner, status=LostCatReport.Status.MISSING)
        self._authenticate(self.owner)

        response = self.client.patch(
            self._status_url(report),
            {'status': LostCatReport.Status.FOUND},
            format='json',
        )
        detail_response = self.client.get(self._detail_url(report))
        list_response = self.client.get(reverse('lost-report-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data['status'], LostCatReport.Status.FOUND)
        self.assertEqual(
            list_response.data['results'][0]['status'],
            LostCatReport.Status.FOUND,
        )

    def test_change_status_rejects_invalid_status(self):
        report = self._create_report(self.owner, status=LostCatReport.Status.MISSING)
        self._authenticate(self.owner)

        response = self.client.patch(
            self._status_url(report),
            {'status': 'LOST'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('status', response.data)
        report.refresh_from_db()
        self.assertEqual(report.status, LostCatReport.Status.MISSING)
        self.assertFalse(LostCatReportTimelineEvent.objects.exists())

    def test_non_owner_cannot_change_report_status(self):
        report = self._create_report(self.other_user, status=LostCatReport.Status.MISSING)
        self._authenticate(self.owner)

        response = self.client.patch(
            self._status_url(report),
            {'status': LostCatReport.Status.FOUND},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        report.refresh_from_db()
        self.assertEqual(report.status, LostCatReport.Status.MISSING)
        self.assertFalse(LostCatReportTimelineEvent.objects.exists())

    def test_same_status_update_does_not_duplicate_timeline_event(self):
        report = self._create_report(self.owner, status=LostCatReport.Status.MISSING)
        self._authenticate(self.owner)

        response = self.client.patch(
            self._status_url(report),
            {'status': LostCatReport.Status.MISSING},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], LostCatReport.Status.MISSING)
        self.assertFalse(LostCatReportTimelineEvent.objects.exists())

    def test_report_list_can_filter_active_and_resolved_reports(self):
        active_report = self._create_report(
            self.owner,
            cat_name='Active cat',
            status=LostCatReport.Status.MISSING,
        )
        self._create_report(
            self.owner,
            cat_name='Resolved cat',
            status=LostCatReport.Status.FOUND,
            resolved_at=timezone.now(),
        )
        self._authenticate(self.owner)

        active_response = self.client.get(reverse('lost-report-list'), {'active': 'true'})
        resolved_response = self.client.get(
            reverse('lost-report-list'),
            {'active': 'false'},
        )
        all_response = self.client.get(reverse('lost-report-list'))

        self.assertEqual(active_response.status_code, status.HTTP_200_OK)
        self.assertEqual(active_response.data['count'], 1)
        self.assertEqual(active_response.data['results'][0]['id'], str(active_report.id))
        self.assertTrue(active_response.data['results'][0]['is_active_search'])

        self.assertEqual(resolved_response.status_code, status.HTTP_200_OK)
        self.assertEqual(resolved_response.data['count'], 1)
        self.assertEqual(
            resolved_response.data['results'][0]['cat_name'],
            'Resolved cat',
        )
        self.assertFalse(resolved_response.data['results'][0]['is_active_search'])

        self.assertEqual(all_response.status_code, status.HTTP_200_OK)
        self.assertEqual(all_response.data['count'], 2)

    def test_report_list_rejects_invalid_active_filter(self):
        self._create_report(self.owner)
        self._authenticate(self.owner)

        response = self.client.get(reverse('lost-report-list'), {'active': 'maybe'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('active', response.data)

    def test_owner_can_read_status_timeline_without_private_actor_data(self):
        self.owner.display_name = 'Marta Owner'
        self.owner.save(update_fields=('display_name',))
        report = self._create_report(self.owner, status=LostCatReport.Status.MISSING)
        LostCatReportTimelineEvent.objects.create(
            report=report,
            actor=self.owner,
            event_type=LostCatReportTimelineEvent.EventType.STATUS_CHANGED,
            from_status=LostCatReport.Status.MISSING,
            to_status=LostCatReport.Status.CLOSED,
            location_summary='4 Oak Street',
        )
        self._authenticate(self.owner)

        response = self.client.get(self._timeline_url(report))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        event_data = response.data['results'][0]
        self.assertEqual(
            event_data['event_type'],
            LostCatReportTimelineEvent.EventType.STATUS_CHANGED,
        )
        self.assertEqual(event_data['from_status'], LostCatReport.Status.MISSING)
        self.assertEqual(event_data['to_status'], LostCatReport.Status.CLOSED)
        self.assertEqual(event_data['location_summary'], '4 Oak Street')
        self.assertEqual(event_data['actor']['display_name'], 'Marta Owner')
        self.assertEqual(event_data['actor']['avatar_fallback'], 'MO')
        self.assertNotIn('email', event_data['actor'])

    def test_timeline_orders_creation_sighting_and_status_events_chronologically(self):
        self.owner.display_name = 'Marta Owner'
        self.owner.save(update_fields=('display_name',))
        self.other_user.display_name = 'Helpful Neighbor'
        self.other_user.save(update_fields=('display_name',))
        self._authenticate(self.owner)

        create_response = self.client.post(
            reverse('lost-report-list'),
            self._payload(),
            format='json',
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        report = LostCatReport.objects.get(pk=create_response.data['id'])

        create_sighting(
            report=report,
            submitted_by=self.other_user,
            validated_data={
                'seen_at': timezone.now(),
                'location_description': 'Behind the bakery',
                'latitude': 52.2297,
                'longitude': 21.0122,
                'confidence': Sighting.Confidence.HIGH,
                'notes': 'Walking toward the courtyard.',
            },
        )
        status_response = self.client.patch(
            self._status_url(report),
            {'status': LostCatReport.Status.RECENTLY_SEEN},
            format='json',
        )
        self.assertEqual(status_response.status_code, status.HTTP_200_OK)

        response = self.client.get(self._timeline_url(report))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        event_types = [
            event['event_type']
            for event in response.data['results']
        ]
        self.assertEqual(
            event_types,
            [
                LostCatReportTimelineEvent.EventType.REPORT_CREATED,
                LostCatReportTimelineEvent.EventType.SIGHTING_CREATED,
                LostCatReportTimelineEvent.EventType.STATUS_CHANGED,
            ],
        )
        sighting_event = response.data['results'][1]
        self.assertEqual(sighting_event['location_summary'], 'Behind the bakery')
        self.assertEqual(sighting_event['actor']['display_name'], 'Helpful Neighbor')
        self.assertNotIn('email', sighting_event['actor'])

    def test_timeline_requires_authentication(self):
        report = self._create_report(self.owner)

        response = self.client.get(self._timeline_url(report))

        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )

    def test_timeline_requires_ownership(self):
        report = self._create_report(self.other_user)
        LostCatReportTimelineEvent.objects.create(
            report=report,
            actor=self.other_user,
            event_type=LostCatReportTimelineEvent.EventType.STATUS_CHANGED,
            from_status=LostCatReport.Status.MISSING,
            to_status=LostCatReport.Status.FOUND,
        )
        self._authenticate(self.owner)

        response = self.client.get(self._timeline_url(report))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_public_report_detail_is_available_without_authentication(self):
        report = self._create_report(
            self.owner,
            cat_name='Luna',
            age_years=4,
            breed='Domestic shorthair',
            coat_color='Black',
            eye_color='Green',
            gender=LostCatReport.Gender.FEMALE,
            collar_description='Red collar',
            has_microchip=True,
            chip_number='985112003456789',
            personality='Shy but food motivated.',
            description='Likely hiding near gardens.',
            disappeared_at=timezone.now(),
            last_seen_address='12 Private Home Street',
            last_seen_landmark='Near the playground',
            last_seen_lat=52.2297,
            last_seen_lng=21.0122,
            reward_amount='50.00',
            reward_note='Reward after safe recovery.',
            contact_name='Marta Owner',
            contact_phone='+48 600 111 222',
            contact_email='public-owner@example.com',
            contact_visibility=LostCatReport.ContactVisibility.PUBLIC,
            status=LostCatReport.Status.FOUND,
            found_message='Luna is home. Thank you.',
            resolved_at=timezone.now(),
        )
        LostCatReportTimelineEvent.objects.create(
            report=report,
            actor=self.owner,
            event_type=LostCatReportTimelineEvent.EventType.STATUS_CHANGED,
            from_status=LostCatReport.Status.MISSING,
            to_status=LostCatReport.Status.FOUND,
            location_summary='12 Private Home Street',
        )

        response = self.client.get(self._public_url(report))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['public_id'], str(report.public_id))
        self.assertEqual(response.data['cat_name'], 'Luna')
        self.assertEqual(response.data['status'], LostCatReport.Status.FOUND)
        self.assertEqual(response.data['found_message'], 'Luna is home. Thank you.')
        self.assertFalse(response.data['is_active_search'])
        self.assertEqual(response.data['last_seen_landmark'], 'Near the playground')
        self.assertEqual(
            response.data['approximate_location'],
            {
                'latitude': 52.23,
                'longitude': 21.012,
                'is_approximate': True,
            },
        )
        self.assertEqual(response.data['contact']['visibility'], LostCatReport.ContactVisibility.PUBLIC)
        self.assertEqual(response.data['contact']['phone'], '+48 600 111 222')
        self.assertEqual(response.data['contact']['email'], 'public-owner@example.com')
        self.assertIsNone(response.data['main_photo'])
        self.assertEqual(response.data['photos'], [])
        self.assertEqual(len(response.data['timeline']), 1)
        self.assertEqual(
            response.data['timeline'][0]['event_type'],
            LostCatReportTimelineEvent.EventType.STATUS_CHANGED,
        )
        self.assertNotIn('actor', response.data['timeline'][0])
        self.assertNotIn('location_summary', response.data['timeline'][0])
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_public_report_detail_returns_main_photo_url(self):
        report = self._create_report(self.owner, cat_name='Luna')
        photo = LostCatReportPhoto.objects.create(
            report=report,
            image=self._image_upload(filename='public-luna.jpg'),
            is_main=True,
        )

        response = self.client.get(self._public_url(report))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        expected_url = f'http://testserver{photo.image.url}'
        self.assertEqual(response.data['main_photo'], {'url': expected_url})
        self.assertEqual(response.data['photos'], [{'url': expected_url}])
        self.assertNotIn('id', response.data['main_photo'])
        self.assertNotIn('image', response.data['main_photo'])
        self.assertNotIn('path', response.data['main_photo'])

    def test_public_report_detail_hides_private_fields(self):
        report = self._create_report(
            self.owner,
            cat_name='Milo',
            has_microchip=True,
            chip_number='private-chip',
            last_seen_address='Exact private address',
            last_seen_landmark='Near the bakery',
            contact_name='Private Owner',
            contact_phone='+48 600 999 888',
            contact_email='private-owner@example.com',
            contact_visibility=LostCatReport.ContactVisibility.APP_ONLY,
        )

        response = self.client.get(self._public_url(report))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('id', response.data)
        self.assertNotIn('owner', response.data)
        self.assertNotIn('last_seen_address', response.data)
        self.assertNotIn('chip_number', response.data)
        self.assertNotIn('contact_name', response.data)
        self.assertNotIn('contact_phone', response.data)
        self.assertNotIn('contact_email', response.data)
        self.assertNotIn('notify_push', response.data)
        self.assertNotIn('notify_sms', response.data)
        self.assertNotIn('notify_email', response.data)
        self.assertNotIn('moderation_status', response.data)
        self.assertNotIn('moderation_notes', response.data)
        self.assertEqual(response.data['contact']['visibility'], LostCatReport.ContactVisibility.APP_ONLY)
        self.assertNotIn('phone', response.data['contact'])
        self.assertNotIn('email', response.data['contact'])

    def test_public_report_detail_hides_private_contact_choice(self):
        report = self._create_report(
            self.owner,
            contact_visibility=LostCatReport.ContactVisibility.PRIVATE,
            contact_phone='+48 600 999 888',
            contact_email='private-owner@example.com',
        )

        response = self.client.get(self._public_url(report))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['contact']['visibility'], LostCatReport.ContactVisibility.PRIVATE)
        self.assertNotIn('phone', response.data['contact'])
        self.assertNotIn('email', response.data['contact'])

    def test_public_report_detail_returns_404_for_hidden_report(self):
        report = self._create_report(
            self.owner,
            moderation_status=LostCatReport.ModerationStatus.HIDDEN,
        )

        response = self.client.get(self._public_url(report))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_public_report_detail_returns_404_for_unknown_public_id(self):
        response = self.client.get(
            reverse('lost-report-public-detail', args=[uuid4()])
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_public_report_list_defaults_to_active_reports(self):
        active_report = self._create_report(
            self.owner,
            cat_name='Active Luna',
            description='Likely near gardens.',
            last_seen_landmark='Near the park',
            last_seen_lat=52.2297,
            last_seen_lng=21.0122,
            status=LostCatReport.Status.MISSING,
        )
        self._create_report(
            self.owner,
            cat_name='Resolved Milo',
            status=LostCatReport.Status.FOUND,
            found_message='Milo is home.',
            resolved_at=timezone.now(),
        )
        self._create_report(
            self.owner,
            cat_name='Hidden cat',
            status=LostCatReport.Status.MISSING,
            moderation_status=LostCatReport.ModerationStatus.HIDDEN,
        )

        response = self.client.get(self._public_list_url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        card = response.data['results'][0]
        self.assertEqual(card['public_id'], str(active_report.public_id))
        self.assertEqual(
            card['detail_url'],
            f'/api/public/reports/{active_report.public_id}/',
        )
        self.assertEqual(card['cat_name'], 'Active Luna')
        self.assertTrue(card['is_active_search'])
        self.assertEqual(card['location_summary'], 'Near the park')
        self.assertIsNone(card['latest_sighting'])
        self.assertEqual(
            card['approximate_location'],
            {
                'latitude': 52.23,
                'longitude': 21.012,
                'is_approximate': True,
            },
        )
        self.assertIsNone(card['main_photo'])
        self.assertNotIn('id', card)
        self.assertNotIn('owner', card)
        self.assertNotIn('last_seen_address', card)
        self.assertNotIn('chip_number', card)
        self.assertNotIn('contact_phone', card)
        self.assertNotIn('contact_email', card)
        self.assertNotIn('moderation_status', card)
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_public_report_list_returns_main_photo_url(self):
        report = self._create_report(
            self.owner,
            cat_name='Active Luna',
            status=LostCatReport.Status.MISSING,
        )
        photo = LostCatReportPhoto.objects.create(
            report=report,
            image=self._image_upload(filename='card-luna.jpg'),
            is_main=True,
        )

        response = self.client.get(self._public_list_url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        card = response.data['results'][0]
        expected_url = f'http://testserver{photo.image.url}'
        self.assertEqual(card['main_photo'], {'url': expected_url})
        self.assertNotIn('id', card['main_photo'])
        self.assertNotIn('image', card['main_photo'])
        self.assertNotIn('path', card['main_photo'])

    def test_public_report_list_prefers_confirmed_sighting_over_newer_pending(self):
        report = self._create_report(
            self.owner,
            cat_name='Active Luna',
            status=LostCatReport.Status.MISSING,
        )
        now = timezone.now()
        confirmed_sighting = create_sighting(
            report=report,
            submitted_by=self.other_user,
            validated_data={
                'seen_at': now - timedelta(hours=2),
                'location_description': 'Confirmed near the school',
                'latitude': 52.22,
                'longitude': 21.01,
                'confidence': Sighting.Confidence.HIGH,
                'notes': 'Owner confirmed this one.',
            },
        )
        confirmed_sighting.verification_status = Sighting.VerificationStatus.USEFUL
        confirmed_sighting.save(update_fields=('verification_status',))
        create_sighting(
            report=report,
            submitted_by=self.other_user,
            validated_data={
                'seen_at': now - timedelta(minutes=10),
                'location_description': 'Unverified near the bakery',
                'latitude': 52.23,
                'longitude': 21.02,
                'confidence': Sighting.Confidence.MEDIUM,
                'notes': 'Newer but not confirmed yet.',
            },
        )

        response = self.client.get(self._public_list_url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        latest_sighting = response.data['results'][0]['latest_sighting']
        self.assertEqual(
            latest_sighting['location_description'],
            'Confirmed near the school',
        )
        self.assertEqual(latest_sighting['latitude'], 52.22)
        self.assertEqual(latest_sighting['longitude'], 21.01)
        self.assertEqual(latest_sighting['confidence'], Sighting.Confidence.HIGH)
        self.assertEqual(
            latest_sighting['verification_status'],
            Sighting.VerificationStatus.USEFUL,
        )

    def test_public_report_list_and_detail_fall_back_to_latest_pending_sighting(self):
        report = self._create_report(
            self.owner,
            cat_name='Active Luna',
            status=LostCatReport.Status.MISSING,
        )
        now = timezone.now()
        create_sighting(
            report=report,
            submitted_by=self.other_user,
            validated_data={
                'seen_at': now - timedelta(hours=2),
                'location_description': 'Older pending sighting',
                'latitude': 52.20,
                'longitude': 21.00,
                'confidence': Sighting.Confidence.LOW,
                'notes': 'Older pending note.',
            },
        )
        latest_pending_sighting = create_sighting(
            report=report,
            submitted_by=self.other_user,
            validated_data={
                'seen_at': now - timedelta(minutes=20),
                'location_description': 'Latest pending sighting',
                'latitude': 52.24,
                'longitude': 21.03,
                'confidence': Sighting.Confidence.MEDIUM,
                'notes': 'Private pending note.',
            },
        )
        false_sighting = create_sighting(
            report=report,
            submitted_by=self.other_user,
            validated_data={
                'seen_at': now - timedelta(minutes=5),
                'location_description': 'False sighting should be ignored',
                'latitude': 52.25,
                'longitude': 21.04,
                'confidence': Sighting.Confidence.HIGH,
                'notes': 'Owner rejected this one.',
            },
        )
        false_sighting.verification_status = Sighting.VerificationStatus.FALSE
        false_sighting.save(update_fields=('verification_status',))

        list_response = self.client.get(self._public_list_url())
        detail_response = self.client.get(self._public_url(report))

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        list_latest_sighting = list_response.data['results'][0]['latest_sighting']
        self.assertEqual(
            list_latest_sighting['location_description'],
            latest_pending_sighting.location_description,
        )
        self.assertEqual(list_latest_sighting['latitude'], latest_pending_sighting.latitude)
        self.assertEqual(list_latest_sighting['longitude'], latest_pending_sighting.longitude)
        self.assertEqual(list_latest_sighting['confidence'], Sighting.Confidence.MEDIUM)
        self.assertEqual(
            list_latest_sighting['verification_status'],
            Sighting.VerificationStatus.PENDING,
        )
        self.assertNotIn('submitted_by', list_latest_sighting)
        self.assertNotIn('notes', list_latest_sighting)
        self.assertNotIn('photos', list_latest_sighting)

        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            detail_response.data['latest_sighting']['location_description'],
            latest_pending_sighting.location_description,
        )

    def test_public_report_list_can_filter_resolved_reports(self):
        self._create_report(
            self.owner,
            cat_name='Active Luna',
            status=LostCatReport.Status.MISSING,
        )
        resolved_report = self._create_report(
            self.owner,
            cat_name='Resolved Milo',
            status=LostCatReport.Status.CLOSED,
            found_message='Milo is home.',
            resolved_at=timezone.now(),
        )

        response = self.client.get(self._public_list_url(), {'active': 'false'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['public_id'], str(resolved_report.public_id))
        self.assertFalse(response.data['results'][0]['is_active_search'])
        self.assertEqual(response.data['results'][0]['found_message'], 'Milo is home.')

    def test_public_report_list_can_filter_by_status(self):
        self._create_report(
            self.owner,
            cat_name='Missing Luna',
            status=LostCatReport.Status.MISSING,
        )
        found_report = self._create_report(
            self.owner,
            cat_name='Found Milo',
            status=LostCatReport.Status.FOUND,
            resolved_at=timezone.now(),
        )

        response = self.client.get(
            self._public_list_url(),
            {'status': LostCatReport.Status.FOUND},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['public_id'], str(found_report.public_id))
        self.assertEqual(response.data['results'][0]['status'], LostCatReport.Status.FOUND)

    def test_public_report_list_location_summary_falls_back_to_map_hint(self):
        report = self._create_report(
            self.owner,
            last_seen_landmark='',
            last_seen_lat=52.2297,
            last_seen_lng=21.0122,
            status=LostCatReport.Status.MISSING,
        )

        response = self.client.get(self._public_list_url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['public_id'], str(report.public_id))
        self.assertEqual(
            response.data['results'][0]['location_summary'],
            'Approximate map location available',
        )

    def test_public_report_list_rejects_invalid_filters(self):
        active_response = self.client.get(self._public_list_url(), {'active': 'maybe'})
        status_response = self.client.get(self._public_list_url(), {'status': 'LOST'})

        self.assertEqual(active_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('active', active_response.data)
        self.assertEqual(status_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('status', status_response.data)

    def test_owner_can_get_similar_nearby_reports(self):
        source_report = self._create_report(
            self.owner,
            cat_name='Luna',
            breed='Domestic shorthair',
            coat_color='Black with white patch',
            gender=LostCatReport.Gender.FEMALE,
            last_seen_lat=52.2297,
            last_seen_lng=21.0122,
        )
        similar_report = self._create_report(
            self.other_user,
            cat_name='Nora',
            breed='Domestic shorthair',
            coat_color='Black and white',
            gender=LostCatReport.Gender.FEMALE,
            last_seen_landmark='Near the library',
            last_seen_lat=52.23,
            last_seen_lng=21.013,
            contact_phone='+48 600 999 000',
            contact_email='private-other@example.com',
            status=LostCatReport.Status.RECENTLY_SEEN,
        )
        self._create_report(
            self.other_user,
            cat_name='Resolved similar cat',
            breed='Domestic shorthair',
            coat_color='Black and white',
            gender=LostCatReport.Gender.FEMALE,
            last_seen_lat=52.23,
            last_seen_lng=21.013,
            status=LostCatReport.Status.FOUND,
            resolved_at=timezone.now(),
        )
        self._create_report(
            self.other_user,
            cat_name='Hidden similar cat',
            breed='Domestic shorthair',
            coat_color='Black and white',
            gender=LostCatReport.Gender.FEMALE,
            last_seen_lat=52.23,
            last_seen_lng=21.013,
            moderation_status=LostCatReport.ModerationStatus.HIDDEN,
        )
        self._authenticate(self.owner)

        response = self.client.get(self._similar_url(source_report))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        result = response.data['results'][0]
        self.assertEqual(result['report']['public_id'], str(similar_report.public_id))
        self.assertEqual(result['report']['cat_name'], 'Nora')
        self.assertGreater(result['score'], 0)
        self.assertLess(result['distance_km'], 1)
        self.assertIn('nearby', result['reasons'])
        self.assertIn('same breed', result['reasons'])
        self.assertIn('similar coat', result['reasons'])
        self.assertNotIn('contact_phone', result['report'])
        self.assertNotIn('contact_email', result['report'])
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_similar_reports_require_source_report_ownership(self):
        source_report = self._create_report(self.other_user)
        self._authenticate(self.owner)

        response = self.client.get(self._similar_url(source_report))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_similar_reports_can_return_empty_results(self):
        source_report = self._create_report(
            self.owner,
            breed='Siamese',
            coat_color='Cream',
            last_seen_lat=None,
            last_seen_lng=None,
        )
        self._create_report(
            self.other_user,
            breed='Maine Coon',
            coat_color='Grey',
            last_seen_lat=None,
            last_seen_lng=None,
        )
        self._authenticate(self.owner)

        response = self.client.get(self._similar_url(source_report))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 0)
        self.assertEqual(response.data['results'], [])
