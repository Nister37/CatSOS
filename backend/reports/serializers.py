from rest_framework import serializers

from .models import LostCatReport


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


class LostCatReportCreateSerializer(serializers.ModelSerializer):
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

    def validate(self, attrs):
        has_microchip = attrs.get('has_microchip', False)
        if not has_microchip and attrs.get('chip_number'):
            attrs['chip_number'] = ''

        lat = attrs.get('last_seen_lat')
        lng = attrs.get('last_seen_lng')
        if (lat is None) != (lng is None):
            raise serializers.ValidationError(
                {
                    'last_seen_location': [
                        'Provide both latitude and longitude, or leave both empty.'
                    ]
                }
            )

        return attrs
