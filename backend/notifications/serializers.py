from rest_framework import serializers

from .models import InAppNotification


class InAppNotificationSerializer(serializers.ModelSerializer):
    report = serializers.SerializerMethodField()

    class Meta:
        model = InAppNotification
        fields = (
            'id',
            'event_type',
            'title',
            'message',
            'action_url',
            'report',
            'is_read',
            'read_at',
            'created_at',
        )
        read_only_fields = fields

    def get_report(self, notification) -> dict[str, str] | None:
        report = notification.report
        if report is None:
            return None

        return {
            'public_id': str(report.public_id),
            'cat_name': report.cat_name,
        }
