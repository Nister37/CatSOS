from django.db import transaction

from .models import LostCatReport, LostCatReportTimelineEvent


def build_report_location_summary(report):
    return report.last_seen_landmark or report.last_seen_address


@transaction.atomic
def change_report_status(*, report, actor, new_status):
    old_status = report.status
    if old_status == new_status:
        return report, None

    report.status = new_status
    report.save(update_fields=('status', 'updated_at'))

    timeline_event = LostCatReportTimelineEvent.objects.create(
        report=report,
        actor=actor,
        event_type=LostCatReportTimelineEvent.EventType.STATUS_CHANGED,
        from_status=old_status,
        to_status=new_status,
        location_summary=build_report_location_summary(report),
    )

    return report, timeline_event
