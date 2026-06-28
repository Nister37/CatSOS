import re
from datetime import timedelta
from urllib.parse import parse_qs, urlparse
from unittest.mock import patch

from django.contrib.auth.hashers import check_password
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core import mail
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework.throttling import ScopedRateThrottle

from .models import SocialAccount
from .services import (
    PASSWORD_CHANGE_SUCCESS_DETAIL,
    PASSWORD_RESET_INVALID_DETAIL,
    PASSWORD_RESET_RATE_LIMIT_DETAIL,
    PASSWORD_RESET_REQUEST_DETAIL,
    PASSWORD_RESET_SUCCESS_DETAIL,
    create_token_pair,
)
from .sso import SSOIdentity


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    ACCOUNT_VERIFICATION_RESEND_SECONDS=120,
    FRONTEND_URL='http://frontend.test',
    PASSWORD_RESET_TIMEOUT=3600,
    PASSWORD_RESET_EMAIL_RATE_LIMIT_PER_HOUR=1000,
    PASSWORD_RESET_IP_RATE_LIMIT_PER_HOUR=1000,
    REST_FRAMEWORK={
        'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
        'DEFAULT_AUTHENTICATION_CLASSES': [
            'rest_framework_simplejwt.authentication.JWTAuthentication',
            'rest_framework.authentication.SessionAuthentication',
        ],
        'DEFAULT_THROTTLE_RATES': {
            'auth_register': '1000/minute',
            'auth_verify': '1000/minute',
            'auth_resend': '1000/minute',
            'auth_change_email': '1000/minute',
            'auth_login': '1000/minute',
            'auth_token_refresh': '1000/minute',
            'auth_sso_login': '1000/minute',
            'auth_sso_link': '1000/minute',
        },
    },
)
class AccountAuthApiTests(APITestCase):
    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

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

    def _create_verified_user(self, email='visitor@example.com', password='StrongPass123!'):
        return get_user_model().objects.create_user(
            email=email,
            password=password,
            is_email_verified=True,
        )

    def _extract_latest_code(self):
        match = re.search(r'\b(\d{8})\b', mail.outbox[-1].body)
        self.assertIsNotNone(match)
        return match.group(1)

    def _extract_reset_link_parts(self):
        match = re.search(r'http://frontend\.test/\S+', mail.outbox[-1].body)
        self.assertIsNotNone(match)
        parsed = urlparse(match.group(0))
        params = parse_qs(parsed.query)
        return params['uid'][0], params['token'][0]

    def _authenticate(self, user):
        tokens = create_token_pair(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

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
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertEqual(response['Pragma'], 'no-cache')

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

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('resend_available_in_seconds', response.data)
        self.assertIn('Retry-After', response)
        self.assertEqual(response['Cache-Control'], 'no-store')
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
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertEqual(response['Pragma'], 'no-cache')

    def test_password_reset_request_returns_generic_response_for_existing_email(self):
        self._create_verified_user()

        response = self.client.post(
            reverse('account-password-reset'),
            {'email': 'visitor@example.com'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {'detail': PASSWORD_RESET_REQUEST_DETAIL})
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertNotIn('uid', response.data)
        self.assertNotIn('token', response.data)

    def test_password_reset_request_returns_generic_response_for_missing_email(self):
        response = self.client.post(
            reverse('account-password-reset'),
            {'email': 'missing@example.com'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {'detail': PASSWORD_RESET_REQUEST_DETAIL})
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_password_reset_email_is_sent_for_active_user_with_usable_password(self):
        self._create_verified_user()

        response = self.client.post(
            reverse('account-password-reset'),
            {'email': 'visitor@example.com'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['visitor@example.com'])
        self.assertIn('http://frontend.test/password-reset/confirm/', mail.outbox[0].body)

    def test_password_reset_email_is_not_sent_for_missing_email(self):
        response = self.client.post(
            reverse('account-password-reset'),
            {'email': 'missing@example.com'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)

    def test_password_reset_email_is_not_sent_for_inactive_user(self):
        self._create_verified_user()
        user = get_user_model().objects.get(email='visitor@example.com')
        user.is_active = False
        user.save(update_fields=['is_active'])

        response = self.client.post(
            reverse('account-password-reset'),
            {'email': 'visitor@example.com'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {'detail': PASSWORD_RESET_REQUEST_DETAIL})
        self.assertEqual(len(mail.outbox), 0)

    def test_password_reset_email_is_not_sent_for_sso_only_user(self):
        get_user_model().objects.create_user(
            email='sso@example.com',
            password=None,
            is_email_verified=True,
        )

        response = self.client.post(
            reverse('account-password-reset'),
            {'email': 'sso@example.com'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {'detail': PASSWORD_RESET_REQUEST_DETAIL})
        self.assertEqual(len(mail.outbox), 0)

    def test_password_reset_request_validation_error_has_no_store_headers(self):
        response = self.client.post(
            reverse('account-password-reset'),
            {'email': 'not-an-email'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertEqual(response['Pragma'], 'no-cache')

    def test_password_reset_token_is_never_returned_in_json_response(self):
        self._create_verified_user()

        response = self.client.post(
            reverse('account-password-reset'),
            {'email': 'visitor@example.com'},
            format='json',
        )
        uid, token = self._extract_reset_link_parts()
        response_text = str(response.data)

        self.assertNotIn(uid, response_text)
        self.assertNotIn(token, response_text)
        self.assertNotIn('access', response.data)
        self.assertNotIn('refresh', response.data)

    def test_valid_password_reset_uid_and_token_changes_password(self):
        user = self._create_verified_user()
        self.client.post(
            reverse('account-password-reset'),
            {'email': 'visitor@example.com'},
            format='json',
        )
        uid, token = self._extract_reset_link_parts()

        response = self.client.post(
            reverse('account-password-reset-confirm'),
            {
                'uid': uid,
                'token': token,
                'new_password': 'NewPassword123!',
                'new_password_confirm': 'NewPassword123!',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {'detail': PASSWORD_RESET_SUCCESS_DETAIL})
        self.assertNotIn('access', response.data)
        self.assertNotIn('refresh', response.data)
        user.refresh_from_db()
        self.assertTrue(user.check_password('NewPassword123!'))
        self.assertEqual(len(mail.outbox), 2)
        self.assertEqual(mail.outbox[-1].to, ['visitor@example.com'])

    def test_password_reset_confirm_rejects_invalid_token(self):
        user = self._create_verified_user()
        self.client.post(
            reverse('account-password-reset'),
            {'email': 'visitor@example.com'},
            format='json',
        )
        uid, _token = self._extract_reset_link_parts()

        response = self.client.post(
            reverse('account-password-reset-confirm'),
            {
                'uid': uid,
                'token': 'invalid-token',
                'new_password': 'NewPassword123!',
                'new_password_confirm': 'NewPassword123!',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data, {'detail': PASSWORD_RESET_INVALID_DETAIL})
        user.refresh_from_db()
        self.assertTrue(user.check_password('StrongPass123!'))

    def test_password_reset_confirm_rejects_mismatched_passwords(self):
        self._create_verified_user()
        self.client.post(
            reverse('account-password-reset'),
            {'email': 'visitor@example.com'},
            format='json',
        )
        uid, token = self._extract_reset_link_parts()

        response = self.client.post(
            reverse('account-password-reset-confirm'),
            {
                'uid': uid,
                'token': token,
                'new_password': 'NewPassword123!',
                'new_password_confirm': 'DifferentPass123!',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('new_password_confirm', response.data)
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertEqual(response['Pragma'], 'no-cache')

    def test_password_reset_confirm_rejects_weak_password(self):
        self._create_verified_user()
        self.client.post(
            reverse('account-password-reset'),
            {'email': 'visitor@example.com'},
            format='json',
        )
        uid, token = self._extract_reset_link_parts()

        response = self.client.post(
            reverse('account-password-reset-confirm'),
            {
                'uid': uid,
                'token': token,
                'new_password': 'short',
                'new_password_confirm': 'short',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('new_password', response.data)
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertEqual(response['Pragma'], 'no-cache')

    def test_password_change_requires_authentication(self):
        response = self.client.post(
            reverse('account-password-change'),
            {
                'current_password': 'StrongPass123!',
                'new_password': 'NewPassword123!',
                'new_password_confirm': 'NewPassword123!',
            },
            format='json',
        )

        self.assertIn(response.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertEqual(response['Pragma'], 'no-cache')

    def test_password_change_rejects_wrong_current_password(self):
        user = self._create_verified_user()
        self._authenticate(user)

        response = self.client.post(
            reverse('account-password-change'),
            {
                'current_password': 'wrong-password',
                'new_password': 'NewPassword123!',
                'new_password_confirm': 'NewPassword123!',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data, {'current_password': ['Current password is incorrect.']})
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertEqual(response['Pragma'], 'no-cache')
        user.refresh_from_db()
        self.assertTrue(user.check_password('StrongPass123!'))

    def test_password_change_with_correct_current_password_changes_password(self):
        user = self._create_verified_user()
        self._authenticate(user)

        response = self.client.post(
            reverse('account-password-change'),
            {
                'current_password': 'StrongPass123!',
                'new_password': 'NewPassword123!',
                'new_password_confirm': 'NewPassword123!',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {'detail': PASSWORD_CHANGE_SUCCESS_DETAIL})
        user.refresh_from_db()
        self.assertTrue(user.check_password('NewPassword123!'))
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['visitor@example.com'])

    @patch('accounts.services.verify_sso_token')
    def test_sso_login_creates_verified_user_and_social_account(self, verify_sso_token):
        verify_sso_token.return_value = SSOIdentity(
            provider=SocialAccount.Provider.GOOGLE,
            provider_user_id='google-123',
            email='sso@example.com',
        )

        response = self.client.post(
            reverse('account-sso-login'),
            {'provider': 'google', 'token': 'provider-token'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['token_type'], 'Bearer')
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['email'], 'sso@example.com')
        self.assertEqual(response['Cache-Control'], 'no-store')

        user = get_user_model().objects.get(email='sso@example.com')
        self.assertTrue(user.is_email_verified)
        self.assertFalse(user.has_usable_password())
        self.assertTrue(
            SocialAccount.objects.filter(
                user=user,
                provider=SocialAccount.Provider.GOOGLE,
                provider_user_id='google-123',
            ).exists()
        )

    @patch('accounts.services.verify_sso_token')
    def test_sso_login_existing_social_account_returns_existing_user_token(self, verify_sso_token):
        user = get_user_model().objects.create_user(
            email='sso@example.com',
            password=None,
            is_email_verified=True,
        )
        SocialAccount.objects.create(
            user=user,
            provider=SocialAccount.Provider.GITHUB,
            provider_user_id='github-123',
            email='sso@example.com',
        )
        verify_sso_token.return_value = SSOIdentity(
            provider=SocialAccount.Provider.GITHUB,
            provider_user_id='github-123',
            email='sso@example.com',
        )

        response = self.client.post(
            reverse('account-sso-login'),
            {'provider': 'github', 'token': 'provider-token'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['email'], 'sso@example.com')

    @patch('accounts.services.verify_sso_token')
    def test_sso_login_existing_email_requires_authenticated_link(self, verify_sso_token):
        get_user_model().objects.create_user(
            email='visitor@example.com',
            password='StrongPass123!',
            is_email_verified=True,
        )
        verify_sso_token.return_value = SSOIdentity(
            provider=SocialAccount.Provider.MICROSOFT,
            provider_user_id='microsoft-123',
            email='visitor@example.com',
        )

        response = self.client.post(
            reverse('account-sso-login'),
            {'provider': 'microsoft', 'token': 'provider-token'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)
        self.assertFalse(SocialAccount.objects.exists())

    def test_sso_link_requires_authentication(self):
        response = self.client.post(
            reverse('account-sso-link'),
            {'provider': 'google', 'token': 'provider-token'},
            format='json',
        )

        self.assertIn(response.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})

    @patch('accounts.services.verify_sso_token')
    def test_sso_link_adds_provider_to_existing_user(self, verify_sso_token):
        user = get_user_model().objects.create_user(
            email='visitor@example.com',
            password='StrongPass123!',
            is_email_verified=True,
        )
        self._authenticate(user)
        verify_sso_token.return_value = SSOIdentity(
            provider=SocialAccount.Provider.GITHUB,
            provider_user_id='github-456',
            email='visitor@example.com',
        )

        response = self.client.post(
            reverse('account-sso-link'),
            {'provider': 'github', 'token': 'provider-token'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['social_account']['provider'], 'github')
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertTrue(
            SocialAccount.objects.filter(
                user=user,
                provider=SocialAccount.Provider.GITHUB,
                provider_user_id='github-456',
            ).exists()
        )

    @patch('accounts.services.verify_sso_token')
    def test_sso_link_rejects_provider_account_linked_to_another_user(self, verify_sso_token):
        current_user = get_user_model().objects.create_user(
            email='current@example.com',
            password='StrongPass123!',
            is_email_verified=True,
        )
        other_user = get_user_model().objects.create_user(
            email='other@example.com',
            password='StrongPass123!',
            is_email_verified=True,
        )
        SocialAccount.objects.create(
            user=other_user,
            provider=SocialAccount.Provider.GOOGLE,
            provider_user_id='google-999',
            email='other@example.com',
        )
        self._authenticate(current_user)
        verify_sso_token.return_value = SSOIdentity(
            provider=SocialAccount.Provider.GOOGLE,
            provider_user_id='google-999',
            email='other@example.com',
        )

        response = self.client.post(
            reverse('account-sso-link'),
            {'provider': 'google', 'token': 'provider-token'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('provider', response.data)

    @patch('accounts.services.verify_sso_token')
    def test_sso_link_marks_matching_unverified_email_as_verified(self, verify_sso_token):
        user = get_user_model().objects.create_user(
            email='visitor@example.com',
            password='StrongPass123!',
            is_email_verified=False,
        )
        self._authenticate(user)
        verify_sso_token.return_value = SSOIdentity(
            provider=SocialAccount.Provider.MICROSOFT,
            provider_user_id='microsoft-789',
            email='visitor@example.com',
        )

        response = self.client.post(
            reverse('account-sso-link'),
            {'provider': 'microsoft', 'token': 'provider-token'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.is_email_verified)
        self.assertIsNotNone(user.email_verified_at)


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    PASSWORD_RESET_EMAIL_RATE_LIMIT_PER_HOUR=1,
    PASSWORD_RESET_IP_RATE_LIMIT_PER_HOUR=1000,
)
class AccountPasswordResetRateLimitTests(APITestCase):
    def setUp(self):
        cache.clear()
        get_user_model().objects.create_user(
            email='visitor@example.com',
            password='StrongPass123!',
            is_email_verified=True,
        )

    def tearDown(self):
        cache.clear()

    def test_password_reset_rate_limit_returns_429(self):
        first_response = self.client.post(
            reverse('account-password-reset'),
            {'email': 'visitor@example.com'},
            format='json',
        )
        second_response = self.client.post(
            reverse('account-password-reset'),
            {'email': 'visitor@example.com'},
            format='json',
        )

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second_response.data, {'detail': PASSWORD_RESET_RATE_LIMIT_DETAIL})
        self.assertIn('Retry-After', second_response)


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    PASSWORD_RESET_EMAIL_RATE_LIMIT_PER_HOUR=1000,
    PASSWORD_RESET_IP_RATE_LIMIT_PER_HOUR=1,
)
class AccountPasswordResetIpRateLimitTests(APITestCase):
    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_password_reset_ip_rate_limit_does_not_trust_forwarded_for_header(self):
        first_response = self.client.post(
            reverse('account-password-reset'),
            {'email': 'first@example.com'},
            format='json',
            HTTP_X_FORWARDED_FOR='203.0.113.10',
        )
        second_response = self.client.post(
            reverse('account-password-reset'),
            {'email': 'second@example.com'},
            format='json',
            HTTP_X_FORWARDED_FOR='203.0.113.11',
        )

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second_response.data, {'detail': PASSWORD_RESET_RATE_LIMIT_DETAIL})


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
)
class AccountThrottleTests(APITestCase):
    def setUp(self):
        self.original_throttle_rates = ScopedRateThrottle.THROTTLE_RATES
        ScopedRateThrottle.THROTTLE_RATES = {
            **self.original_throttle_rates,
            'auth_register': '1/minute',
        }
        cache.clear()

    def tearDown(self):
        ScopedRateThrottle.THROTTLE_RATES = self.original_throttle_rates
        cache.clear()

    def test_register_endpoint_is_throttled(self):
        first_response = self.client.post(
            reverse('account-register'),
            {
                'email': 'first@example.com',
                'password': 'StrongPass123!',
                'password_confirm': 'StrongPass123!',
            },
            format='json',
        )
        second_response = self.client.post(
            reverse('account-register'),
            {
                'email': 'second@example.com',
                'password': 'StrongPass123!',
                'password_confirm': 'StrongPass123!',
            },
            format='json',
        )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
