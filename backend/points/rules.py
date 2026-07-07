from dataclasses import dataclass


@dataclass(frozen=True)
class PointRule:
    reason: str
    label: str
    points: int
    description: str


@dataclass(frozen=True)
class BadgeRule:
    code: str
    label: str
    minimum_points: int | None
    description: str
    is_point_threshold: bool = True


SIGHTING_SUBMITTED = 'SIGHTING_SUBMITTED'
SIGHTING_MARKED_USEFUL = 'SIGHTING_MARKED_USEFUL'
VOLUNTEER_SEARCH_STARTED = 'VOLUNTEER_SEARCH_STARTED'
HELPFUL_REPORT_UPDATE = 'HELPFUL_REPORT_UPDATE'
TRUSTED_REPORTER = 'TRUSTED_REPORTER'
TRUSTED_REPORTER_USEFUL_SIGHTING_COUNT = 3


POINT_RULES = (
    PointRule(
        reason=SIGHTING_SUBMITTED,
        label='Sighting submitted',
        points=5,
        description='Logged-in helper submits a sighting for an active report.',
    ),
    PointRule(
        reason=SIGHTING_MARKED_USEFUL,
        label='Sighting marked useful',
        points=15,
        description='Owner or staff marks a helper sighting as useful.',
    ),
    PointRule(
        reason=VOLUNTEER_SEARCH_STARTED,
        label='Volunteer search started',
        points=2,
        description='Logged-in helper marks that they are searching nearby.',
    ),
    PointRule(
        reason=HELPFUL_REPORT_UPDATE,
        label='Helpful report update',
        points=3,
        description='Owner keeps a report current with a meaningful update.',
    ),
)

POINT_RULES_BY_REASON = {rule.reason: rule for rule in POINT_RULES}
POINT_RULE_CHOICES = tuple((rule.reason, rule.label) for rule in POINT_RULES)


BADGE_RULES = (
    BadgeRule(
        code='FIRST_HELP',
        label='First help',
        minimum_points=5,
        description='Earned after the first useful community action.',
    ),
    BadgeRule(
        code='NEIGHBOR_HELPER',
        label='Neighbor helper',
        minimum_points=25,
        description='Earned after repeated search support.',
    ),
    BadgeRule(
        code='SEARCH_REGULAR',
        label='Search regular',
        minimum_points=75,
        description='Earned by consistently helping lost-cat searches.',
    ),
    BadgeRule(
        code='TRUSTED_HELPER',
        label='Trusted helper',
        minimum_points=150,
        description='Earned by high-signal, sustained community help.',
    ),
    BadgeRule(
        code=TRUSTED_REPORTER,
        label='Trusted reporter',
        minimum_points=None,
        description='Earned after repeated sightings are marked useful.',
        is_point_threshold=False,
    ),
)

BADGE_RULES_BY_CODE = {rule.code: rule for rule in BADGE_RULES}
BADGE_RULE_CHOICES = tuple((rule.code, rule.label) for rule in BADGE_RULES)
POINT_THRESHOLD_BADGE_RULES = tuple(
    rule
    for rule in BADGE_RULES
    if rule.is_point_threshold
)


def get_point_rule(reason):
    return POINT_RULES_BY_REASON[reason]


def get_badge_rule(code):
    return BADGE_RULES_BY_CODE[code]


def get_badge_rules_for_points(total_points):
    return tuple(
        rule
        for rule in POINT_THRESHOLD_BADGE_RULES
        if total_points >= rule.minimum_points
    )


def get_public_badge_labels_for_points(total_points):
    return [
        rule.label
        for rule in get_badge_rules_for_points(total_points)
    ]
