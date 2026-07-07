import shutil
import tempfile
from io import BytesIO
from pathlib import Path, PurePosixPath

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from test_constants import TEST_USER_PASSWORD

from .services import create_token_pair, delete_profile_picture, replace_profile_picture
from .validators import (
    PROFILE_PICTURE_CORRUPT_ERROR,
    PROFILE_PICTURE_TYPE_ERROR,
    validate_profile_picture_upload,
)


def image_upload(name='avatar.jpg', content_type='image/jpeg', image_format='JPEG'):
    buffer = BytesIO()
    Image.new('RGB', (20, 20), color=(40, 90, 140)).save(buffer, format=image_format)
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=content_type)


class ProfilePictureValidationTests(TestCase):
    def test_profile_picture_validator_accepts_supported_image(self):
        upload = image_upload()

        validate_profile_picture_upload(upload)

        self.assertEqual(upload.tell(), 0)

    @override_settings(PROFILE_PICTURE_MAX_SIZE_BYTES=1024)
    def test_profile_picture_validator_rejects_files_over_size_limit(self):
        upload = SimpleUploadedFile(
            'avatar.jpg',
            b'x' * 1025,
            content_type='image/jpeg',
        )

        with self.assertRaisesMessage(ValidationError, '1 KB or smaller'):
            validate_profile_picture_upload(upload)

    def test_profile_picture_validator_rejects_unsupported_type(self):
        upload = SimpleUploadedFile(
            'avatar.gif',
            b'GIF89a',
            content_type='image/gif',
        )

        with self.assertRaisesMessage(ValidationError, PROFILE_PICTURE_TYPE_ERROR):
            validate_profile_picture_upload(upload)

    def test_profile_picture_validator_rejects_corrupt_image(self):
        upload = SimpleUploadedFile(
            'avatar.jpg',
            b'not an image',
            content_type='image/jpeg',
        )

        with self.assertRaisesMessage(ValidationError, PROFILE_PICTURE_CORRUPT_ERROR):
            validate_profile_picture_upload(upload)


