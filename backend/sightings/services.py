from django.db import transaction
from django.utils import timezone

from reports.models import LostCatReportTimelineEvent
from .models import Sighting, SightingPhoto


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
    return sighting


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
    return sighting
