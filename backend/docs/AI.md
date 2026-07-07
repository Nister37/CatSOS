# AI Integration

CAT-080 adds an optional Gemma text-generation adapter. AI is disabled by
default and the app must keep working when the provider is unavailable.

## Configuration

Use environment variables only:

| Variable | Purpose |
| --- | --- |
| `DJANGO_GEMMA_ENABLED` | Enables outbound Gemma calls when `true`. |
| `DJANGO_GEMMA_API_KEY` | Provider API key. Keep this empty in committed files. |
| `DJANGO_GEMMA_API_BASE_URL` | Generate-content API base URL. |
| `DJANGO_GEMMA_MODEL` | Model name used in the generate-content path. |
| `DJANGO_GEMMA_TIMEOUT_SECONDS` | HTTP timeout for provider calls. |
| `DJANGO_GEMMA_TEMPERATURE` | Generation temperature. |
| `DJANGO_GEMMA_MAX_OUTPUT_TOKENS` | Maximum generated output tokens. |

## Behavior

- `generate_gemma_text` returns fallback text when AI is disabled,
misconfigured, times out, returns a bad response, or cannot be reached.
- Provider errors are logged without prompts, API keys, or private contact data.
- The service only sends text supplied by the caller. Callers must strip private
contact details before using this service.
- Suggestion responses are sanitized before they are returned, including
fallback text used when AI is disabled or unavailable.
- AI output is untrusted suggestion text and must be reviewed by the user before
being saved.

## Description Cleaner API

`POST /api/ai/improve-description/`

Authentication is required.

Request:

```json
{
  "description": "Rough lost-cat description text"
}
```

Response:

```json
{
  "suggestion": "Reviewable suggested text",
  "generated_by_ai": true,
  "requires_review": true,
  "fallback_reason": "",
  "privacy_notice": "Private contact details are removed before AI processing. Review the suggestion before saving."
}
```

Before the provider call, the backend removes email addresses, phone-like values,
and street-like exact addresses from the prompt. The same sanitization is applied
to the suggestion response, including fallback text when AI is disabled or fails.
The endpoint does not save the suggestion to any report.

## Public Summary API

`POST /api/ai/public-summary/`

Authentication is required.

Request:

```json
{
  "cat_name": "Luna",
  "coat_color": "Black with a white chest spot",
  "personality": "Shy with strangers",
  "last_seen_landmark": "Near the playground",
  "description": "Indoor cat, likely hiding close to home."
}
```

Response:

```json
{
  "suggestion": "Luna is a shy black cat with a white chest spot, likely hiding near the playground.",
  "generated_by_ai": true,
  "requires_review": true,
  "fallback_reason": "",
  "privacy_notice": "Private contact details are removed before AI processing. Review the suggestion before saving."
}
```

The endpoint strips private contact details and street-like exact addresses
before the provider call, then sanitizes and truncates returned text before
sending it back. It does not save the suggestion. The reviewed text can be saved
as `public_summary` through the owner report create/update API, where it is
validated again before being exposed on public report list and detail responses.

## Poster Text Suggestion API

`POST /api/reports/{id}/poster-text-suggestion/`

Authentication is required. The authenticated user must own the report. The
endpoint returns concise wording that can be previewed before the owner accepts
it in the poster flow. It does not save the suggestion and it does not generate
the PDF.

Request body: none.

Response:

```json
{
  "suggestion": "MISSING: Luna. Black cat. Last seen near the playground. Scan the QR code with any sightings.",
  "generated_by_ai": true,
  "requires_review": true,
  "fallback_reason": "",
  "privacy_notice": "Private contact details are removed before AI processing. Review the suggestion before saving."
}
```

The prompt uses only public-safe report fields such as cat name, appearance,
description, public landmark, and reward presence. It does not send owner
contact fields or the exact last-seen address. Text is sanitized before the
provider call and again before the API response.

## Report Translation Suggestion API

`POST /api/reports/{id}/translation-suggestion/`

Authentication is required. The authenticated user must own the report. The
endpoint returns translated report text for owner review and does not save the
suggestion to the report.

Request:

```json
{
  "target_language": "pl"
}
```

Supported `target_language` values:

- `en`: English
- `pl`: Polish
- `nl`: Dutch

Response:

```json
{
  "suggestion": "Reviewable translated text",
  "target_language": "pl",
  "target_language_label": "Polish",
  "generated_by_ai": true,
  "requires_review": true,
  "fallback_reason": "",
  "privacy_notice": "Private contact details are removed before AI processing. Review the suggestion before saving."
}
```

The backend sends only public-safe report fields to AI: cat name, breed, coat
color, gender, collar description, personality, description, and public
landmark. It does not send owner contact fields, exact last-seen address, chip
number, moderation notes, or private helper notes. If AI is disabled or
unavailable, the response falls back to sanitized source description text with
`generated_by_ai` set to `false`.