class ProfilePictureServiceTests(TestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp()
        self.settings_override = override_settings(MEDIA_ROOT=self.media_root)
        self.settings_override.enable()
        self.user = get_user_model().objects.create_user(
            email='owner@example.com',
            password=TEST_USER_PASSWORD,
            is_email_verified=True,
        )

    def tearDown(self):
        self.settings_override.disable()
        shutil.rmtree(self.media_root, ignore_errors=True)

    def _stored_path(self, name):
        return Path(settings.MEDIA_ROOT) / name

    def test_replace_profile_picture_uses_safe_generated_filename(self):
        replace_profile_picture(
            user=self.user,
            image=image_upload(name='my cat profile.jpg'),
        )
        stored_name = self.user.profile_picture.name

        self.assertTrue(self._stored_path(stored_name).exists())
        self.assertNotIn('my cat profile', PurePosixPath(stored_name).name)
        self.assertEqual(PurePosixPath(stored_name).suffix, '.jpg')

    def test_replace_profile_picture_removes_previous_file(self):
        replace_profile_picture(user=self.user, image=image_upload(name='first.jpg'))
        first_name = self.user.profile_picture.name

        replace_profile_picture(
            user=self.user,
            image=image_upload(
                name='second.png',
                content_type='image/png',
                image_format='PNG',
            ),
        )
        second_name = self.user.profile_picture.name

        self.assertNotEqual(first_name, second_name)
        self.assertFalse(self._stored_path(first_name).exists())
        self.assertTrue(self._stored_path(second_name).exists())

    def test_delete_profile_picture_clears_field_and_removes_file(self):
        replace_profile_picture(user=self.user, image=image_upload())
        stored_name = self.user.profile_picture.name

        delete_profile_picture(user=self.user)
        self.user.refresh_from_db()

        self.assertEqual(self.user.profile_picture.name, '')
        self.assertFalse(self._stored_path(stored_name).exists())


class ProfilePictureApiTests(APITestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp()
        self.settings_override = override_settings(MEDIA_ROOT=self.media_root)
        self.settings_override.enable()
        self.user = get_user_model().objects.create_user(
            email='owner@example.com',
            password=TEST_USER_PASSWORD,
            first_name='Owner',
            last_name='Helper',
            is_email_verified=True,
        )

    def tearDown(self):
        self.client.credentials()
        self.settings_override.disable()
        shutil.rmtree(self.media_root, ignore_errors=True)

    def _authenticate(self):
        tokens = create_token_pair(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    def _stored_path(self, name):
        return Path(settings.MEDIA_ROOT) / name

    def test_current_user_requires_authentication(self):
        response = self.client.get(reverse('account-me'))

        self.assertIn(response.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})

    def test_current_user_returns_fallback_avatar_without_profile_picture(self):
        self._authenticate()

        response = self.client.get(reverse('account-me'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'owner@example.com')
        self.assertIsNone(response.data['profile_picture_url'])
        self.assertEqual(response.data['avatar_fallback'], 'OH')
        self.assertNotIn('password', response.data)
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_profile_picture_upload_requires_authentication(self):
        response = self.client.post(
            reverse('account-profile-picture'),
            {'profile_picture': image_upload()},
            format='multipart',
        )

        self.assertIn(response.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})

    def test_user_can_upload_profile_picture(self):
        self._authenticate()

        response = self.client.post(
            reverse('account-profile-picture'),
            {'profile_picture': image_upload(name='trusted-cat.jpg')},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['avatar_fallback'], 'OH')
        self.assertIn('/media/profile-pictures/user-', response.data['profile_picture_url'])
        self.assertNotIn('trusted-cat', response.data['profile_picture_url'])

        self.user.refresh_from_db()
        self.assertTrue(self.user.profile_picture.name)
        self.assertTrue(self._stored_path(self.user.profile_picture.name).exists())

    def test_profile_picture_upload_rejects_invalid_file_with_clear_error(self):
        self._authenticate()

        response = self.client.post(
            reverse('account-profile-picture'),
            {
                'profile_picture': SimpleUploadedFile(
                    'avatar.gif',
                    b'GIF89a',
                    content_type='image/gif',
                ),
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            str(response.data['profile_picture'][0]),
            PROFILE_PICTURE_TYPE_ERROR,
        )
        self.user.refresh_from_db()
        self.assertEqual(self.user.profile_picture.name, '')

    def test_profile_picture_upload_replaces_previous_file(self):
        self._authenticate()
        first_response = self.client.post(
            reverse('account-profile-picture'),
            {'profile_picture': image_upload(name='first.jpg')},
            format='multipart',
        )
        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        first_name = self.user.profile_picture.name

        second_response = self.client.put(
            reverse('account-profile-picture'),
            {
                'profile_picture': image_upload(
                    name='second.png',
                    content_type='image/png',
                    image_format='PNG',
                ),
            },
            format='multipart',
        )

        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        second_name = self.user.profile_picture.name
        self.assertNotEqual(first_name, second_name)
        self.assertFalse(self._stored_path(first_name).exists())
        self.assertTrue(self._stored_path(second_name).exists())

    def test_user_can_delete_profile_picture_and_return_to_fallback(self):
        self._authenticate()
        upload_response = self.client.post(
            reverse('account-profile-picture'),
            {'profile_picture': image_upload()},
            format='multipart',
        )
        self.assertEqual(upload_response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        stored_name = self.user.profile_picture.name

        response = self.client.delete(reverse('account-profile-picture'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data['profile_picture_url'])
        self.assertEqual(response.data['avatar_fallback'], 'OH')
        self.user.refresh_from_db()
        self.assertEqual(self.user.profile_picture.name, '')
        self.assertFalse(self._stored_path(stored_name).exists())
