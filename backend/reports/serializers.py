import re

from rest_framework import serializers

from .models import LostCatReport, LostCatReportTimelineEvent

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


class LostCatReportOwnerSerializer(serializers.ModelSerializer):
    is_active_search = serializers.BooleanField(read_only=True)

    class Meta:
        model = LostCatReport
        fields = (
            'id',
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


class LostCatReportWriteSerializer(serializers.ModelSerializer):
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
        )

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
