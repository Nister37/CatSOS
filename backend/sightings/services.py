from django.db import transaction
from django.utils import timezone

from notifications.services import (
    enqueue_sighting_created_notification,
    enqueue_sighting_verification_notification,
)
from points.services import (
    award_sighting_marked_useful_points,
    award_sighting_submitted_points,
    award_trusted_reporter_badge_for_useful_sighting,
    award_volunteer_search_started_points,
)
from reports.models import LostCatReportTimelineEvent

from .models import Sighting, SightingPhoto, VolunteerSearch


def build_sighting_location_summary(sighting):
    if sighting.location_description:
        return sighting.location_description
    return f'{sighting.latitude:.3f}, {sighting.longitude:.3f}'


@transaction.atomic
def create_sighting(*, report, submitted_by, validated_data, photo=None):
    sighting = Sighting.objects.create(
        report=report,
        submitted_by=submitted_by,
        **validated_data,
    )
    if photo is not None:
        SightingPhoto.objects.create(
            sighting=sighting,
            uploaded_by=submitted_by,
            image=photo,
        )
    LostCatReportTimelineEvent.objects.create(
        report=report,
        actor=submitted_by,
        event_type=LostCatReportTimelineEvent.EventType.SIGHTING_CREATED,
        location_summary=build_sighting_location_summary(sighting),
    )
    award_sighting_submitted_points(sighting=sighting)
    enqueue_sighting_created_notification(sighting=sighting)
    return sighting


def build_report_location_summary(report):
    if report.last_seen_landmark:
        return report.last_seen_landmark
    if report.last_seen_lat is not None and report.last_seen_lng is not None:
        return f'{report.last_seen_lat:.3f}, {report.last_seen_lng:.3f}'
    return ''


@transaction.atomic
def mark_volunteer_searching(*, report, volunteer):
    volunteer_search, created = VolunteerSearch.objects.get_or_create(
        report=report,
        volunteer=volunteer,
    )
    if created:
        LostCatReportTimelineEvent.objects.create(
            report=report,
            actor=volunteer,
            event_type=LostCatReportTimelineEvent.EventType.VOLUNTEER_SEARCH_STARTED,
            location_summary=build_report_location_summary(report),
        )
        award_volunteer_search_started_points(volunteer_search=volunteer_search)
    else:
        volunteer_search.save(update_fields=('updated_at',))

    return volunteer_search, created


@transaction.atomic
def update_sighting_verification(*, sighting, actor, verification_status):
    previous_status = sighting.verification_status
    sighting.verification_status = verification_status
    update_fields = {'verification_status', 'updated_at'}

    if verification_status == Sighting.VerificationStatus.PENDING:
        sighting.verified_by = None
        sighting.verified_at = None
    else:
        sighting.verified_by = actor
        sighting.verified_at = timezone.now()
    update_fields.update({'verified_by', 'verified_at'})

    sighting.save(update_fields=tuple(update_fields))
    if previous_status != verification_status:
        event_type_by_status = {
            Sighting.VerificationStatus.USEFUL: (
                LostCatReportTimelineEvent.EventType.SIGHTING_MARKED_USEFUL
            ),
            Sighting.VerificationStatus.FALSE: (
                LostCatReportTimelineEvent.EventType.SIGHTING_MARKED_FALSE
            ),
        }
        event_type = event_type_by_status.get(verification_status)
        if event_type is not None:
            LostCatReportTimelineEvent.objects.create(
                report=sighting.report,
                actor=actor,
                event_type=event_type,
                location_summary=build_sighting_location_summary(sighting),
            )
            if verification_status == Sighting.VerificationStatus.USEFUL:
                award_sighting_marked_useful_points(sighting=sighting)
                award_trusted_reporter_badge_for_useful_sighting(sighting=sighting)
            enqueue_sighting_verification_notification(
                sighting=sighting,
                actor=actor,
            )
    return sighting
