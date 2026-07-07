# Community Points and Badges

CAT-068 defines the backend source of truth for MVP community point and badge
rules. CAT-069 wires the core helper actions into those rules.

## Point Rules

| Reason | Points | When it should be awarded |
| --- | ---: | --- |
| `SIGHTING_SUBMITTED` | 5 | A logged-in helper submits a sighting for an active report. |
| `SIGHTING_MARKED_USEFUL` | 15 | An owner or staff member marks a helper sighting as useful. |
| `VOLUNTEER_SEARCH_STARTED` | 2 | A logged-in helper marks that they are searching nearby. |
| `HELPFUL_REPORT_UPDATE` | 3 | An owner keeps a report current with a meaningful update. |

Each award creates one `PointTransaction` with a stable `idempotency_key`, so
retries or repeated workflow calls cannot double-award the same action.

## Point Threshold Badge Rules

Most badges are threshold based for the MVP. They should be granted when a
user's total `contribution_points` reaches the threshold.

| Code | Label | Minimum points |
| --- | --- | ---: |
| `FIRST_HELP` | First help | 5 |
| `NEIGHBOR_HELPER` | Neighbor helper | 25 |
| `SEARCH_REGULAR` | Search regular | 75 |
| `TRUSTED_HELPER` | Trusted helper | 150 |

## Special Badge Rules

| Code | Label | When it should be awarded |
| --- | --- | --- |
| `TRUSTED_REPORTER` | Trusted reporter | A helper has at least 3 sightings marked useful. |

`UserBadge` stores normalized badge awards. The existing `User.public_badges`
field is synchronized with safe badge labels so current public profile responses
can show earned badges without exposing transaction metadata.

## Security and Privacy

- Points are only for authenticated user actions.
- Owners do not receive helper points for sightings or volunteer search actions
on their own reports.
- Owners do not receive the trusted reporter badge for sightings on their own
reports.
- No private report, sighting, or contact data is stored in rule definitions.
- Award metadata stores internal object IDs or aggregate counts only.
- Public profile responses should expose only safe badge labels, not internal
transaction metadata or idempotency keys.
- Admins can inspect transactions and badge awards through Django Admin.

## Leaderboard API

`GET /api/points/leaderboard/` returns a paginated public-safe leaderboard of
active, email-verified users with at least one contribution point.

Each result includes:

- `rank`
- `id`
- `display_name`
- `profile_picture_url`
- `avatar_fallback`
- `points`
- `badges`

The endpoint does not expose private emails, private phone numbers, point
transaction metadata, idempotency keys, or account verification data.
