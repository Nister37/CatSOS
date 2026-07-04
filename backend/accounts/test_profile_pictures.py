import shutil
import tempfile
from io import BytesIO
from pathlib import Path, PurePosixPath

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image

from .services import delete_profile_picture, replace_profile_picture
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
            password='StrongPass123!',
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
