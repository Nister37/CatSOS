from django.contrib import admin
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.services import create_token_pair

from .models import LostCatReport, LostCatReportTimelineEvent


class LostCatReportCreateApiTests(APITestCase):
    def setUp(self):
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
