from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from .models import Sighting

SIGHTING_NOTES_MAX_LENGTH = 2000


class SightingSerializer(serializers.ModelSerializer):
    report_public_id = serializers.UUIDField(source='report.public_id', read_only=True)

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
            'verification_status',
            'created_at',
        )
        read_only_fields = (
            'id',
            'report_public_id',
            'verification_status',
            'created_at',
        )


class SightingCreateSerializer(serializers.ModelSerializer):
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
        )

    def validate_seen_at(self, value):
        if value > timezone.now() + timedelta(minutes=5):
            raise serializers.ValidationError('Sighting time cannot be in the future.')
        return value
