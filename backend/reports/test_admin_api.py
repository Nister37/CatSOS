from uuid import uuid4

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.services import create_token_pair
from reports.models import LostCatReport
from sightings.models import Sighting
from test_constants import TEST_USER_PASSWORD

User = get_user_model()


class AdminReportModerationApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='admin@example.com',
            password=TEST_USER_PASSWORD,
            is_staff=True,
            is_email_verified=True,
        )
        self.normal_user = User.objects.create_user(
            email='user@example.com',
            password=TEST_USER_PASSWORD,
            is_email_verified=True,
        )
        self.report = LostCatReport.objects.create(
            owner=self.normal_user,
            cat_name='Luna',
            coat_color='Black',
            description='Lost cat',
            last_seen_address='123 Main St',
            contact_name='Owner',
            contact_phone='555-0000',
            contact_email='user@example.com',
            moderation_status=LostCatReport.ModerationStatus.PENDING,
        )

    def _authenticate(self, user):
        tokens = create_token_pair(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    def _url(self, report_id=None):
        pk = report_id or self.report.id
        return reverse('admin-report-moderation', kwargs={'pk': pk})

    def test_admin_can_change_moderation_status(self):
        self._authenticate(self.admin)
        response = self.client.patch(
            self._url(),
            {'moderation_status': 'HIDDEN', 'moderation_notes': 'Spam content'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.report.refresh_from_db()
        self.assertEqual(self.report.moderation_status, LostCatReport.ModerationStatus.HIDDEN)
        self.assertEqual(self.report.moderation_notes, 'Spam content')

    def test_admin_can_approve_report(self):
        self._authenticate(self.admin)
        response = self.client.patch(
            self._url(),
            {'moderation_status': 'APPROVED'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.report.refresh_from_db()
        self.assertEqual(self.report.moderation_status, LostCatReport.ModerationStatus.APPROVED)

    def test_normal_user_cannot_moderate(self):
        self._authenticate(self.normal_user)
        response = self.client.patch(
            self._url(),
            {'moderation_status': 'HIDDEN'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_cannot_moderate(self):
        response = self.client.patch(
            self._url(),
            {'moderation_status': 'HIDDEN'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_invalid_moderation_status_rejected(self):
        self._authenticate(self.admin)
        response = self.client.patch(
            self._url(),
            {'moderation_status': 'INVALID_STATUS'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_nonexistent_report_returns_404(self):
        self._authenticate(self.admin)
        response = self.client.patch(
            reverse('admin-report-moderation', kwargs={'pk': uuid4()}),
            {'moderation_status': 'HIDDEN'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_moderation_notes_optional(self):
        self._authenticate(self.admin)
        response = self.client.patch(
            self._url(),
            {'moderation_status': 'APPROVED'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.report.refresh_from_db()
        self.assertEqual(self.report.moderation_notes, '')


class AdminSightingModerationApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='admin@example.com',
            password=TEST_USER_PASSWORD,
            is_staff=True,
            is_email_verified=True,
        )
        self.normal_user = User.objects.create_user(
            email='user@example.com',
            password=TEST_USER_PASSWORD,
            is_email_verified=True,
        )
        self.report = LostCatReport.objects.create(
            owner=self.normal_user,
            cat_name='Luna',
            coat_color='Black',
            description='Lost cat',
            last_seen_address='123 Main St',
            contact_name='Owner',
            contact_phone='555-0000',
            contact_email='user@example.com',
        )
        self.sighting = Sighting.objects.create(
            report=self.report,
            submitted_by=self.normal_user,
            seen_at='2026-07-20T10:00:00Z',
            latitude=51.0,
            longitude=4.0,
            verification_status=Sighting.VerificationStatus.PENDING,
        )

    def _authenticate(self, user):
        tokens = create_token_pair(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    def _url(self, sighting_id=None):
        pk = sighting_id or self.sighting.id
        return reverse('admin-sighting-moderation', kwargs={'pk': pk})

    def test_admin_can_verify_sighting(self):
        self._authenticate(self.admin)
        response = self.client.patch(
            self._url(),
            {'verification_status': 'USEFUL'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.sighting.refresh_from_db()
        self.assertEqual(
            self.sighting.verification_status,
            Sighting.VerificationStatus.USEFUL,
        )
        self.assertEqual(self.sighting.verified_by, self.admin)
        self.assertIsNotNone(self.sighting.verified_at)

    def test_admin_can_mark_sighting_false(self):
        self._authenticate(self.admin)
        response = self.client.patch(
            self._url(),
            {'verification_status': 'FALSE'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.sighting.refresh_from_db()
        self.assertEqual(
            self.sighting.verification_status,
            Sighting.VerificationStatus.FALSE,
        )

    def test_normal_user_cannot_moderate_sighting(self):
        self._authenticate(self.normal_user)
        response = self.client.patch(
            self._url(),
            {'verification_status': 'USEFUL'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_cannot_moderate_sighting(self):
        response = self.client.patch(
            self._url(),
            {'verification_status': 'USEFUL'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_nonexistent_sighting_returns_404(self):
        self._authenticate(self.admin)
        response = self.client.patch(
            reverse('admin-sighting-moderation', kwargs={'pk': uuid4()}),
            {'verification_status': 'USEFUL'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class AdminReportListApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='admin@example.com',
            password=TEST_USER_PASSWORD,
            is_staff=True,
            is_email_verified=True,
        )
        self.normal_user = User.objects.create_user(
            email='user@example.com',
            password=TEST_USER_PASSWORD,
            is_email_verified=True,
        )
        self.report_pending = LostCatReport.objects.create(
            owner=self.normal_user,
            cat_name='Luna',
            coat_color='Black',
            description='Lost cat',
            last_seen_address='123 Main St',
            contact_name='Owner',
            contact_phone='555-0000',
            contact_email='user@example.com',
            moderation_status=LostCatReport.ModerationStatus.PENDING,
        )
        self.report_hidden = LostCatReport.objects.create(
            owner=self.normal_user,
            cat_name='Shadow',
            coat_color='Grey',
            description='Another lost cat',
            last_seen_address='456 Elm St',
            contact_name='Owner',
            contact_phone='555-0001',
            contact_email='user@example.com',
            moderation_status=LostCatReport.ModerationStatus.HIDDEN,
        )

    def _authenticate(self, user):
        tokens = create_token_pair(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    def _url(self):
        return reverse('admin-report-list')

    def test_admin_can_list_all_reports(self):
        self._authenticate(self.admin)
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)

    def test_admin_can_filter_by_moderation_status(self):
        self._authenticate(self.admin)
        response = self.client.get(self._url(), {'moderation_status': 'HIDDEN'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['cat_name'], 'Shadow')

    def test_admin_sees_hidden_reports(self):
        self._authenticate(self.admin)
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        cat_names = [r['cat_name'] for r in response.data['results']]
        self.assertIn('Shadow', cat_names)

    def test_normal_user_cannot_access_admin_list(self):
        self._authenticate(self.normal_user)
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_cannot_access_admin_list(self):
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_pagination_works(self):
        self._authenticate(self.admin)
        response = self.client.get(self._url(), {'page_size': 1})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertIsNotNone(response.data['next'])

    def test_report_includes_owner_email(self):
        self._authenticate(self.admin)
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        report_data = response.data['results'][0]
        self.assertIn('owner_email', report_data)
        self.assertEqual(report_data['owner_email'], 'user@example.com')


class AdminStatsApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='admin@example.com',
            password=TEST_USER_PASSWORD,
            is_staff=True,
            is_email_verified=True,
        )
        self.normal_user = User.objects.create_user(
            email='user@example.com',
            password=TEST_USER_PASSWORD,
            is_email_verified=True,
        )
        self.report = LostCatReport.objects.create(
            owner=self.normal_user,
            cat_name='Luna',
            coat_color='Black',
            description='Lost cat',
            last_seen_address='123 Main St',
            contact_name='Owner',
            contact_phone='555-0000',
            contact_email='user@example.com',
            status=LostCatReport.Status.MISSING,
            moderation_status=LostCatReport.ModerationStatus.PENDING,
        )
        self.sighting = Sighting.objects.create(
            report=self.report,
            submitted_by=self.normal_user,
            seen_at='2026-07-20T10:00:00Z',
            latitude=51.0,
            longitude=4.0,
        )

    def _authenticate(self, user):
        tokens = create_token_pair(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    def _url(self):
        return reverse('admin-stats')

    def test_admin_can_get_stats(self):
        self._authenticate(self.admin)
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_reports'], 1)
        self.assertEqual(response.data['active_reports'], 1)
        self.assertEqual(response.data['total_sightings'], 1)
        self.assertEqual(response.data['total_users'], 2)
        self.assertEqual(response.data['reports_under_review'], 1)

    def test_normal_user_cannot_get_stats(self):
        self._authenticate(self.normal_user)
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_cannot_get_stats(self):
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_stats_count_active_reports_correctly(self):
        self._authenticate(self.admin)
        # Add a closed report
        LostCatReport.objects.create(
            owner=self.normal_user,
            cat_name='Shadow',
            coat_color='Grey',
            description='Found cat',
            last_seen_address='456 Elm St',
            contact_name='Owner',
            contact_phone='555-0001',
            contact_email='user@example.com',
            status=LostCatReport.Status.CLOSED,
        )
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_reports'], 2)
        self.assertEqual(response.data['active_reports'], 1)
