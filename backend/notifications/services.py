import logging

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from .models import InAppNotification

logger = logging.getLogger(__name__)


def build_public_report_url(report) -> str:
    return f'{settings.FRONTEND_URL}/reports/{report.public_id}'


def build_report_action_url(report) -> str:
    return f'/my-reports/{report.id}'


def build_sighting_location_summary(sighting) -> str:
    if sighting.location_description:
        return sighting.location_description
    return f'{sighting.latitude:.3f}, {sighting.longitude:.3f}'


def build_report_created_email(*, report) -> tuple[str, str]:
    report_url = build_public_report_url(report)
    subject = f'CatSOS report published for {report.cat_name}'
    message = (
        f'Your lost-cat report for {report.cat_name} is published on CatSOS.\n\n'
        f'Public report link:\n{report_url}\n\n'
        'Share this link or use it on QR posters so helpers can view the public '
        'report and submit accountable sightings.\n\n'
        'For privacy, this confirmation does not include exact address, chip '
        'number, contact phone, or contact email.'
    )
    return subject, message


def get_report_status_label(report, status) -> str:
    try:
        return report.Status(status).label
    except ValueError:
        return status


def build_report_status_changed_email(
    *,
    report,
    old_status,
    new_status,
) -> tuple[str, str]:
    old_status_label = get_report_status_label(report, old_status)
    new_status_label = get_report_status_label(report, new_status)
    report_url = build_public_report_url(report)
    subject = f'CatSOS report status changed for {report.cat_name}'
    message = (
        f'The status for {report.cat_name} changed from '
        f'{old_status_label} to {new_status_label}.\n\n'
        f'Public report link:\n{report_url}\n\n'
        'For privacy, this notification does not include exact address, chip '
        'number, contact phone, or contact email.'
    )
    return subject, message


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


def user_allows_email_notification(*, user, preference_field) -> bool:
    return bool(getattr(user, preference_field, True))


def should_send_report_created_email(*, report) -> bool:
    owner = report.owner
    if owner is None or not owner.email:
        return False
    return user_allows_email_notification(
        user=owner,
        preference_field='notify_report_created_email',
    )


def should_send_sighting_created_email(*, sighting) -> bool:
    report = sighting.report
    owner = report.owner
    if not report.notify_email:
        return False
    if owner is None or not owner.email:
        return False
    if not user_allows_email_notification(
        user=owner,
        preference_field='notify_sighting_created_email',
    ):
        return False
    return sighting.submitted_by_id != report.owner_id


def should_send_report_status_changed_email(*, report) -> bool:
    owner = report.owner
    if not report.notify_email:
        return False
    if owner is None or not owner.email:
        return False
    return user_allows_email_notification(
        user=owner,
        preference_field='notify_report_status_changed_email',
    )


def user_can_receive_in_app_notification(user) -> bool:
    return user is not None and user.is_active


def create_in_app_notification(
    *,
    recipient,
    event_type,
    title,
    message,
    actor=None,
    report=None,
    sighting=None,
    action_url='',
):
    if not user_can_receive_in_app_notification(recipient):
        return None

    return InAppNotification.objects.create(
        recipient=recipient,
        actor=actor,
        report=report,
        sighting=sighting,
        event_type=event_type,
        title=title,
        message=message,
        action_url=action_url,
    )


def create_report_created_in_app_notification(*, report, actor=None):
    if not report.notify_push:
        return None

    return create_in_app_notification(
        recipient=report.owner,
        actor=actor,
        report=report,
        event_type=InAppNotification.EventType.REPORT_CREATED,
        title=f'Report published for {report.cat_name}',
        message='Your lost-cat report is live and ready to share.',
        action_url=build_report_action_url(report),
    )


