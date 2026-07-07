from rest_framework import serializers

from sightings.serializers import build_user_summary

from .models import InAppNotification


class InAppNotificationSerializer(serializers.ModelSerializer):
    report = serializers.SerializerMethodField()
    sighting = serializers.SerializerMethodField()
    actor = serializers.SerializerMethodField()

    class Meta:
        model = InAppNotification
        fields = (
            'id',
            'event_type',
            'title',
            'message',
            'action_url',
            'report',
            'sighting',
            'actor',
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
            'id': str(report.id),
            'public_id': str(report.public_id),
            'cat_name': report.cat_name,
        }

    def get_sighting(self, notification) -> dict[str, str] | None:
        sighting = notification.sighting
        if sighting is None:
            return None

        return {
            'id': str(sighting.id),
            'seen_at': sighting.seen_at.isoformat(),
            'location_description': sighting.location_description or '',
            'confidence': sighting.confidence,
            'verification_status': sighting.verification_status,
        }

    def get_actor(self, notification) -> dict[str, str] | None:
        return build_user_summary(notification.actor)
