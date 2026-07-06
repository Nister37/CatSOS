from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from .models import Sighting, SightingPhoto
from .validators import validate_sighting_photo_upload

SIGHTING_NOTES_MAX_LENGTH = 2000


def build_sighting_photo_url(photo, request=None):
    if photo is None or not photo.image:
        return None

    try:
        url = photo.image.url
    except ValueError:
        return None

    if request is None:
        return url
    return request.build_absolute_uri(url)


class SightingPhotoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = SightingPhoto
        fields = (
            'id',
            'url',
            'created_at',
        )
        read_only_fields = fields

    def get_url(self, photo) -> str | None:
        return build_sighting_photo_url(
            photo,
            request=self.context.get('request'),
        )


class SightingSerializer(serializers.ModelSerializer):
    report_public_id = serializers.UUIDField(source='report.public_id', read_only=True)
    photos = serializers.SerializerMethodField()

    class Meta:
        model = Sighting
        fields = (
            'id',
            'report_public_id',
            'seen_at',
            'location_description',
            'latitude',
            'longitude',
            'confidence',
            'notes',
            'photos',
            'verification_status',
            'created_at',
        )
        read_only_fields = (
            'id',
            'report_public_id',
            'photos',
            'verification_status',
            'created_at',
        )

    def get_photos(self, sighting) -> list[dict]:
        return SightingPhotoSerializer(
            sighting.photos.all(),
            many=True,
            context=self.context,
        ).data


class SightingCreateSerializer(serializers.ModelSerializer):
    photo = serializers.ImageField(required=False, write_only=True)
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=SIGHTING_NOTES_MAX_LENGTH,
        trim_whitespace=True,
    )
    location_description = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=255,
        trim_whitespace=True,
    )

    class Meta:
        model = Sighting
        fields = (
            'seen_at',
            'location_description',
            'latitude',
            'longitude',
            'confidence',
            'notes',
            'photo',
        )

    def validate_photo(self, value):
        try:
            validate_sighting_photo_upload(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def validate_seen_at(self, value):
        if value > timezone.now() + timedelta(minutes=5):
            raise serializers.ValidationError('Sighting time cannot be in the future.')
        return value
