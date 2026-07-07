# Reports API

## Similar Report Suggestions

`GET /api/reports/{id}/similar/`

Authentication is required. The authenticated user must own the source report.
The endpoint returns possible duplicate or related active reports so the owner
can compare cases after creating or reviewing a report.

Request body: none.

Response:

```json
{
  "count": 1,
  "results": [
    {
      "report": {
        "public_id": "00000000-0000-0000-0000-000000000000",
        "detail_url": "/api/public/reports/00000000-0000-0000-0000-000000000000/",
        "cat_name": "Nora",
        "breed": "Domestic shorthair",
        "coat_color": "Black and white",
        "description": "Public-safe report description",
        "disappeared_at": null,
        "location_summary": "Approximate map location available",
        "last_seen_landmark": "",
        "approximate_location": {
          "latitude": 52.23,
          "longitude": 21.012,
          "is_approximate": true
        },
        "reward_amount": null,
        "status": "MISSING",
        "found_message": "",
        "resolved_at": null,
        "is_active_search": true,
        "latest_sighting": null,
        "main_photo": null,
        "updated_at": "2026-07-07T12:00:00Z"
      },
      "score": 9,
      "distance_km": 0.12,
      "reasons": ["nearby", "same breed", "similar coat", "same gender"]
    }
  ]
}
```

Scoring is deterministic and local to the backend. It compares:

- nearby report coordinates
- exact breed matches
- shared coat-color words
- matching known gender

The endpoint excludes the source report, hidden reports, and resolved reports.
It returns at most five suggestions from the latest active candidates.

## Privacy And Security

The source report is loaded from the authenticated owner's report set, so users
cannot query duplicate suggestions for reports they do not own. Candidate reports
are serialized with the public list serializer, which avoids private owner data,
private contact fields, exact addresses, moderation notes, and internal owner
IDs.

This endpoint only suggests possible duplicates. It does not merge reports,
modify report state, notify owners, or call an AI provider.
