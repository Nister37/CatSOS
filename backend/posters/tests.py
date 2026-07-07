import base64

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.services import create_token_pair
from reports.models import LostCatReport


class ReportQRCodeApiTests(APITestCase):
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
        }
        defaults.update(overrides)
        return LostCatReport.objects.create(**defaults)

    def _url(self, report):
        return reverse('report-qr-code', args=[report.id])

    def test_qr_code_generation_requires_authentication(self):
        report = self._create_report()

        response = self.client.post(self._url(report), {}, format='json')

        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )

    @override_settings(FRONTEND_URL='https://app.catsos.example')
    def test_owner_can_generate_qr_code_for_public_report(self):
        report = self._create_report()
        self._authenticate(self.owner)

        response = self.client.post(self._url(report), {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data['public_url'],
            f'https://app.catsos.example/reports/{report.public_id}',
        )
        self.assertEqual(response.data['content_type'], 'image/png')
        self.assertTrue(response.data['qr_code'].startswith('data:image/png;base64,'))
        encoded_png = response.data['qr_code'].split(',', 1)[1]
        self.assertTrue(base64.b64decode(encoded_png).startswith(b'\x89PNG\r\n\x1a\n'))
        self.assertNotIn('owner', response.data)
        self.assertNotIn('contact_email', response.data)
        self.assertNotIn('contact_phone', response.data)
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_other_user_cannot_generate_qr_code_for_report(self):
        report = self._create_report()
        self._authenticate(self.other_user)

        response = self.client.post(self._url(report), {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_qr_code_generation_rejects_hidden_report(self):
        report = self._create_report(
            moderation_status=LostCatReport.ModerationStatus.HIDDEN,
        )
        self._authenticate(self.owner)

        response = self.client.post(self._url(report), {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('report', response.data)
