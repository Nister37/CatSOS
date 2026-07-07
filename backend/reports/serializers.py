import re

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from .models import LostCatReport, LostCatReportPhoto, LostCatReportTimelineEvent
from .services import create_report_photo
from .validators import validate_report_photo_upload

FOUND_MESSAGE_MAX_LENGTH = 500
PRIVATE_EMAIL_PATTERN = re.compile(r'[\w.+-]+@[\w-]+\.[\w.-]+')
PHONE_CANDIDATE_PATTERN = re.compile(r'\+?\d[\d\s().-]{7,}\d')
RESOLVED_REPORT_STATUSES = {
    LostCatReport.Status.FOUND,
    LostCatReport.Status.CLOSED,
}


def contains_phone_like_text(value):
    for match in PHONE_CANDIDATE_PATTERN.findall(value):
        digits = [char for char in match if char.isdigit()]
        if len(digits) >= 9:
            return True

    return False


def build_approximate_location(report):
    if report.last_seen_lat is None or report.last_seen_lng is None:
        return None

    return {
        'latitude': round(report.last_seen_lat, 3),
        'longitude': round(report.last_seen_lng, 3),
        'is_approximate': True,
    }


def build_report_photo_url(photo, request=None):
    if photo is None or not photo.image:
        return None

    try:
        url = photo.image.url
    except ValueError:
        return None

    if request is None:
        return url
    return request.build_absolute_uri(url)


def serialize_report_photo(photo, request=None) -> dict[str, str] | None:
    url = build_report_photo_url(photo, request=request)
    if url is None:
        return None
    return {'url': url}


def get_report_main_photo(report):
    photos = report.photos.all()
    main_photo = next((photo for photo in photos if photo.is_main), None)
    if main_photo is not None:
        return main_photo
    return next(iter(photos), None)


def get_latest_confirmed_sighting(report):
    from sightings.models import Sighting

    return (
        report.sightings.filter(
            verification_status=Sighting.VerificationStatus.USEFUL,
        )
        .order_by('-seen_at', '-created_at')
        .first()
    )


class LostCatReportLatestSightingSerializer(serializers.Serializer):
    seen_at = serializers.DateTimeField(read_only=True)
    location_description = serializers.CharField(read_only=True)
    latitude = serializers.FloatField(read_only=True)
    longitude = serializers.FloatField(read_only=True)
    confidence = serializers.CharField(read_only=True)


def serialize_latest_confirmed_sighting(report) -> dict | None:
    sighting = get_latest_confirmed_sighting(report)
    if sighting is None:
        return None
    return LostCatReportLatestSightingSerializer(sighting).data


class LostCatReportOwnerSerializer(serializers.ModelSerializer):
    is_active_search = serializers.BooleanField(read_only=True)

    class Meta:
        model = LostCatReport
        fields = (
            'id',
            'public_id',
            'cat_name',
            'age_years',
            'breed',
            'coat_color',
            'eye_color',
            'gender',
            'collar_description',
            'has_microchip',
            'chip_number',
            'personality',
            'description',
            'disappeared_at',
            'last_seen_address',
            'last_seen_landmark',
            'last_seen_lat',
            'last_seen_lng',
            'reward_amount',
            'reward_note',
            'contact_name',
            'contact_phone',
            'contact_email',
            'contact_visibility',
            'notify_push',
            'notify_sms',
            'notify_email',
            'status',
            'found_message',
            'resolved_at',
            'is_active_search',
            'created_at',
            'updated_at',
        )
        read_only_fields = fields


class LostCatReportPhotoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = LostCatReportPhoto
        fields = (
            'id',
            'url',
            'is_main',
            'created_at',
        )
        read_only_fields = fields

    def get_url(self, photo) -> str | None:
        return build_report_photo_url(
            photo,
            request=self.context.get('request'),
        )


