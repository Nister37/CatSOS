from rest_framework import serializers

from .models import LostCatReport, LostCatReportTimelineEvent


class LostCatReportOwnerSerializer(serializers.ModelSerializer):
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