def create_report_status_changed_in_app_notification(
    *,
    report,
    old_status,
    new_status,
    actor=None,
):
    if not report.notify_push:
        return None

    old_status_label = get_report_status_label(report, old_status)
    new_status_label = get_report_status_label(report, new_status)
    return create_in_app_notification(
        recipient=report.owner,
        actor=actor,
        report=report,
        event_type=InAppNotification.EventType.REPORT_STATUS_CHANGED,
        title=f'Status changed for {report.cat_name}',
        message=f'{old_status_label} changed to {new_status_label}.',
        action_url=build_report_action_url(report),
    )


def create_sighting_created_in_app_notification(*, sighting):
    report = sighting.report
    if not report.notify_push:
        return None
    if sighting.submitted_by_id == report.owner_id:
        return None

    return create_in_app_notification(
        recipient=report.owner,
        actor=sighting.submitted_by,
        report=report,
        sighting=sighting,
        event_type=InAppNotification.EventType.SIGHTING_CREATED,
        title=f'New sighting for {report.cat_name}',
        message='A logged-in helper submitted a new sighting.',
        action_url=build_report_action_url(report),
    )


def create_sighting_verification_in_app_notification(*, sighting, actor=None):
    if sighting.submitted_by is None:
        return None
    if actor is not None and sighting.submitted_by_id == actor.id:
        return None

    event_type_by_status = {
        sighting.VerificationStatus.USEFUL: (
            InAppNotification.EventType.SIGHTING_MARKED_USEFUL
        ),
        sighting.VerificationStatus.FALSE: (
            InAppNotification.EventType.SIGHTING_MARKED_FALSE
        ),
    }
    event_type = event_type_by_status.get(sighting.verification_status)
    if event_type is None:
        return None

    status_label = sighting.get_verification_status_display().lower()
    return create_in_app_notification(
        recipient=sighting.submitted_by,
        actor=actor,
        report=sighting.report,
        sighting=sighting,
        event_type=event_type,
        title=f'Your sighting was marked {status_label}',
        message=f'Thank you for helping with {sighting.report.cat_name}.',
        action_url=build_report_action_url(sighting.report),
    )


def notify_owner_about_report_created(*, report) -> bool:
    if not should_send_report_created_email(report=report):
        return False

    subject, message = build_report_created_email(report=report)
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
            'Failed to send report creation confirmation email.',
            extra={'report_id': str(report.id)},
        )
        return False

    return True


def notify_owner_about_report_status_changed(
    *,
    report,
    old_status,
    new_status,
) -> bool:
    if not should_send_report_status_changed_email(report=report):
        return False

    subject, message = build_report_status_changed_email(
        report=report,
        old_status=old_status,
        new_status=new_status,
    )
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
            'Failed to send report status change notification email.',
            extra={
                'report_id': str(report.id),
                'old_status': old_status,
                'new_status': new_status,
            },
        )
        return False

    return True


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


def enqueue_report_created_notification(*, report, actor=None) -> None:
    transaction.on_commit(lambda: notify_owner_about_report_created(report=report))
    transaction.on_commit(
        lambda: create_report_created_in_app_notification(
            report=report,
            actor=actor,
        )
    )


def enqueue_report_status_changed_notification(
    *,
    report,
    old_status,
    new_status,
    actor=None,
) -> None:
    transaction.on_commit(
        lambda: notify_owner_about_report_status_changed(
            report=report,
            old_status=old_status,
            new_status=new_status,
        )
    )
    transaction.on_commit(
        lambda: create_report_status_changed_in_app_notification(
            report=report,
            old_status=old_status,
            new_status=new_status,
            actor=actor,
        )
    )


def enqueue_sighting_created_notification(*, sighting) -> None:
    transaction.on_commit(
        lambda: notify_owner_about_sighting_created(sighting=sighting)
    )
    transaction.on_commit(
        lambda: create_sighting_created_in_app_notification(sighting=sighting)
    )


def enqueue_sighting_verification_notification(*, sighting, actor=None) -> None:
    transaction.on_commit(
        lambda: create_sighting_verification_in_app_notification(
            sighting=sighting,
            actor=actor,
        )
    )
