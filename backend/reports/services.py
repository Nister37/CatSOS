from math import asin, cos, radians, sin, sqrt

from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone

from notifications.services import enqueue_report_created_notification

from .models import LostCatReport, LostCatReportPhoto, LostCatReportTimelineEvent

RESOLVED_REPORT_STATUSES = {
    LostCatReport.Status.FOUND,
    LostCatReport.Status.CLOSED,
}
ACTIVE_REPORT_STATUSES = {
    LostCatReport.Status.MISSING,
    LostCatReport.Status.RECENTLY_SEEN,
}
SIMILAR_REPORT_CANDIDATE_LIMIT = 200
SIMILAR_REPORT_RESULT_LIMIT = 5


@transaction.atomic
def create_report_photo(*, report, image, is_main=False):
    should_make_main = is_main or not LostCatReportPhoto.objects.filter(
        report=report,
    ).exists()
    if should_make_main:
        LostCatReportPhoto.objects.filter(report=report, is_main=True).update(
            is_main=False,
        )

    return LostCatReportPhoto.objects.create(
        report=report,
        image=image,
        is_main=should_make_main,
    )


@transaction.atomic
def set_main_report_photo(*, photo):
    LostCatReportPhoto.objects.filter(
        report=photo.report,
        is_main=True,
    ).exclude(pk=photo.pk).update(is_main=False)

    if not photo.is_main:
        photo.is_main = True
        photo.save(update_fields=('is_main',))

    return photo


@transaction.atomic
def delete_report_photo(*, photo):
    report = photo.report
    image_name = photo.image.name
    was_main = photo.is_main

    photo.delete()

    if was_main:
        replacement = LostCatReportPhoto.objects.filter(report=report).first()
        if replacement is not None:
            set_main_report_photo(photo=replacement)

    if image_name:
        transaction.on_commit(lambda: default_storage.delete(image_name))


def _has_location(report):
    return report.last_seen_lat is not None and report.last_seen_lng is not None


def calculate_distance_km(first_report, second_report):
    if not _has_location(first_report) or not _has_location(second_report):
        return None

    earth_radius_km = 6371.0
    lat1 = radians(first_report.last_seen_lat)
    lng1 = radians(first_report.last_seen_lng)
    lat2 = radians(second_report.last_seen_lat)
    lng2 = radians(second_report.last_seen_lng)

    delta_lat = lat2 - lat1
    delta_lng = lng2 - lng1
    haversine = (
        sin(delta_lat / 2) ** 2
        + cos(lat1) * cos(lat2) * sin(delta_lng / 2) ** 2
    )
    return 2 * earth_radius_km * asin(sqrt(haversine))


def _normalized_words(value):
    return {
        word
        for word in (value or '').lower().replace(',', ' ').split()
        if len(word) >= 3
    }


def _score_similar_report(report, candidate):
    score = 0
    reasons = []
    distance_km = calculate_distance_km(report, candidate)

    if distance_km is not None:
        if distance_km <= 5:
            score += 5
            reasons.append('nearby')
        elif distance_km <= 15:
            score += 3
            reasons.append('same area')
        elif distance_km <= 30:
            score += 1
            reasons.append('regional match')

    if report.breed and candidate.breed:
        if report.breed.strip().lower() == candidate.breed.strip().lower():
            score += 2
            reasons.append('same breed')

    shared_coat_words = _normalized_words(report.coat_color) & _normalized_words(
        candidate.coat_color,
    )
    if shared_coat_words:
        score += 2
        reasons.append('similar coat')

    if (
        report.gender != LostCatReport.Gender.UNKNOWN
        and report.gender == candidate.gender
    ):
        score += 1
        reasons.append('same gender')

    return {
        'report': candidate,
        'score': score,
        'distance_km': None if distance_km is None else round(distance_km, 2),
        'reasons': reasons,
    }


def find_similar_reports(*, report, limit=SIMILAR_REPORT_RESULT_LIMIT):
    candidates = (
        LostCatReport.objects.exclude(pk=report.pk)
        .exclude(moderation_status=LostCatReport.ModerationStatus.HIDDEN)
        .filter(status__in=ACTIVE_REPORT_STATUSES)
        .order_by('-updated_at')[:SIMILAR_REPORT_CANDIDATE_LIMIT]
    )
    scored_candidates = [
        result
        for result in (_score_similar_report(report, candidate) for candidate in candidates)
        if result['score'] > 0
    ]
    scored_candidates.sort(
        key=lambda result: (
            -result['score'],
            result['distance_km'] is None,
            result['distance_km'] if result['distance_km'] is not None else 999999,
            -result['report'].updated_at.timestamp(),
        )
    )
    return scored_candidates[:limit]


def build_report_location_summary(report):
    return report.last_seen_landmark or report.last_seen_address


def create_report_created_timeline_event(*, report, actor):
    return LostCatReportTimelineEvent.objects.create(
        report=report,
        actor=actor,
        event_type=LostCatReportTimelineEvent.EventType.REPORT_CREATED,
        location_summary=build_report_location_summary(report),
    )


def handle_report_created(*, report, actor):
    timeline_event = create_report_created_timeline_event(
        report=report,
        actor=actor,
    )
    enqueue_report_created_notification(report=report)
    return timeline_event


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
