from rest_framework import serializers

from reports.models import LostCatReport
from sightings.models import Sighting


class AdminReportModerationSerializer(serializers.Serializer):
    moderation_status = serializers.ChoiceField(
        choices=LostCatReport.ModerationStatus.choices,
    )
    moderation_notes = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=2000,
        trim_whitespace=True,
    )


class AdminReportListSerializer(serializers.ModelSerializer):
    owner_email = serializers.EmailField(source='owner.email', read_only=True)
    photo_count = serializers.SerializerMethodField()

    class Meta:
        model = LostCatReport
        fields = (
            'id',
            'public_id',
            'cat_name',
            'status',
            'moderation_status',
            'moderation_notes',
            'owner_email',
            'photo_count',
            'created_at',
            'updated_at',
        )
        read_only_fields = fields

    def get_photo_count(self, report) -> int:
        return report.photos.count()


class AdminSightingModerationSerializer(serializers.Serializer):
    verification_status = serializers.ChoiceField(
        choices=Sighting.VerificationStatus.choices,
    )


class AdminStatsSerializer(serializers.Serializer):
    total_reports = serializers.IntegerField(read_only=True)
    active_reports = serializers.IntegerField(read_only=True)
    total_sightings = serializers.IntegerField(read_only=True)
    total_users = serializers.IntegerField(read_only=True)
    reports_under_review = serializers.IntegerField(read_only=True)
