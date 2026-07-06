from django.db import transaction
from django.utils import timezone

from .models import LostCatReport, LostCatReportTimelineEvent

RESOLVED_REPORT_STATUSES = {
    LostCatReport.Status.FOUND,
    LostCatReport.Status.CLOSED,
}


def build_report_location_summary(report):
    return report.last_seen_landmark or report.last_seen_address


@transaction.atomic
def change_report_status(*, report, actor, new_status, found_message=None):
    old_status = report.status
    update_fields = {'status', 'updated_at'}
    is_resolved_status = new_status in RESOLVED_REPORT_STATUSES

    if is_resolved_status:
        if report.resolved_at is None:
            report.resolved_at = timezone.now()
            update_fields.add('resolved_at')
        if found_message is not None and report.found_message != found_message:
            report.found_message = found_message
            update_fields.add('found_message')
    else:
        if report.resolved_at is not None:
            report.resolved_at = None
            update_fields.add('resolved_at')
        if report.found_message:
            report.found_message = ''
            update_fields.add('found_message')

    if old_status == new_status and update_fields == {'status', 'updated_at'}:
        return report, None

    report.status = new_status
    report.save(update_fields=tuple(update_fields))

    if old_status == new_status:
        return report, None

    timeline_event = LostCatReportTimelineEvent.objects.create(
        report=report,
        actor=actor,
        event_type=LostCatReportTimelineEvent.EventType.STATUS_CHANGED,
        from_status=old_status,
        to_status=new_status,
        location_summary=build_report_location_summary(report),
    )

    return report, timeline_event
