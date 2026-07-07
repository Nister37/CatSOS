import json

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from points.models import UserBadge


class PublicProfileApiTests(APITestCase):
    def _create_contributor(self, **overrides):
        defaults = {
            'email': 'contributor@example.com',
            'password': 'StrongPass123!',
            'is_email_verified': True,
            'display_name': 'Trusted Helper',
            'contribution_points': 25,
            'public_badges': ['Verified helper'],
        }
        defaults.update(overrides)
        return get_user_model().objects.create_user(**defaults)

    def test_public_profile_returns_limited_public_credit_fields(self):
        user = self._create_contributor(
            email='private-account@example.com',
            display_name='Marta Helper',
            first_name='Private',
            last_name='Name',
            contribution_points=125,
            public_badges=['Search lead', 'Foster mentor'],
            public_bio='Coordinates evening searches.',
            public_location='Warsaw',
            public_email='helper-public@example.org',
            public_phone='+48 600 000 000',
        )
        user.profile_picture = f'profile-pictures/user-{user.pk}/avatar.jpg'
        user.totp_secret = 'SECRET-TOTP-VALUE'
        user.email_verification_code_hash = 'SECRET-CODE-HASH'
        user.save(
            update_fields=[
                'profile_picture',
                'totp_secret',
                'email_verification_code_hash',
            ]
        )

        response = self.client.get(
            reverse('account-public-profile', kwargs={'pk': user.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            set(response.data.keys()),
            {
                'id',
                'display_name',
                'profile_picture_url',
                'avatar_fallback',
                'points',
                'badges',
                'public_info',
            },
        )
        self.assertEqual(response.data['id'], user.pk)
        self.assertEqual(response.data['display_name'], 'Marta Helper')
        self.assertEqual(response.data['avatar_fallback'], 'MH')
        self.assertEqual(response.data['points'], 125)
        self.assertEqual(response.data['badges'], ['Search lead', 'Foster mentor'])
        self.assertTrue(
            response.data['profile_picture_url'].endswith(
                f'/media/profile-pictures/user-{user.pk}/avatar.jpg'
            )
        )
        self.assertEqual(
            response.data['public_info'],
            {
                'bio': 'Coordinates evening searches.',
                'location': 'Warsaw',
                'email': 'helper-public@example.org',
                'phone': '+48 600 000 000',
            },
        )
        self.assertEqual(response['Cache-Control'], 'no-store')

        serialized = json.dumps(response.data)
        self.assertNotIn('private-account@example.com', serialized)
        self.assertNotIn('Private', serialized)
        self.assertNotIn('Name', serialized)
        self.assertNotIn('SECRET-TOTP-VALUE', serialized)
        self.assertNotIn('SECRET-CODE-HASH', serialized)
        self.assertNotIn('password', serialized)

    def test_public_profile_never_falls_back_to_private_email(self):
        user = self._create_contributor(
            email='secret-local-part@example.com',
            display_name='',
            first_name='Secret',
            last_name='Keeper',
            contribution_points=0,
            public_badges=[
                {'label': 'Should not serialize', 'email': 'secret-local-part@example.com'},
                ' Search lead ',
                '',
                'Search lead',
            ],
            public_bio='',
            public_location='',
            public_email='',
            public_phone='',
        )

        response = self.client.get(
            reverse('account-public-profile', kwargs={'pk': user.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['display_name'], f'Contributor #{user.pk}')
        self.assertEqual(response.data['avatar_fallback'], 'C')
        self.assertEqual(response.data['badges'], ['Search lead'])
        self.assertEqual(response.data['public_info'], {})
        serialized = json.dumps(response.data)
        self.assertNotIn('secret-local-part@example.com', serialized)
        self.assertNotIn('Secret', serialized)
        self.assertNotIn('Keeper', serialized)
        self.assertNotIn('Should not serialize', serialized)

    def test_public_profile_includes_normalized_badges_safely(self):
        user = self._create_contributor(
            email='badge-helper@example.com',
            display_name='Badge Helper',
            contribution_points=35,
            public_badges=[],
        )
        UserBadge.objects.create(user=user, code='FIRST_HELP', label='First help')
        UserBadge.objects.create(user=user, code='NEIGHBOR_HELPER', label='Neighbor helper')

        response = self.client.get(
            reverse('account-public-profile', kwargs={'pk': user.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['points'], 35)
        self.assertEqual(response.data['badges'], ['First help', 'Neighbor helper'])
        serialized = json.dumps(response.data)
        self.assertNotIn('badge-helper@example.com', serialized)
        self.assertNotIn('point_transactions', serialized)
        self.assertNotIn('idempotency', serialized)

    def test_public_profile_hides_users_without_public_activity(self):
        user = self._create_contributor(
            contribution_points=0,
            public_badges=[],
        )

        response = self.client.get(
            reverse('account-public-profile', kwargs={'pk': user.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_public_profile_hides_unverified_and_inactive_users(self):
        unverified = self._create_contributor(
            email='unverified@example.com',
            is_email_verified=False,
        )
        inactive = self._create_contributor(
            email='inactive@example.com',
            is_active=False,
        )

        unverified_response = self.client.get(
            reverse('account-public-profile', kwargs={'pk': unverified.pk})
        )
        inactive_response = self.client.get(
            reverse('account-public-profile', kwargs={'pk': inactive.pk})
        )

        self.assertEqual(unverified_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(inactive_response.status_code, status.HTTP_404_NOT_FOUND)
