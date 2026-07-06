from django.contrib import admin
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.services import create_token_pair

from .models import LostCatReport


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
