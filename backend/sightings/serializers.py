from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from .models import Sighting, SightingPhoto, VolunteerSearch
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


class SightingUserSummarySerializer(serializers.Serializer):
    display_name = serializers.CharField(read_only=True)
    avatar_fallback = serializers.CharField(read_only=True)


def build_user_summary(user) -> dict[str, str] | None:
    if user is None:
        return None

    display_name = (user.display_name or '').strip() or 'CatSOS user'
    initials = [
        part[0].upper()
        for part in display_name.split()
        if part and part[0].isalpha()
    ]
    avatar_fallback = ''.join(initials[:2]) or display_name[:1].upper()

    return SightingUserSummarySerializer(
        {
            'display_name': display_name,
            'avatar_fallback': avatar_fallback,
        }
    ).data


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


class SightingOwnerSerializer(SightingSerializer):
    submitted_by = serializers.SerializerMethodField()
    verified_by = serializers.SerializerMethodField()

    class Meta(SightingSerializer.Meta):
        fields = SightingSerializer.Meta.fields + (
            'submitted_by',
            'verified_by',
            'verified_at',
            'updated_at',
        )
        read_only_fields = fields

    def get_submitted_by(self, sighting) -> dict[str, str] | None:
        return build_user_summary(sighting.submitted_by)

    def get_verified_by(self, sighting) -> dict[str, str] | None:
        return build_user_summary(sighting.verified_by)


class SightingVerificationUpdateSerializer(serializers.Serializer):
    verification_status = serializers.ChoiceField(
        choices=Sighting.VerificationStatus.choices,
    )


class VolunteerSearchSerializer(serializers.ModelSerializer):
    report_public_id = serializers.UUIDField(source='report.public_id', read_only=True)
    volunteer = serializers.SerializerMethodField()

    class Meta:
        model = VolunteerSearch
        fields = (
            'id',
            'report_public_id',
            'volunteer',
            'created_at',
            'updated_at',
        )
        read_only_fields = fields

    def get_volunteer(self, volunteer_search) -> dict[str, str] | None:
        return build_user_summary(volunteer_search.volunteer)


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
