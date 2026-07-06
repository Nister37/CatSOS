from django.db import transaction

from reports.models import LostCatReportTimelineEvent

from .models import Sighting


def build_sighting_location_summary(sighting):
    if sighting.location_description:
        return sighting.location_description
    return f'{sighting.latitude:.3f}, {sighting.longitude:.3f}'


@transaction.atomic
def create_sighting(*, report, submitted_by, validated_data):
    sighting = Sighting.objects.create(
        report=report,
        submitted_by=submitted_by,
        **validated_data,
    )
    LostCatReportTimelineEvent.objects.create(
        report=report,
        actor=submitted_by,
        event_type=LostCatReportTimelineEvent.EventType.SIGHTING_CREATED,
        location_summary=build_sighting_location_summary(sighting),
    )
    return sighting
