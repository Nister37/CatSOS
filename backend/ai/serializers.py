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


class PublicSummaryRequestSerializer(serializers.Serializer):
    cat_name = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )
    coat_color = serializers.CharField(
        max_length=120,
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )
    personality = serializers.CharField(
        max_length=1000,
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )
    last_seen_landmark = serializers.CharField(
        max_length=180,
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )
    description = serializers.CharField(
        max_length=5000,
        trim_whitespace=True,
    )

    def validate_description(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError(
                'Provide at least 10 characters to summarize.'
            )
        return value


class PublicSummaryResponseSerializer(serializers.Serializer):
    suggestion = serializers.CharField()
    generated_by_ai = serializers.BooleanField()
    requires_review = serializers.BooleanField()
    fallback_reason = serializers.CharField(allow_blank=True)
    privacy_notice = serializers.CharField()