class LostCatReportPhotoUploadSerializer(serializers.Serializer):
    photo = serializers.ImageField(write_only=True)
    is_main = serializers.BooleanField(required=False, default=False)

    def validate_photo(self, value):
        try:
            validate_report_photo_upload(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class LostCatReportWriteSerializer(serializers.ModelSerializer):
    photo = serializers.ImageField(required=False, write_only=True)

    class Meta:
        model = LostCatReport
        fields = (
            'cat_name',
            'age_years',
            'breed',
            'coat_color',
            'eye_color',
            'gender',
            'collar_description',
            'has_microchip',
            'chip_number',
            'personality',
            'description',
            'disappeared_at',
            'last_seen_address',
            'last_seen_landmark',
            'last_seen_lat',
            'last_seen_lng',
            'reward_amount',
            'reward_note',
            'contact_name',
            'contact_phone',
            'contact_email',
            'contact_visibility',
            'notify_push',
            'notify_sms',
            'notify_email',
            'photo',
        )

    def validate_photo(self, value):
        try:
            validate_report_photo_upload(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def _value_from_attrs_or_instance(self, attrs, field_name, default=None):
        if field_name in attrs:
            return attrs[field_name]
        if self.instance is not None:
            return getattr(self.instance, field_name)
        return default

    def validate(self, attrs):
        has_microchip = self._value_from_attrs_or_instance(
            attrs,
            'has_microchip',
            False,
        )
        if not has_microchip:
            attrs['chip_number'] = ''

        lat = self._value_from_attrs_or_instance(attrs, 'last_seen_lat')
        lng = self._value_from_attrs_or_instance(attrs, 'last_seen_lng')
        if (lat is None) != (lng is None):
            raise serializers.ValidationError(
                {
                    'last_seen_location': [
                        'Provide both latitude and longitude, or leave both empty.'
                    ]
                }
            )

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        photo = validated_data.pop('photo', None)
        report = super().create(validated_data)
        if photo is not None:
            create_report_photo(report=report, image=photo, is_main=True)
        return report

    @transaction.atomic
    def update(self, instance, validated_data):
        photo = validated_data.pop('photo', None)
        report = super().update(instance, validated_data)
        if photo is not None:
            create_report_photo(report=report, image=photo, is_main=True)
        return report


class LostCatReportCreateSerializer(LostCatReportWriteSerializer):
    pass


class LostCatReportUpdateSerializer(LostCatReportWriteSerializer):
    pass


class LostCatReportStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=LostCatReport.Status.choices)
    found_message = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=FOUND_MESSAGE_MAX_LENGTH,
        trim_whitespace=True,
    )

    def validate_found_message(self, value):
        if PRIVATE_EMAIL_PATTERN.search(value) or contains_phone_like_text(value):
            raise serializers.ValidationError(
                'Do not include private email addresses or phone numbers.'
            )
        return value

    def validate(self, attrs):
        found_message = attrs.get('found_message', '')
        if found_message and attrs['status'] not in RESOLVED_REPORT_STATUSES:
            raise serializers.ValidationError(
                {
                    'found_message': [
                        'Found message can only be set when status is FOUND or CLOSED.'
                    ]
                }
            )
        return attrs


class LostCatReportTimelineActorSerializer(serializers.Serializer):
    display_name = serializers.CharField(read_only=True)
    avatar_fallback = serializers.CharField(read_only=True)


class LostCatReportTimelineEventSerializer(serializers.ModelSerializer):
    actor = serializers.SerializerMethodField()
    from_status = serializers.CharField(read_only=True)
    to_status = serializers.CharField(read_only=True)

    class Meta:
        model = LostCatReportTimelineEvent
        fields = (
            'id',
            'event_type',
            'from_status',
            'to_status',
            'location_summary',
            'actor',
            'created_at',
        )
        read_only_fields = fields

    def get_actor(self, timeline_event) -> dict[str, str] | None:
        actor = timeline_event.actor
        if actor is None:
            return None

        display_name = actor.display_name.strip() or 'CatSOS user'
        initials = [
            part[0].upper()
            for part in display_name.split()
            if part and part[0].isalpha()
        ]
        avatar_fallback = ''.join(initials[:2]) or display_name[:1].upper()

        return LostCatReportTimelineActorSerializer(
            {
                'display_name': display_name,
                'avatar_fallback': avatar_fallback,
            }
        ).data


class LostCatReportPublicTimelineEventSerializer(serializers.ModelSerializer):
    from_status = serializers.CharField(read_only=True)
    to_status = serializers.CharField(read_only=True)

    class Meta:
        model = LostCatReportTimelineEvent
        fields = (
            'event_type',
            'from_status',
            'to_status',
            'created_at',
        )
        read_only_fields = fields


