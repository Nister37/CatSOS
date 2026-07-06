from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError


SIGHTING_PHOTO_ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
SIGHTING_PHOTO_ALLOWED_CONTENT_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
SIGHTING_PHOTO_ALLOWED_FORMATS = {'JPEG', 'PNG', 'WEBP'}
SIGHTING_PHOTO_TYPE_ERROR = 'Sighting photo must be a JPEG, PNG, or WebP image.'
SIGHTING_PHOTO_CORRUPT_ERROR = 'Upload a valid JPEG, PNG, or WebP image.'


def format_file_size(size):
    megabyte = 1024 * 1024
    kilobyte = 1024
    if size % megabyte == 0:
        return f'{size // megabyte} MB'
    if size % kilobyte == 0:
        return f'{size // kilobyte} KB'
    return f'{size} bytes'


def sighting_photo_size_error():
    return (
        'Sighting photo must be '
        f'{format_file_size(settings.SIGHTING_PHOTO_MAX_SIZE_BYTES)} or smaller.'
    )


def _remember_position(uploaded_file):
    try:
        return uploaded_file.tell()
    except (AttributeError, OSError):
        return None


def _restore_position(uploaded_file, position):
    if position is None:
        return

    try:
        uploaded_file.seek(position)
    except (AttributeError, OSError):
        pass


def validate_sighting_photo_upload(uploaded_file):
    if uploaded_file.size > settings.SIGHTING_PHOTO_MAX_SIZE_BYTES:
        raise ValidationError(sighting_photo_size_error())

    extension = Path(uploaded_file.name).suffix.lower()
    content_type = getattr(uploaded_file, 'content_type', '').lower()
    if (
        extension not in SIGHTING_PHOTO_ALLOWED_EXTENSIONS
        or content_type not in SIGHTING_PHOTO_ALLOWED_CONTENT_TYPES
    ):
        raise ValidationError(SIGHTING_PHOTO_TYPE_ERROR)

    position = _remember_position(uploaded_file)
    try:
        with Image.open(uploaded_file) as image:
            image_format = image.format
            image.verify()
    except (OSError, UnidentifiedImageError):
        raise ValidationError(SIGHTING_PHOTO_CORRUPT_ERROR)
    finally:
        _restore_position(uploaded_file, position)

    if image_format not in SIGHTING_PHOTO_ALLOWED_FORMATS:
        raise ValidationError(SIGHTING_PHOTO_TYPE_ERROR)
