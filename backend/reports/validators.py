from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError


REPORT_PHOTO_ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
REPORT_PHOTO_ALLOWED_CONTENT_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
REPORT_PHOTO_ALLOWED_FORMATS = {'JPEG', 'PNG', 'WEBP'}
REPORT_PHOTO_TYPE_ERROR = 'Photo must be a JPEG, PNG, or WebP image.'
REPORT_PHOTO_CORRUPT_ERROR = 'Upload a valid JPEG, PNG, or WebP image.'


def format_file_size(size):
    megabyte = 1024 * 1024
    kilobyte = 1024
    if size % megabyte == 0:
        return f'{size // megabyte} MB'
    if size % kilobyte == 0:
        return f'{size // kilobyte} KB'
    return f'{size} bytes'


def report_photo_size_error():
    return (
        'Photo must be '
        f'{format_file_size(settings.REPORT_PHOTO_MAX_SIZE_BYTES)} or smaller.'
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


def validate_report_photo_upload(uploaded_file):
    if uploaded_file.size > settings.REPORT_PHOTO_MAX_SIZE_BYTES:
        raise ValidationError(report_photo_size_error())

    extension = Path(uploaded_file.name).suffix.lower()
    content_type = getattr(uploaded_file, 'content_type', '').lower()
    if (
        extension not in REPORT_PHOTO_ALLOWED_EXTENSIONS
        or content_type not in REPORT_PHOTO_ALLOWED_CONTENT_TYPES
    ):
        raise ValidationError(REPORT_PHOTO_TYPE_ERROR)

    position = _remember_position(uploaded_file)
    try:
        with Image.open(uploaded_file) as image:
            image_format = image.format
            image.verify()
    except (OSError, UnidentifiedImageError):
        raise ValidationError(REPORT_PHOTO_CORRUPT_ERROR)
    finally:
        _restore_position(uploaded_file, position)

    if image_format not in REPORT_PHOTO_ALLOWED_FORMATS:
        raise ValidationError(REPORT_PHOTO_TYPE_ERROR)