class LostCatReportPublicSerializer(serializers.ModelSerializer):
    is_active_search = serializers.BooleanField(read_only=True)
    approximate_location = serializers.SerializerMethodField()
    contact = serializers.SerializerMethodField()
    latest_sighting = serializers.SerializerMethodField()
    main_photo = serializers.SerializerMethodField()
    photos = serializers.SerializerMethodField()
    timeline = serializers.SerializerMethodField()

    class Meta:
        model = LostCatReport
        fields = (
            'public_id',
            'cat_name',
            'age_years',
            'breed',
            'coat_color',
            'eye_color',
            'gender',
            'collar_description',
            'has_microchip',
            'personality',
            'description',
            'disappeared_at',
            'last_seen_landmark',
            'approximate_location',
            'reward_amount',
            'reward_note',
            'status',
            'found_message',
            'resolved_at',
            'is_active_search',
            'contact',
            'latest_sighting',
            'main_photo',
            'photos',
            'timeline',
            'updated_at',
        )
        read_only_fields = fields

    def get_approximate_location(self, report) -> dict[str, float | bool] | None:
        return build_approximate_location(report)

    def get_contact(self, report) -> dict[str, str]:
        if report.contact_visibility == LostCatReport.ContactVisibility.PUBLIC:
            return {
                'visibility': LostCatReport.ContactVisibility.PUBLIC,
                'name': report.contact_name,
                'phone': report.contact_phone,
                'email': report.contact_email,
                'instructions': 'Use these public contact details for urgent sightings.',
            }

        if report.contact_visibility == LostCatReport.ContactVisibility.APP_ONLY:
            instructions = 'Log in to CatSOS to submit a sighting.'
        else:
            instructions = 'Direct public contact details are hidden by the owner.'

        return {
            'visibility': report.contact_visibility,
            'instructions': instructions,
        }

    def get_latest_sighting(self, report) -> dict | None:
        return serialize_latest_confirmed_sighting(report)

    def get_main_photo(self, report) -> dict | None:
        return serialize_report_photo(
            get_report_main_photo(report),
            request=self.context.get('request'),
        )

    def get_photos(self, report) -> list[dict]:
        photos = []
        for photo in report.photos.all():
            photo_data = serialize_report_photo(
                photo,
                request=self.context.get('request'),
            )
            if photo_data is not None:
                photos.append(photo_data)
        return photos

    def get_timeline(self, report) -> list[dict]:
        timeline_events = report.timeline_events.order_by('created_at')[:20]
        return LostCatReportPublicTimelineEventSerializer(
            timeline_events,
            many=True,
        ).data


class LostCatReportPublicListSerializer(serializers.ModelSerializer):
    is_active_search = serializers.BooleanField(read_only=True)
    approximate_location = serializers.SerializerMethodField()
    detail_url = serializers.SerializerMethodField()
    latest_sighting = serializers.SerializerMethodField()
    location_summary = serializers.SerializerMethodField()
    main_photo = serializers.SerializerMethodField()

    class Meta:
        model = LostCatReport
        fields = (
            'public_id',
            'detail_url',
            'cat_name',
            'breed',
            'coat_color',
            'description',
            'disappeared_at',
            'location_summary',
            'last_seen_landmark',
            'approximate_location',
            'reward_amount',
            'status',
            'found_message',
            'resolved_at',
            'is_active_search',
            'latest_sighting',
            'main_photo',
            'updated_at',
        )
        read_only_fields = fields

    def get_approximate_location(self, report) -> dict[str, float | bool] | None:
        return build_approximate_location(report)

    def get_detail_url(self, report) -> str:
        return f'/api/public/reports/{report.public_id}/'

    def get_latest_sighting(self, report) -> dict | None:
        return serialize_latest_confirmed_sighting(report)

    def get_location_summary(self, report) -> str:
        if report.last_seen_landmark:
            return report.last_seen_landmark
        if report.last_seen_lat is not None and report.last_seen_lng is not None:
            return 'Approximate map location available'
        return ''

    def get_main_photo(self, report) -> dict | None:
        return serialize_report_photo(
            get_report_main_photo(report),
            request=self.context.get('request'),
        )


class LostCatReportSimilarReportSerializer(serializers.Serializer):
    report = LostCatReportPublicListSerializer(read_only=True)
    score = serializers.IntegerField(read_only=True)
    distance_km = serializers.FloatField(read_only=True, allow_null=True)
    reasons = serializers.ListField(
        child=serializers.CharField(),
        read_only=True,
    )
