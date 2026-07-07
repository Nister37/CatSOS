from django.contrib.auth import get_user_model
from django.db import transaction

from .models import PointTransaction, UserBadge
from .rules import (
    BADGE_RULES,
    BADGE_RULES_BY_CODE,
    HELPFUL_REPORT_UPDATE,
    SIGHTING_MARKED_USEFUL,
    SIGHTING_SUBMITTED,
    VOLUNTEER_SEARCH_STARTED,
    get_badge_rules_for_points,
    get_point_rule,
)


def _is_awardable_user(user):
    return user is not None and getattr(user, 'is_authenticated', True)


def _is_owner_self_action(*, user, report):
    return report is not None and user is not None and report.owner_id == user.pk


def _normalize_public_badges(value):
    if not isinstance(value, list):
        return []

    badges = []
    for badge in value:
        if not isinstance(badge, str):
            continue
        badge = badge.strip()
        if badge and badge not in badges:
            badges.append(badge)
    return badges


def _sync_public_badges(user):
    earned_badges = {
        badge.code: badge.label
        for badge in UserBadge.objects.filter(user=user)
    }
    earned_rule_labels = [
        earned_badges[rule.code]
        for rule in BADGE_RULES
        if rule.code in earned_badges
    ]
    point_rule_labels = {rule.label for rule in BADGE_RULES}
    existing_public_badges = [
        badge
        for badge in _normalize_public_badges(user.public_badges)
        if badge not in point_rule_labels
    ]
    public_badges = existing_public_badges + earned_rule_labels

    if user.public_badges != public_badges:
        user.public_badges = public_badges
        user.save(update_fields=('public_badges',))


def _award_eligible_badges(user):
    awarded_badges = []
    for rule in get_badge_rules_for_points(user.contribution_points):
        badge, created = UserBadge.objects.get_or_create(
            user=user,
            code=rule.code,
            defaults={'label': rule.label},
        )
        if created:
            awarded_badges.append(badge)

    _sync_public_badges(user)
    return awarded_badges


@transaction.atomic
def award_points(*, user, reason, idempotency_key, description='', metadata=None):
    if not _is_awardable_user(user):
        return None, []

    existing_transaction = PointTransaction.objects.filter(
        idempotency_key=idempotency_key,
    ).first()
    if existing_transaction is not None:
        return existing_transaction, []

    User = get_user_model()
    locked_user = User.objects.select_for_update().get(pk=user.pk)
    existing_transaction = PointTransaction.objects.filter(
        idempotency_key=idempotency_key,
    ).first()
    if existing_transaction is not None:
        return existing_transaction, []

    rule = get_point_rule(reason)
    point_transaction = PointTransaction.objects.create(
        user=locked_user,
        reason=reason,
        points=rule.points,
        idempotency_key=idempotency_key,
        description=description or rule.label,
        metadata=metadata or {},
    )
    locked_user.contribution_points += rule.points
    locked_user.save(update_fields=('contribution_points',))
    awarded_badges = _award_eligible_badges(locked_user)

    return point_transaction, awarded_badges


def award_sighting_submitted_points(*, sighting):
    if _is_owner_self_action(user=sighting.submitted_by, report=sighting.report):
        return None, []

    return award_points(
        user=sighting.submitted_by,
        reason=SIGHTING_SUBMITTED,
        idempotency_key=f'sighting:{sighting.pk}:submitted',
        description='Sighting submitted',
        metadata={
            'sighting_id': str(sighting.pk),
            'report_id': str(sighting.report_id),
        },
    )


def award_sighting_marked_useful_points(*, sighting):
    if _is_owner_self_action(user=sighting.submitted_by, report=sighting.report):
        return None, []

    return award_points(
        user=sighting.submitted_by,
        reason=SIGHTING_MARKED_USEFUL,
        idempotency_key=f'sighting:{sighting.pk}:marked-useful',
        description='Sighting marked useful',
        metadata={
            'sighting_id': str(sighting.pk),
            'report_id': str(sighting.report_id),
        },
    )


def award_volunteer_search_started_points(*, volunteer_search):
    if _is_owner_self_action(
        user=volunteer_search.volunteer,
        report=volunteer_search.report,
    ):
        return None, []

    return award_points(
        user=volunteer_search.volunteer,
        reason=VOLUNTEER_SEARCH_STARTED,
        idempotency_key=f'volunteer-search:{volunteer_search.pk}:started',
        description='Volunteer search started',
        metadata={
            'volunteer_search_id': str(volunteer_search.pk),
            'report_id': str(volunteer_search.report_id),
        },
    )


def award_helpful_report_update_points(*, report, user, update_key):
    return award_points(
        user=user,
        reason=HELPFUL_REPORT_UPDATE,
        idempotency_key=f'report:{report.pk}:helpful-update:{update_key}',
        description='Helpful report update',
        metadata={'report_id': str(report.pk), 'update_key': str(update_key)},
    )
