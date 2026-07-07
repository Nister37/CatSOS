from rest_framework import serializers


class DescriptionImproveRequestSerializer(serializers.Serializer):
    description = serializers.CharField(
        max_length=5000,
        trim_whitespace=True,
    )

    def validate_description(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError(
                'Provide at least 10 characters to improve.'
            )
        return value


class DescriptionImproveResponseSerializer(serializers.Serializer):
    suggestion = serializers.CharField()
    generated_by_ai = serializers.BooleanField()
    requires_review = serializers.BooleanField()
    fallback_reason = serializers.CharField(allow_blank=True)
    privacy_notice = serializers.CharField()
