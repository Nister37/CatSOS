from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class AccountAuthApiTests(APITestCase):
    def test_register_creates_account_and_returns_token(self):
        response = self.client.post(
            reverse('account-register'),
            {
                'email': 'visitor@example.com',
                'password': 'StrongPass123!',
                'password_confirm': 'StrongPass123!',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['token_type'], 'Bearer')
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['email'], 'visitor@example.com')
        self.assertNotIn('password', response.data)

        user = get_user_model().objects.get(email='visitor@example.com')
        self.assertTrue(user.check_password('StrongPass123!'))

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

    def test_login_returns_existing_user_token(self):
        get_user_model().objects.create_user(
            email='visitor@example.com',
            password='StrongPass123!',
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

    def test_login_rejects_invalid_credentials_with_clear_error(self):
        get_user_model().objects.create_user(
            email='visitor@example.com',
            password='StrongPass123!',
        )

        response = self.client.post(
            reverse('account-login'),
            {'email': 'visitor@example.com', 'password': 'wrong-password'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('non_field_errors', response.data)

    def test_refresh_token_returns_new_access_token(self):
        get_user_model().objects.create_user(
            email='visitor@example.com',
            password='StrongPass123!',
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
