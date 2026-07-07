import logging

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


def build_public_report_url(report) -> str:
    return f'{settings.FRONTEND_URL}/reports/{report.public_id}'


def build_sighting_location_summary(sighting) -> str:
    if sighting.location_description:
        return sighting.location_description
    return f'{sighting.latitude:.3f}, {sighting.longitude:.3f}'


def build_sighting_created_email(*, sighting) -> tuple[str, str]:
    report = sighting.report
    seen_at = sighting.seen_at
    if timezone.is_aware(seen_at):
        seen_at = timezone.localtime(seen_at)
    seen_at_text = seen_at.strftime('%Y-%m-%d %H:%M')
    report_url = build_public_report_url(report)
    subject = f'New sighting for {report.cat_name}'
    message = (
        f'A logged-in CatSOS helper submitted a sighting for {report.cat_name}.\n\n'
        f'Seen at: {seen_at_text}\n'
        f'Location: {build_sighting_location_summary(sighting)}\n'
        f'Confidence: {sighting.get_confidence_display()}\n\n'
        f'Review the report and sighting details here:\n{report_url}\n\n'
        'For privacy, this email does not include helper email, phone, '
        'internal user ID, or private notes.'
    )
    return subject, message


def should_send_sighting_created_email(*, sighting) -> bool:
    report = sighting.report
    owner = report.owner
    if not report.notify_email:
        return False
    if owner is None or not owner.email:
        return False
    return sighting.submitted_by_id != report.owner_id


def notify_owner_about_sighting_created(*, sighting) -> bool:
    if not should_send_sighting_created_email(sighting=sighting):
        return False

    report = sighting.report
    subject, message = build_sighting_created_email(sighting=sighting)
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[report.owner.email],
            fail_silently=False,
        )
    except Exception:
        logger.exception(
            'Failed to send sighting notification email.',
            extra={
                'report_id': str(report.id),
                'sighting_id': str(sighting.id),
            },
        )
        return False

    return True


def enqueue_sighting_created_notification(*, sighting) -> None:
    transaction.on_commit(
        lambda: notify_owner_about_sighting_created(sighting=sighting)
    )
