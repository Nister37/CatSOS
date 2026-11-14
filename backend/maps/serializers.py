from django.conf import settings
from rest_framework import serializers


class NearbyHelpQuerySerializer(serializers.Serializer):
    lat = serializers.FloatField(min_value=-90.0, max_value=90.0)
    lng = serializers.FloatField(min_value=-180.0, max_value=180.0)
    radius_km = serializers.FloatField(
        required=False,
        default=None,
        min_value=1.0,
        max_value=30.0,
    )

    def validate_radius_km(self, value):
        if value is None:
            return getattr(settings, 'NEARBY_HELP_DEFAULT_RADIUS_KM', 10)
        max_radius = getattr(settings, 'NEARBY_HELP_MAX_RADIUS_KM', 30)
        if value > max_radius:
            raise serializers.ValidationError(
                f'Radius must not exceed {max_radius} km.'
            )
        return value


class NearbyHelpPlaceSerializer(serializers.Serializer):
    id = serializers.CharField(required=False)
    osm_id = serializers.IntegerField()
    osm_type = serializers.CharField()
    name = serializers.CharField(allow_blank=True)
    type = serializers.ChoiceField(choices=['vet', 'shelter', 'cat_cafe', 'pet_help'])
    lat = serializers.FloatField()
    lng = serializers.FloatField()
    distance_km = serializers.FloatField()
    phone = serializers.CharField(allow_blank=True)
    website = serializers.CharField(allow_blank=True)
    opening_hours = serializers.CharField(allow_blank=True)
    address = serializers.CharField(allow_blank=True)
    quality_score = serializers.IntegerField()

    def validate_website(self, value):
        if not value:
            return ''
        cleaned = value.strip()
        if not cleaned:
            return ''
        if not (cleaned.startswith('http://') or cleaned.startswith('https://')):
            raise serializers.ValidationError('Website must start with http:// or https://')
        return cleaned

    def to_representation(self, instance):
        data = super().to_representation(instance)
        website = data.get('website')
        if website:
            cleaned = website.strip()
            if not (cleaned.startswith('http://') or cleaned.startswith('https://')):
                data['website'] = ''
            else:
                data['website'] = cleaned
        return data


class NearbyHelpResponseSerializer(serializers.Serializer):
    places = NearbyHelpPlaceSerializer(many=True)
    warning = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    attribution = serializers.CharField()
