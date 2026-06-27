import re
from datetime import timedelta

from django.contrib.auth.hashers import check_password
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    ACCOUNT_VERIFICATION_RESEND_SECONDS=120,
)
class AccountAuthApiTests(APITestCase):
    def _register(self, email='visitor@example.com'):
        response = self.client.post(
            reverse('account-register'),
            {
                'email': email,
                'password': 'StrongPass123!',
                'password_confirm': 'StrongPass123!',
            },
            format='json',
        )
        return response

    def _extract_latest_code(self):
        match = re.search(r'\b(\d{8})\b', mail.outbox[-1].body)
        self.assertIsNotNone(match)
        return match.group(1)

    def test_register_creates_unverified_account_and_sends_code(self):
        response = self._register()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['email_verification_required'])
        self.assertEqual(response.data['resend_available_in_seconds'], 120)
        self.assertEqual(response.data['user']['email'], 'visitor@example.com')
        self.assertNotIn('access', response.data)
        self.assertNotIn('refresh', response.data)
        self.assertNotIn('password', response.data)

        user = get_user_model().objects.get(email='visitor@example.com')
        self.assertTrue(user.check_password('StrongPass123!'))
        self.assertFalse(user.is_email_verified)
        self.assertTrue(user.email_verification_code_hash)
        self.assertEqual(len(mail.outbox), 1)
        self.assertTrue(check_password(self._extract_latest_code(), user.email_verification_code_hash))

    def test_register_rejects_invalid_payload_with_clear_errors(self):
        response = self.client.post(
            reverse('account-register'),
            {
                'email': 'visitor@example.com',
                'password': 'short',
                'password_confirm': 'different',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)
        self.assertIn('password_confirm', response.data)

    def test_register_rejects_duplicate_email_case_insensitively(self):
        get_user_model().objects.create_user(
            email='visitor@example.com',
            password='StrongPass123!',
            is_email_verified=True,
        )

        response = self.client.post(
            reverse('account-register'),
            {
                'email': 'Visitor@Example.com',
                'password': 'AnotherPass123!',
                'password_confirm': 'AnotherPass123!',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    def test_login_returns_existing_verified_user_token(self):
        get_user_model().objects.create_user(
            email='visitor@example.com',
            password='StrongPass123!',
            is_email_verified=True,
        )

        response = self.client.post(
            reverse('account-token'),
            {'email': 'visitor@example.com', 'password': 'StrongPass123!'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['token_type'], 'Bearer')
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['email'], 'visitor@example.com')

    def test_login_rejects_unverified_user(self):
        self._register()

        response = self.client.post(
            reverse('account-token'),
            {'email': 'visitor@example.com', 'password': 'StrongPass123!'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    def test_login_rejects_invalid_credentials_with_clear_error(self):
        get_user_model().objects.create_user(
            email='visitor@example.com',
            password='StrongPass123!',
            is_email_verified=True,
        )

        response = self.client.post(
            reverse('account-login'),
            {'email': 'visitor@example.com', 'password': 'wrong-password'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('non_field_errors', response.data)

    def test_verify_email_marks_account_verified_and_returns_token(self):
        self._register()
        code = self._extract_latest_code()

        response = self.client.post(
            reverse('account-verify-email'),
            {'email': 'visitor@example.com', 'code': code},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['token_type'], 'Bearer')
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

        user = get_user_model().objects.get(email='visitor@example.com')
        self.assertTrue(user.is_email_verified)
        self.assertEqual(user.email_verification_code_hash, '')
        self.assertIsNotNone(user.email_verified_at)

    def test_verify_email_rejects_invalid_code(self):
        self._register()

        response = self.client.post(
            reverse('account-verify-email'),
            {'email': 'visitor@example.com', 'code': '00000000'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('code', response.data)

    def test_resend_verification_rejects_cooldown(self):
        self._register()

        response = self.client.post(
            reverse('account-verification-resend'),
            {'email': 'visitor@example.com'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('resend_available_in_seconds', response.data)
        self.assertEqual(len(mail.outbox), 1)

    def test_resend_verification_sends_new_code_after_cooldown(self):
        self._register()
        user = get_user_model().objects.get(email='visitor@example.com')
        user.email_verification_sent_at = timezone.now() - timedelta(seconds=121)
        user.save(update_fields=['email_verification_sent_at'])

        response = self.client.post(
            reverse('account-verification-resend'),
            {'email': 'visitor@example.com'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['email_verification_required'])
        self.assertEqual(len(mail.outbox), 2)

    def test_change_verification_email_updates_pending_email_and_sends_code(self):
        self._register()

        response = self.client.post(
            reverse('account-verification-change-email'),
            {
                'email': 'visitor@example.com',
                'password': 'StrongPass123!',
                'new_email': 'changed@example.com',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['email'], 'changed@example.com')
        self.assertFalse(get_user_model().objects.filter(email='visitor@example.com').exists())
        self.assertTrue(get_user_model().objects.filter(email='changed@example.com').exists())
        self.assertEqual(len(mail.outbox), 2)
        self.assertEqual(mail.outbox[-1].to, ['changed@example.com'])

    def test_change_verification_email_rejects_wrong_password(self):
        self._register()

        response = self.client.post(
            reverse('account-verification-change-email'),
            {
                'email': 'visitor@example.com',
                'password': 'wrong-password',
                'new_email': 'changed@example.com',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('non_field_errors', response.data)

    def test_refresh_token_returns_new_access_token(self):
        get_user_model().objects.create_user(
            email='visitor@example.com',
            password='StrongPass123!',
            is_email_verified=True,
        )
        login_response = self.client.post(
            reverse('account-token'),
            {'email': 'visitor@example.com', 'password': 'StrongPass123!'},
            format='json',
        )

        response = self.client.post(
            reverse('account-token-refresh'),
            {'refresh': login_response.data['refresh']},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
