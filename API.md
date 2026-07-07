# CatSOS API

Base URL for local development:

```text
http://localhost:8000
```

Authenticated requests use JWT access tokens:

```text
Authorization: Bearer <access>
```

JSON requests should send:

```text
Content-Type: application/json
Accept: application/json
```

Auth responses that include account/session state send:

```text
Cache-Control: no-store
Pragma: no-cache
```

This prevents JWT-bearing responses from being cached by browsers or proxies.

Django's default security settings also currently add baseline browser protection headers:

```text
X-Content-Type-Options: nosniff
Referrer-Policy: same-origin
X-Frame-Options: DENY
```

These are framework defaults in this project, not custom endpoint behavior.

## Current Endpoints

| Method | Path | Auth | Status | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | [`/api/health/`](#get-apihealth) | Public | `200` | Backend health check. |
| `GET` | [`/api/profiles/{id}/`](#get-apiprofilesid) | Public | `200` | View a limited public contributor profile. |
| `GET` | [`/api/reports/`](#get-apireports) | JWT | `200` | List the authenticated owner's lost cat reports. |
| `POST` | [`/api/reports/`](#post-apireports) | JWT | `201` | Create a lost cat report with an optional main photo. |
| `GET` | [`/api/reports/{id}/`](#get-apireportsid) | JWT | `200` | View one authenticated owner's lost cat report. |
| `PATCH` | [`/api/reports/{id}/`](#patch-apireportsid) | JWT | `200` | Partially update one authenticated owner's lost cat report. |
| `PUT` | [`/api/reports/{id}/`](#put-apireportsid) | JWT | `200` | Replace editable fields on one authenticated owner's lost cat report. |
| `PATCH` | [`/api/reports/{id}/status/`](#patch-apireportsidstatus) | JWT | `200` | Change one authenticated owner's report status. |
| `GET` | [`/api/reports/{id}/timeline/`](#get-apireportsidtimeline) | JWT | `200` | List timeline events for one authenticated owner's report. |
| `GET` | [`/api/reports/{id}/similar/`](#get-apireportsidsimilar) | JWT | `200` | List public-safe similar nearby reports for one owned report. |
| `GET` | [`/api/reports/{id}/photos/`](#get-apireportsidphotos) | JWT | `200` | List photos for one authenticated owner's report. |
| `POST` | [`/api/reports/{id}/photos/`](#post-apireportsidphotos) | JWT | `201` | Upload an additional photo for one authenticated owner's report. |
| `PATCH` | [`/api/reports/{id}/photos/{photo_id}/main/`](#patch-apireportsidphotosphotoidmain) | JWT | `200` | Set one report photo as the main photo. |
| `DELETE` | [`/api/reports/{id}/photos/{photo_id}/`](#delete-apireportsidphotosphotoid) | JWT | `204` | Delete one report photo. |
| `POST` | [`/api/reports/{id}/qr-code/`](#post-apireportsidqr-code) | JWT | `200` | Generate a QR code for one owned report's public page. |
| `GET` | [`/api/reports/{id}/sightings/`](#get-apireportsidsightings) | JWT | `200` | List sightings for one owned report. |
| `PATCH` | [`/api/reports/{id}/sightings/{sighting_id}/verification/`](#patch-apireportsidsightingssightingidverification) | JWT | `200` | Mark one sighting as pending, useful, or false. |
| `GET` | [`/api/reports/{id}/volunteer-searches/`](#get-apireportsidvolunteer-searches) | JWT | `200` | List helpers searching near one owned report. |
| `GET` | [`/api/public/reports/`](#get-apipublicreports) | Public | `200` | Browse public-safe lost cat report cards. |
| `GET` | [`/api/public/reports/{public_id}/`](#get-apipublicreportspublicid) | Public | `200` | View public-safe lost cat report details. |
| `POST` | [`/api/public/reports/{public_id}/sightings/`](#post-apipublicreportspublicidsightings) | JWT | `201` | Submit an authenticated sighting for a public report. |
| `POST` | [`/api/public/reports/{public_id}/volunteer-searches/`](#post-apipublicreportspublicidvolunteer-searches) | JWT | `201` | Mark that the authenticated user is searching nearby. |
| `POST` | [`/api/auth/register/`](#post-apiauthregister) | Public | `201` | Create an unverified account and send an 8-digit email code. |
| `POST` | [`/api/auth/verify-email/`](#post-apiauthverify-email) | Public | `200` | Verify the 8-digit email code and return JWT tokens. |
| `POST` | [`/api/auth/verification/resend/`](#post-apiauthverificationresend) | Public | `200` | Resend the verification code after the 120-second cooldown. |
| `POST` | [`/api/auth/verification/change-email/`](#post-apiauthverificationchange-email) | Public | `200` | Change the email for an unverified account and send a new code. |
| `POST` | [`/api/auth/login/`](#post-apiauthlogin) | Public | `200` | Login alias that returns JWT tokens. |
| `POST` | [`/api/auth/token/`](#post-apiauthtoken) | Public | `200` | Login endpoint that returns JWT tokens. |
| `POST` | [`/api/auth/token/refresh/`](#post-apiauthtokenrefresh) | Public | `200` | Exchange a refresh token for a new access token. |
| `POST` | [`/api/auth/password-reset/`](#post-apiauthpassword-reset) | Public | `200` | Request an email password reset link without revealing account existence. |
| `POST` | [`/api/auth/password-reset/confirm/`](#post-apiauthpassword-resetconfirm) | Public | `200` | Reset a password with a valid `uid` and Django reset token. |
| `POST` | [`/api/auth/password-reset/totp/`](#post-apiauthpassword-resettotp) | Public | `200` | Reset a password with email plus a valid enrolled TOTP code. |
| `POST` | [`/api/auth/password-change/`](#post-apiauthpassword-change) | JWT | `200` | Change the authenticated user's password after current-password verification. |
| `POST` | [`/api/auth/sso/login/`](#post-apiauthssologin) | Public | `200` | Login or create an account with Google, GitHub, or Microsoft SSO. |
| `POST` | [`/api/auth/sso/link/`](#post-apiauthssolink) | JWT | `200` | Link Google, GitHub, or Microsoft SSO to the authenticated account. |
| `POST` | [`/api/auth/totp/setup/`](#post-apiauthtotpsetup) | JWT | `200` | Start authenticator-app setup and return the secret plus otpauth URI. |
| `POST` | [`/api/auth/totp/confirm/`](#post-apiauthtotpconfirm) | JWT | `200` | Confirm a valid authenticator code and enable TOTP. |
| `POST` | [`/api/auth/totp/disable/`](#post-apiauthtotpdisable) | JWT | `200` | Disable TOTP after current-password and TOTP verification. |
| `GET` | [`/api/schema/`](#get-apischema) | Public | `200` | OpenAPI schema. |
| `GET` | [`/api/docs/`](#get-apidocs) | Public | `200` | Swagger UI. |

## Endpoint Details

<a id="get-apihealth"></a>
### Health Check

`GET /api/health/`

Success response:

```json
{
  "status": "ok",
  "service": "catsos-backend"
}
```

<a id="get-apiprofilesid"></a>
### Public Contributor Profile

`GET /api/profiles/{id}/`

Returns a limited public profile only for active, email-verified contributors who have public activity through points or badges.

Success response:

```json
{
  "id": 1,
  "display_name": "Marta Helper",
  "profile_picture_url": "http://localhost:8000/media/profile-pictures/user-1/avatar.jpg",
  "avatar_fallback": "MH",
  "points": 125,
  "badges": ["Search lead", "Foster mentor"],
  "public_info": {
    "bio": "Coordinates evening searches.",
    "location": "Warsaw",
    "email": "helper-public@example.org",
    "phone": "+48 600 000 000"
  }
}
```

Privacy behavior:

- The account login email is never returned by this endpoint.
- `public_info.email` and `public_info.phone` are returned only when the contributor has explicit public contact fields set.
- Unverified, inactive, or no-activity accounts return `404 Not Found`.
- Responses send `Cache-Control: no-store` to avoid stale public contact data being cached.

## Lost Cat Reports

Lost cat report endpoints require:

```text
Authorization: Bearer <access>
```

Owner API responses send:

```text
Cache-Control: no-store
Pragma: no-cache
```

Admins moderate reports separately in Django admin.

<a id="get-apireports"></a>
### List My Lost Cat Reports

`GET /api/reports/`

Returns only reports owned by the authenticated user.

The response is paginated:

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "2f7b9db5-5697-47c2-9004-6dbd87a17a28",
      "cat_name": "Luna",
      "status": "MISSING"
    }
  ]
}
```

Query parameters:

```text
page=1
page_size=20
active=true
```

`active=true` returns reports with `MISSING` or `RECENTLY_SEEN` status. `active=false` returns reports with `FOUND` or `CLOSED` status. Omit `active` to list all owned reports.

<a id="post-apireports"></a>
### Create Lost Cat Report

`POST /api/reports/`

Accepts either `application/json` for text-only report creation or `multipart/form-data` when uploading the first report photo. For multipart requests, send the existing report fields as form fields and the image file under the field name `photo`.

JSON request:

```json
{
  "cat_name": "Luna",
  "age_years": 4,
  "breed": "Domestic shorthair",
  "coat_color": "Black with a white chest spot",
  "eye_color": "Green",
  "gender": "FEMALE",
  "collar_description": "Red reflective collar with bell",
  "has_microchip": true,
  "chip_number": "985112003456789",
  "personality": "Shy with strangers, responds to treats.",
  "description": "Indoor cat, likely hiding close to home.",
  "disappeared_at": "2026-07-06T10:00:00Z",
  "last_seen_address": "12 Maple Street",
  "last_seen_landmark": "Near the playground",
  "last_seen_lat": 52.2297,
  "last_seen_lng": 21.0122,
  "reward_amount": "100.00",
  "reward_note": "Reward for confirmed recovery.",
  "contact_name": "Marta Owner",
  "contact_phone": "+48 600 111 222",
  "contact_email": "owner@example.com",
  "contact_visibility": "APP_ONLY",
  "notify_push": true,
  "notify_sms": true,
  "notify_email": false
}
```

Multipart photo field:

```text
photo=<JPEG, PNG, or WebP file>
```

Photo uploads are optional. When present, the backend validates extension, content type, image bytes, and size, stores the file in configured media storage, and creates a `LostCatReportPhoto` linked to the new report with `is_main=true`. The default max report photo size is `DJANGO_REPORT_PHOTO_MAX_SIZE_BYTES=5242880` bytes.

Success response:

```json
{
  "id": "2f7b9db5-5697-47c2-9004-6dbd87a17a28",
  "public_id": "80752d52-6f4b-4974-a8df-5532c7b0d2f4",
  "cat_name": "Luna",
  "age_years": 4,
  "breed": "Domestic shorthair",
  "coat_color": "Black with a white chest spot",
  "eye_color": "Green",
  "gender": "FEMALE",
  "collar_description": "Red reflective collar with bell",
  "has_microchip": true,
  "chip_number": "985112003456789",
  "personality": "Shy with strangers, responds to treats.",
  "description": "Indoor cat, likely hiding close to home.",
  "disappeared_at": "2026-07-06T10:00:00Z",
  "last_seen_address": "12 Maple Street",
  "last_seen_landmark": "Near the playground",
  "last_seen_lat": 52.2297,
  "last_seen_lng": 21.0122,
  "reward_amount": "100.00",
  "reward_note": "Reward for confirmed recovery.",
  "contact_name": "Marta Owner",
  "contact_phone": "+48 600 111 222",
  "contact_email": "owner@example.com",
  "contact_visibility": "APP_ONLY",
  "notify_push": true,
  "notify_sms": true,
  "notify_email": false,
  "status": "MISSING",
  "found_message": "",
  "resolved_at": null,
  "is_active_search": true,
  "created_at": "2026-07-06T10:00:00Z",
  "updated_at": "2026-07-06T10:00:00Z"
}
```

The backend sets `status` to `MISSING` when the report is created. Status changes are handled by a separate report lifecycle API. Public report endpoints return the main photo as `{"url": "<absolute media URL>"}` when a main photo exists.

Latitude and longitude must be supplied together or both omitted.

Gender values:

```text
UNKNOWN
FEMALE
MALE
```

Contact visibility values:

```text
APP_ONLY
PUBLIC
PRIVATE
```

Status values:

```text
MISSING
RECENTLY_SEEN
FOUND
CLOSED
```

<a id="get-apireportsid"></a>
### Get My Lost Cat Report

`GET /api/reports/{id}/`

Returns one report owned by the authenticated user. The response includes owner-only edit fields such as private contact preferences, but does not include `owner`, `moderation_status`, or `moderation_notes`.

Reports owned by another user return:

```text
HTTP 404 Not Found
```

This avoids confirming whether another user's report ID exists.

<a id="patch-apireportsid"></a>
<a id="put-apireportsid"></a>
### Update My Lost Cat Report

`PATCH /api/reports/{id}/`

`PUT /api/reports/{id}/`

Only the report owner can update report details through this endpoint. `PATCH` accepts partial updates. `PUT` requires a complete editable report payload.

Editable fields are the same fields accepted by `POST /api/reports/`:

```text
cat_name
age_years
breed
coat_color
eye_color
gender
collar_description
has_microchip
chip_number
personality
description
disappeared_at
last_seen_address
last_seen_landmark
last_seen_lat
last_seen_lng
reward_amount
reward_note
contact_name
contact_phone
contact_email
contact_visibility
notify_push
notify_sms
notify_email
```

Protected fields are ignored if sent:

```text
id
owner
status
found_message
resolved_at
is_active_search
moderation_status
moderation_notes
created_at
updated_at
```

Status changes are handled by a separate report lifecycle API. Report creation can include one main photo by sending `photo` in a multipart `POST /api/reports/` request.

Validation behavior:

- Latitude and longitude must be supplied together in the final report state.
- Setting `has_microchip` to `false` clears `chip_number`.
- Invalid choices and model field constraints return `400 Bad Request` with field-based errors.

Success response:

```text
HTTP 200 OK
```

The response body uses the same owner report shape returned by `POST /api/reports/`.

<a id="patch-apireportsidstatus"></a>
### Change My Lost Cat Report Status

`PATCH /api/reports/{id}/status/`

Only the report owner can change status through this endpoint. Reports owned by another user return `404 Not Found`.

Request:

```json
{
  "status": "RECENTLY_SEEN"
}
```

Request with an optional found message:

```json
{
  "status": "FOUND",
  "found_message": "Luna is home. Thank you for helping."
}
```

Allowed status values:

```text
MISSING
RECENTLY_SEEN
FOUND
CLOSED
```

Success response:

```text
HTTP 200 OK
```

The response body uses the same owner report shape returned by `POST /api/reports/`, with the updated `status`. A real status change also creates a `STATUS_CHANGED` timeline event with the previous status, new status, actor, location summary, and timestamp. Sending the current status again is treated as a successful no-op and does not create a duplicate timeline event.

Resolved status behavior:

- `FOUND` and `CLOSED` set `resolved_at` when the report first becomes resolved.
- `FOUND` and `CLOSED` set `is_active_search` to `false`.
- `MISSING` and `RECENTLY_SEEN` clear `resolved_at` and `found_message`, and set `is_active_search` to `true`.
- `found_message` is accepted only for `FOUND` or `CLOSED`.
- `found_message` is limited to 500 characters and rejects obvious email addresses or phone numbers because it may be shown publicly later.

Public report pages read this canonical report `status`.

<a id="get-apireportsidtimeline"></a>
### List My Lost Cat Report Timeline

`GET /api/reports/{id}/timeline/`

Returns timeline events for one report owned by the authenticated user in chronological order. Reports owned by another user return `404 Not Found`.

The response is paginated:

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "45e87e07-5e11-4c3f-9a78-88914f66ccdf",
      "event_type": "REPORT_CREATED",
      "from_status": "",
      "to_status": "",
      "location_summary": "Near the playground",
      "actor": {
        "display_name": "Marta Owner",
        "avatar_fallback": "MO"
      },
      "created_at": "2026-07-06T10:00:00Z"
    },
    {
      "id": "cf86cf49-c3d1-468a-91d0-3b551624d743",
      "event_type": "SIGHTING_CREATED",
      "from_status": "",
      "to_status": "",
      "location_summary": "Behind the bakery",
      "actor": {
        "display_name": "Helpful Neighbor",
        "avatar_fallback": "HN"
      },
      "created_at": "2026-07-06T10:20:00Z"
    },
    {
      "id": "1cb21c2b-4be2-49f5-9a42-603088868c6f",
      "event_type": "STATUS_CHANGED",
      "from_status": "MISSING",
      "to_status": "RECENTLY_SEEN",
      "location_summary": "Near the playground",
      "actor": {
        "display_name": "Marta Owner",
        "avatar_fallback": "MO"
      },
      "created_at": "2026-07-06T10:30:00Z"
    }
  ]
}
```

Timeline actor data is intentionally public-safe and does not expose account email, phone, password state, or moderation fields.

Timeline event types currently include:

```text
REPORT_CREATED
SIGHTING_CREATED
SIGHTING_MARKED_FALSE
SIGHTING_MARKED_USEFUL
STATUS_CHANGED
VOLUNTEER_SEARCH_STARTED
```

<a id="get-apireportsidsimilar"></a>
### List Similar Nearby Reports

`GET /api/reports/{id}/similar/`

Owner-only helper endpoint for suggesting potentially related reports. Reports owned by another user return `404 Not Found`.

Success response:

```json
{
  "count": 1,
  "results": [
    {
      "report": {
        "public_id": "80752d52-6f4b-4974-a8df-5532c7b0d2f4",
        "detail_url": "/api/public/reports/80752d52-6f4b-4974-a8df-5532c7b0d2f4/",
        "cat_name": "Nora",
        "breed": "Domestic shorthair",
        "coat_color": "Black and white",
        "description": "Seen near gardens.",
        "disappeared_at": "2026-07-06T10:00:00Z",
        "location_summary": "Near the library",
        "last_seen_landmark": "Near the library",
        "approximate_location": {
          "latitude": 52.23,
          "longitude": 21.013,
          "is_approximate": true
        },
        "reward_amount": null,
        "status": "RECENTLY_SEEN",
        "found_message": "",
        "resolved_at": null,
        "is_active_search": true,
        "latest_sighting": null,
        "main_photo": null,
        "updated_at": "2026-07-06T10:30:00Z"
      },
      "score": 10,
      "distance_km": 0.08,
      "reasons": ["nearby", "same breed", "similar coat", "same gender"]
    }
  ]
}
```

Current matching is deterministic and AI-free. It ranks active, non-hidden reports by approximate distance plus simple breed, coat, and gender matches. Candidate reports use the same public-safe card shape as `GET /api/public/reports/`.

<a id="get-apireportsidphotos"></a>
### List My Lost Cat Report Photos

`GET /api/reports/{id}/photos/`

Returns photos for one report owned by the authenticated user. Reports owned by another user return `404 Not Found`.

Success response:

```json
[
  {
    "id": "7cf0eb87-f6b8-4d14-b924-41aafab4d7e0",
    "url": "http://localhost:8000/media/lost-cat-report-photos/f7c9f1a2c80d4c1aa9c5cc14e0f81234.jpg",
    "is_main": true,
    "created_at": "2026-07-06T10:30:00Z"
  }
]
```

Owner photo responses include the photo ID needed for gallery management, but do not expose original filenames, filesystem paths, or private owner data.

<a id="post-apireportsidphotos"></a>
### Upload Lost Cat Report Photo

`POST /api/reports/{id}/photos/`

Uploads an additional photo for one report owned by the authenticated user. Send `multipart/form-data` with the image under the field name `photo`.

Multipart fields:

```text
photo=<JPEG, PNG, or WebP file>
is_main=true
```

`is_main` is optional and defaults to `false`. If the uploaded photo is the report's first photo, it becomes the main photo automatically. If `is_main=true`, existing main photos for that report are cleared.

Success response:

```json
{
  "id": "7cf0eb87-f6b8-4d14-b924-41aafab4d7e0",
  "url": "http://localhost:8000/media/lost-cat-report-photos/f7c9f1a2c80d4c1aa9c5cc14e0f81234.jpg",
  "is_main": true,
  "created_at": "2026-07-06T10:30:00Z"
}
```

Validation behavior is the same as create-time report photo uploads: JPEG, PNG, and WebP only, image bytes verified with Pillow, and max size controlled by `DJANGO_REPORT_PHOTO_MAX_SIZE_BYTES`.

<a id="patch-apireportsidphotosphotoidmain"></a>
### Set Main Lost Cat Report Photo

`PATCH /api/reports/{id}/photos/{photo_id}/main/`

Sets one photo from an owned report as the main photo. The public report card and public report detail `main_photo.url` use this selected photo.

Success response:

```json
{
  "id": "7cf0eb87-f6b8-4d14-b924-41aafab4d7e0",
  "url": "http://localhost:8000/media/lost-cat-report-photos/f7c9f1a2c80d4c1aa9c5cc14e0f81234.jpg",
  "is_main": true,
  "created_at": "2026-07-06T10:30:00Z"
}
```

Reports owned by another user or photos that do not belong to the report return `404 Not Found`.

<a id="delete-apireportsidphotosphotoid"></a>
### Delete Lost Cat Report Photo

`DELETE /api/reports/{id}/photos/{photo_id}/`

Deletes one photo from an owned report and removes its stored media file after the database transaction commits. If the deleted photo was the main photo and other photos remain, the next available photo is promoted to main.

Success response:

```text
HTTP 204 No Content
```

Reports owned by another user or photos that do not belong to the report return `404 Not Found`.

<a id="post-apireportsidqr-code"></a>
### Generate Lost Cat Report QR Code

`POST /api/reports/{id}/qr-code/`

Generates a PNG QR code for one report owned by the authenticated user. The QR code points to the frontend public report page:

```text
{DJANGO_FRONTEND_URL}/reports/{public_id}
```

The request body is empty:

```json
{}
```

Success response:

```json
{
  "public_url": "https://app.catsos.example/reports/80752d52-6f4b-4974-a8df-5532c7b0d2f4",
  "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "content_type": "image/png"
}
```

Behavior:

- Reports owned by another user return `404 Not Found`.
- Hidden moderated reports return `400 Bad Request` because their public page is not visible.
- The response uses `Cache-Control: no-store`.
- The response does not expose owner private contact fields, exact address, internal owner ID, or moderation notes.

<a id="get-apipublicreports"></a>
### Browse Public Lost Cat Reports

`GET /api/public/reports/`

Public paginated list for lost-cat browse pages. It does not require authentication and returns public-safe report card data. By default, it returns active searches only: `MISSING` and `RECENTLY_SEEN`.

Query parameters:

```text
page=1
page_size=20
active=true
status=MISSING
```

Filtering behavior:

- Omit filters to browse active searches.
- `active=true` returns `MISSING` and `RECENTLY_SEEN`.
- `active=false` returns `FOUND` and `CLOSED`.
- `status=<value>` returns that exact status and overrides the default active-only behavior.
- Invalid `active` or `status` values return `400 Bad Request`.

Success response:

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "public_id": "80752d52-6f4b-4974-a8df-5532c7b0d2f4",
      "detail_url": "/api/public/reports/80752d52-6f4b-4974-a8df-5532c7b0d2f4/",
      "cat_name": "Luna",
      "breed": "Domestic shorthair",
      "coat_color": "Black with a white chest spot",
      "description": "Indoor cat, likely hiding close to home.",
      "disappeared_at": "2026-07-06T10:00:00Z",
      "location_summary": "Near the playground",
      "last_seen_landmark": "Near the playground",
      "approximate_location": {
        "latitude": 52.23,
        "longitude": 21.012,
        "is_approximate": true
      },
      "reward_amount": "100.00",
      "status": "MISSING",
      "found_message": "",
      "resolved_at": null,
      "is_active_search": true,
      "latest_sighting": {
        "seen_at": "2026-07-06T10:35:00Z",
        "location_description": "Behind the bakery",
        "latitude": 52.2297,
        "longitude": 21.0122,
        "confidence": "HIGH",
        "verification_status": "USEFUL"
      },
      "main_photo": {
        "url": "http://localhost:8000/media/lost-cat-report-photos/f7c9f1a2c80d4c1aa9c5cc14e0f81234.jpg"
      },
      "updated_at": "2026-07-06T10:30:00Z"
    }
  ]
}
```

`main_photo` is `null` when the report has no main photo. When present, it contains only a `url` key with an absolute media URL. `latest_sighting` is `null` until a non-false sighting exists; confirmed `USEFUL` sightings are preferred, and the latest `PENDING` sighting is used as a fallback when no confirmed sighting exists. When present, `latest_sighting` contains public-safe sighting time, location, coordinates, confidence, and verification status only. `detail_url` points to the public report detail API for the card. Public list responses exclude owner IDs, exact address, chip number, direct contact fields, notification preferences, moderation fields, sighting notes, sighting photos, helper identity, and timeline data. Hidden moderated reports are excluded.

<a id="get-apipublicreportspublicid"></a>
### Public Lost Cat Report Detail

`GET /api/public/reports/{public_id}/`

Public endpoint for QR-linked and shared lost-cat report pages. It does not require authentication.

Success response:

```json
{
  "public_id": "80752d52-6f4b-4974-a8df-5532c7b0d2f4",
  "cat_name": "Luna",
  "age_years": 4,
  "breed": "Domestic shorthair",
  "coat_color": "Black with a white chest spot",
  "eye_color": "Green",
  "gender": "FEMALE",
  "collar_description": "Red reflective collar with bell",
  "has_microchip": true,
  "personality": "Shy with strangers, responds to treats.",
  "description": "Indoor cat, likely hiding close to home.",
  "disappeared_at": "2026-07-06T10:00:00Z",
  "last_seen_landmark": "Near the playground",
  "approximate_location": {
    "latitude": 52.23,
    "longitude": 21.012,
    "is_approximate": true
  },
  "reward_amount": "100.00",
  "reward_note": "Reward for confirmed recovery.",
  "status": "MISSING",
  "found_message": "",
  "resolved_at": null,
  "is_active_search": true,
  "contact": {
    "visibility": "APP_ONLY",
    "instructions": "Log in to CatSOS to submit a sighting."
  },
  "latest_sighting": {
    "seen_at": "2026-07-06T10:35:00Z",
    "location_description": "Behind the bakery",
    "latitude": 52.2297,
    "longitude": 21.0122,
    "confidence": "HIGH",
    "verification_status": "USEFUL"
  },
  "main_photo": {
    "url": "http://localhost:8000/media/lost-cat-report-photos/f7c9f1a2c80d4c1aa9c5cc14e0f81234.jpg"
  },
  "photos": [
    {
      "url": "http://localhost:8000/media/lost-cat-report-photos/f7c9f1a2c80d4c1aa9c5cc14e0f81234.jpg"
    }
  ],
  "timeline": [
    {
      "event_type": "STATUS_CHANGED",
      "from_status": "MISSING",
      "to_status": "RECENTLY_SEEN",
      "created_at": "2026-07-06T10:30:00Z"
    }
  ],
  "updated_at": "2026-07-06T10:30:00Z"
}
```

Contact behavior:

- `PUBLIC` returns `name`, `phone`, and `email` from the report contact fields.
- `APP_ONLY` and `PRIVATE` return instructions only and do not expose direct contact details.

Privacy behavior:

- Hidden moderated reports return `404 Not Found`.
- The response does not include internal report `id`, owner ID, owner email, exact `last_seen_address`, `chip_number`, notification preferences, or moderation fields.
- Coordinates are rounded and marked approximate.
- Timeline entries are chronological and do not expose actor private data or location summaries.
- `latest_sighting` prefers sightings marked `USEFUL`, falls back to the latest `PENDING` sighting when none are confirmed, excludes `FALSE` sightings, and does not expose helper identity, notes, or photos.
- `main_photo` is `null` when no main photo exists. When present, it contains only `url`.
- `photos` contains URL-only photo objects and does not expose internal IDs, storage paths, original filenames, or owner data.

<a id="post-apipublicreportspublicidsightings"></a>
### Submit Sighting For Public Report

`POST /api/public/reports/{public_id}/sightings/`

Requires:

```text
Authorization: Bearer <access>
```

Creates a pending sighting for a non-hidden active report. Guests cannot submit sightings. Hidden reports return `404 Not Found`; `FOUND` and `CLOSED` reports return `400 Bad Request`.

Accepts either `application/json` for text-only sightings or `multipart/form-data` when attaching a photo. For multipart requests, send the existing sighting fields as form fields and the image file under the field name `photo`.

Request:

```json
{
  "seen_at": "2026-07-06T10:35:00Z",
  "location_description": "Behind the bakery",
  "latitude": 52.2297,
  "longitude": 21.0122,
  "confidence": "HIGH",
  "notes": "The cat was walking slowly toward the courtyard."
}
```

Multipart photo field:

```text
photo=<JPEG, PNG, or WebP file>
```

Success response:

```json
{
  "id": "2ad10db8-0ac1-48ce-9c81-3cbaf356779d",
  "report_public_id": "80752d52-6f4b-4974-a8df-5532c7b0d2f4",
  "seen_at": "2026-07-06T10:35:00Z",
  "location_description": "Behind the bakery",
  "latitude": 52.2297,
  "longitude": 21.0122,
  "confidence": "HIGH",
  "notes": "The cat was walking slowly toward the courtyard.",
  "photos": [
    {
      "id": "4e0987ad-6544-4564-8d8e-d7c2a48ceca8",
      "url": "http://localhost:8000/media/sighting-photos/f7c9f1a2c80d4c1aa9c5cc14e0f81234.jpg",
      "created_at": "2026-07-06T10:36:00Z"
    }
  ],
  "verification_status": "PENDING",
  "created_at": "2026-07-06T10:36:00Z"
}
```

Confidence values:

```text
LOW
MEDIUM
HIGH
```

Validation behavior:

- `seen_at` cannot be in the future beyond a small clock-skew tolerance.
- `latitude` must be between `-90` and `90`.
- `longitude` must be between `-180` and `180`.
- `notes` are limited to 2000 characters.
- Optional `photo` uploads allow JPEG, PNG, and WebP only, verify image bytes with Pillow, and use `DJANGO_SIGHTING_PHOTO_MAX_SIZE_BYTES` for the max size.

Successful submission creates a `SIGHTING_CREATED` report timeline event. Sighting photo responses expose only photo IDs, absolute media URLs, and timestamps; they do not expose original filenames, storage paths, or uploader private data.

<a id="get-apireportsidsightings"></a>
### List Report Sightings

`GET /api/reports/{id}/sightings/`

Returns sightings for one report. The report owner can list sightings for their own report. Staff users can list sightings for any report. Other users receive `404 Not Found`.

The response is paginated:

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "2ad10db8-0ac1-48ce-9c81-3cbaf356779d",
      "report_public_id": "80752d52-6f4b-4974-a8df-5532c7b0d2f4",
      "seen_at": "2026-07-06T10:35:00Z",
      "location_description": "Behind the bakery",
      "latitude": 52.2297,
      "longitude": 21.0122,
      "confidence": "HIGH",
      "notes": "The cat was walking slowly toward the courtyard.",
      "photos": [],
      "verification_status": "FALSE",
      "created_at": "2026-07-06T10:36:00Z",
      "submitted_by": {
        "display_name": "Helpful Neighbor",
        "avatar_fallback": "HN"
      },
      "verified_by": {
        "display_name": "Marta Owner",
        "avatar_fallback": "MO"
      },
      "verified_at": "2026-07-06T10:45:00Z",
      "updated_at": "2026-07-06T10:45:00Z"
    }
  ]
}
```

False sightings remain visible through this owner/admin endpoint. Submitter and verifier summaries are public-safe and do not expose account email or phone.

<a id="patch-apireportsidsightingssightingidverification"></a>
### Verify Or Reject Report Sighting

`PATCH /api/reports/{id}/sightings/{sighting_id}/verification/`

The report owner or a staff user can update a sighting verification status.

Request:

```json
{
  "verification_status": "USEFUL"
}
```

Allowed values:

```text
PENDING
USEFUL
FALSE
```

Success response:

```json
{
  "id": "2ad10db8-0ac1-48ce-9c81-3cbaf356779d",
  "report_public_id": "80752d52-6f4b-4974-a8df-5532c7b0d2f4",
  "seen_at": "2026-07-06T10:35:00Z",
  "location_description": "Behind the bakery",
  "latitude": 52.2297,
  "longitude": 21.0122,
  "confidence": "HIGH",
  "notes": "The cat was walking slowly toward the courtyard.",
  "photos": [],
  "verification_status": "USEFUL",
  "created_at": "2026-07-06T10:36:00Z",
  "submitted_by": {
    "display_name": "Helpful Neighbor",
    "avatar_fallback": "HN"
  },
  "verified_by": {
    "display_name": "Marta Owner",
    "avatar_fallback": "MO"
  },
  "verified_at": "2026-07-06T10:45:00Z",
  "updated_at": "2026-07-06T10:45:00Z"
}
```

Changing a sighting to `USEFUL` creates a `SIGHTING_MARKED_USEFUL` timeline event and makes it eligible for the public `latest_sighting` summary. Changing a sighting to `FALSE` creates a `SIGHTING_MARKED_FALSE` timeline event and excludes it from `latest_sighting`. Setting `verification_status` back to `PENDING` clears `verified_by` and `verified_at`.

<a id="post-apipublicreportspublicidvolunteer-searches"></a>
### Mark Searching Nearby For Public Report

`POST /api/public/reports/{public_id}/volunteer-searches/`

Requires:

```text
Authorization: Bearer <access>
```

Marks the authenticated user as searching near a non-hidden active report. Guests cannot create volunteer-search records. Hidden reports return `404 Not Found`; `FOUND` and `CLOSED` reports return `400 Bad Request`.

The request body is empty:

```json
{}
```

Success response:

```json
{
  "id": "aefeb565-c654-469b-9db9-fb2de37f679f",
  "report_public_id": "80752d52-6f4b-4974-a8df-5532c7b0d2f4",
  "volunteer": {
    "display_name": "Helpful Neighbor",
    "avatar_fallback": "HN"
  },
  "created_at": "2026-07-07T09:20:00Z",
  "updated_at": "2026-07-07T09:20:00Z"
}
```

The first request by a user for a report returns `201 Created` and creates a `VOLUNTEER_SEARCH_STARTED` timeline event. Repeating the same request refreshes `updated_at`, returns `200 OK`, and does not create a duplicate timeline event.

Volunteer responses expose only safe display data. They do not expose account email, private phone, direct contact fields, or internal user IDs.

<a id="get-apireportsidvolunteer-searches"></a>
### List Report Volunteer Searches

`GET /api/reports/{id}/volunteer-searches/`

Returns helpers who marked that they are searching near one report. The report owner can list helpers for their own report. Staff users can list helpers for any report. Other users receive `404 Not Found`.

The response is paginated:

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "aefeb565-c654-469b-9db9-fb2de37f679f",
      "report_public_id": "80752d52-6f4b-4974-a8df-5532c7b0d2f4",
      "volunteer": {
        "display_name": "Helpful Neighbor",
        "avatar_fallback": "HN"
      },
      "created_at": "2026-07-07T09:20:00Z",
      "updated_at": "2026-07-07T09:20:00Z"
    }
  ]
}
```

Volunteer list responses are owner/admin visibility only and use `Cache-Control: no-store`. They do not expose helper email, phone, private profile fields, or report owner private data.

## Auth Payloads

<a id="post-apiauthregister"></a>
### Register: Start Verification

`POST /api/auth/register/`

Request:

```json
{
  "email": "visitor@example.com",
  "password": "StrongPass123!",
  "password_confirm": "StrongPass123!"
}
```

Success response:

```json
{
  "detail": "Verification code sent. Verify your email to finish registration.",
  "email_verification_required": true,
  "resend_available_in_seconds": 120,
  "user": {
    "id": 1,
    "email": "visitor@example.com"
  }
}
```

Validation errors are field-based:

```json
{
  "password": ["This password is too short."],
  "password_confirm": ["Password confirmation does not match."]
}
```

<a id="post-apiauthverify-email"></a>
### Verify Email

`POST /api/auth/verify-email/`

Request:

```json
{
  "email": "visitor@example.com",
  "code": "12345678"
}
```

Success response:

```json
{
  "access": "<jwt-access-token>",
  "refresh": "<jwt-refresh-token>",
  "token_type": "Bearer",
  "user": {
    "id": 1,
    "email": "visitor@example.com"
  }
}
```

Invalid code:

```json
{
  "code": ["The verification code is invalid."]
}
```

<a id="post-apiauthverificationresend"></a>
### Resend Verification Code

`POST /api/auth/verification/resend/`

Request:

```json
{
  "email": "visitor@example.com"
}
```

Success response:

```json
{
  "detail": "Verification code sent. Verify your email to finish registration.",
  "email_verification_required": true,
  "resend_available_in_seconds": 120,
  "user": {
    "id": 1,
    "email": "visitor@example.com"
  }
}
```

Cooldown error:

```json
{
  "resend_available_in_seconds": [98],
  "detail": ["Wait before requesting another verification code."]
}
```

Cooldown status and header:

```text
HTTP 429 Too Many Requests
Retry-After: 98
```

<a id="post-apiauthverificationchange-email"></a>
### Change Pending Verification Email

`POST /api/auth/verification/change-email/`

Request:

```json
{
  "email": "visitor@example.com",
  "password": "StrongPass123!",
  "new_email": "changed@example.com"
}
```

Success response:

```json
{
  "detail": "Verification code sent. Verify your email to finish registration.",
  "email_verification_required": true,
  "resend_available_in_seconds": 120,
  "user": {
    "id": 1,
    "email": "changed@example.com"
  }
}
```

<a id="post-apiauthlogin"></a>
<a id="post-apiauthtoken"></a>
### Login

`POST /api/auth/token/`

`POST /api/auth/login/` is also supported as an alias.

Request:

```json
{
  "email": "visitor@example.com",
  "password": "StrongPass123!",
  "totp_code": "123456"
}
```

`totp_code` is required only when authenticator-app verification is enabled for the account.

Success response:

```json
{
  "access": "<jwt-access-token>",
  "refresh": "<jwt-refresh-token>",
  "token_type": "Bearer",
  "user": {
    "id": 1,
    "email": "visitor@example.com"
  }
}
```

Invalid credentials:

```json
{
  "non_field_errors": ["Unable to log in with provided credentials."]
}
```

Unverified account:

```json
{
  "email": ["Verify your email before logging in."]
}
```

TOTP-enabled account without a code:

```json
{
  "totp_code": ["TOTP code is required for this account."]
}
```

<a id="post-apiauthtokenrefresh"></a>
### Refresh Token

`POST /api/auth/token/refresh/`

Request:

```json
{
  "refresh": "<jwt-refresh-token>"
}
```

Success response:

```json
{
  "access": "<new-jwt-access-token>"
}
```

<a id="post-apiauthpassword-reset"></a>
### Request Password Reset

`POST /api/auth/password-reset/`

Request:

```json
{
  "email": "visitor@example.com"
}
```

Success response for existing and non-existing accounts:

```json
{
  "detail": "If an account exists for this email, password reset instructions were sent."
}
```

The response intentionally does not reveal whether the email belongs to an account. If an active account with a usable password exists, the backend sends a reset link to that email. Reset tokens are never returned in JSON responses.

Rate limit response:

```json
{
  "detail": "Too many password reset requests. Try again later."
}
```

Rate limit status and header:

```text
HTTP 429 Too Many Requests
Retry-After: 3600
```

<a id="post-apiauthpassword-resetconfirm"></a>
### Confirm Password Reset

`POST /api/auth/password-reset/confirm/`

Request:

```json
{
  "uid": "<uid-from-email-link>",
  "token": "<token-from-email-link>",
  "new_password": "NewPassword123!",
  "new_password_confirm": "NewPassword123!"
}
```

Success response:

```json
{
  "detail": "Password has been reset successfully."
}
```

Invalid or expired link:

```json
{
  "detail": "Invalid or expired reset link."
}
```

Password reset does not auto-login the user and does not return JWT tokens. The new password must pass Django password validators.

<a id="post-apiauthpassword-resettotp"></a>
### Reset Password With TOTP

`POST /api/auth/password-reset/totp/`

Request:

```json
{
  "email": "visitor@example.com",
  "totp_code": "123456",
  "new_password": "NewPassword123!",
  "new_password_confirm": "NewPassword123!"
}
```

Success response:

```json
{
  "detail": "Password has been reset successfully."
}
```

Invalid email, disabled TOTP, inactive account, or invalid TOTP code:

```json
{
  "detail": "Invalid email or TOTP code."
}
```

This path is available only for accounts that already enrolled authenticator-app verification. It uses the same password reset rate limits as email reset requests, does not auto-login the user, and does not return JWT tokens.

<a id="post-apiauthpassword-change"></a>
### Change Password

`POST /api/auth/password-change/`

Requires:

```text
Authorization: Bearer <access>
```

Request:

```json
{
  "current_password": "StrongPass123!",
  "new_password": "NewPassword123!",
  "new_password_confirm": "NewPassword123!",
  "totp_code": "123456"
}
```

`totp_code` is required when authenticator-app verification is enabled for the account.

Success response:

```json
{
  "detail": "Password has been changed successfully."
}
```

Wrong current password:

```json
{
  "current_password": ["Current password is incorrect."]
}
```

The new password must pass Django password validators. The backend sends a confirmation email after successful password reset and after successful logged-in password change.

SMS password recovery is intentionally not implemented in the MVP because it adds cost and weaker security. CatSOS uses email reset links, enrolled authenticator-app TOTP recovery, and logged-in password change with current-password verification.

<a id="post-apiauthtotpsetup"></a>
### TOTP Setup

`POST /api/auth/totp/setup/`

Requires:

```text
Authorization: Bearer <access>
```

Request:

```json
{
  "current_password": "StrongPass123!"
}
```

Success response:

```json
{
  "detail": "Scan this secret with an authenticator app, then confirm a code.",
  "secret": "<base32-secret>",
  "otpauth_url": "otpauth://totp/..."
}
```

The `secret` and `otpauth_url` are returned only during setup and must not be logged by clients. The account is not TOTP-enabled until confirmation succeeds.

<a id="post-apiauthtotpconfirm"></a>
### TOTP Confirm

`POST /api/auth/totp/confirm/`

Requires:

```text
Authorization: Bearer <access>
```

Request:

```json
{
  "totp_code": "123456"
}
```

Success response:

```json
{
  "detail": "Authenticator app verification has been enabled."
}
```

<a id="post-apiauthtotpdisable"></a>
### TOTP Disable

`POST /api/auth/totp/disable/`

Requires:

```text
Authorization: Bearer <access>
```

Request:

```json
{
  "current_password": "StrongPass123!",
  "totp_code": "123456"
}
```

Success response:

```json
{
  "detail": "Authenticator app verification has been disabled."
}
```

When TOTP is enabled, login, password change, and SSO provider linking require a valid authenticator code.

<a id="post-apiauthssologin"></a>
### SSO Login Or Signup

`POST /api/auth/sso/login/`

Request:

```json
{
  "provider": "google",
  "token": "<provider-token>"
}
```

Supported `provider` values:

```text
google
github
microsoft
```

Provider token expectations:

```text
google     -> Google ID token
github     -> GitHub OAuth access token with access to /user/emails
microsoft  -> Microsoft identity platform ID token
```

Success response:

```json
{
  "access": "<jwt-access-token>",
  "refresh": "<jwt-refresh-token>",
  "token_type": "Bearer",
  "user": {
    "id": 1,
    "email": "sso@example.com"
  }
}
```

If the provider account is new and the email is not already used in CatSOS, CatSOS creates a verified account with that email as the main email.

If a CatSOS account already exists with the same email but no provider link exists yet, the endpoint rejects the request. Sign in normally first, then use the SSO link endpoint.

Conflict response:

```json
{
  "email": ["An account with this email already exists. Sign in and link this SSO provider."]
}
```

<a id="post-apiauthssolink"></a>
### Link SSO Provider

`POST /api/auth/sso/link/`

Requires:

```text
Authorization: Bearer <access>
```

Request:

```json
{
  "provider": "github",
  "token": "<provider-token>",
  "totp_code": "123456"
}
```

`totp_code` is required when authenticator-app verification is enabled for the account.

Success response:

```json
{
  "detail": "SSO provider linked.",
  "social_account": {
    "provider": "github",
    "email": "visitor@example.com"
  }
}
```

If the provider account is already linked to another CatSOS user:

```json
{
  "provider": ["This SSO provider account is already linked to another user."]
}
```

## Schema And Docs

<a id="get-apischema"></a>
### OpenAPI Schema

`GET /api/schema/`

Returns the generated OpenAPI schema from drf-spectacular.

<a id="get-apidocs"></a>
### Swagger UI

`GET /api/docs/`

Opens Swagger UI for browsing and trying the API in a browser.

## Manual Testing With PowerShell

Start the backend first:

```powershell
cd backend
..\.venv\Scripts\python.exe manage.py migrate
..\.venv\Scripts\python.exe manage.py runserver
```

Health check:

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:8000/api/health/"
```

Register:

```powershell
$registerBody = @{
  email = "visitor@example.com"
  password = "StrongPass123!"
  password_confirm = "StrongPass123!"
} | ConvertTo-Json

$session = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/api/auth/register/" `
  -ContentType "application/json" `
  -Body $registerBody

$session
```

Get the code from the backend console output. The local backend uses Django's console email backend by default.

Verify email:

```powershell
$verifyBody = @{
  email = "visitor@example.com"
  code = "12345678"
} | ConvertTo-Json

$session = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/api/auth/verify-email/" `
  -ContentType "application/json" `
  -Body $verifyBody

$session
```

Resend code after the cooldown:

```powershell
$resendBody = @{
  email = "visitor@example.com"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/api/auth/verification/resend/" `
  -ContentType "application/json" `
  -Body $resendBody
```

Change the pending verification email:

```powershell
$changeEmailBody = @{
  email = "visitor@example.com"
  password = "StrongPass123!"
  new_email = "changed@example.com"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/api/auth/verification/change-email/" `
  -ContentType "application/json" `
  -Body $changeEmailBody
```

Login:

```powershell
$loginBody = @{
  email = "visitor@example.com"
  password = "StrongPass123!"
} | ConvertTo-Json

$session = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/api/auth/token/" `
  -ContentType "application/json" `
  -Body $loginBody

$session
```

Refresh:

```powershell
$refreshBody = @{
  refresh = $session.refresh
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/api/auth/token/refresh/" `
  -ContentType "application/json" `
  -Body $refreshBody
```

Request a password reset email:

```powershell
$resetRequestBody = @{
  email = "visitor@example.com"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/api/auth/password-reset/" `
  -ContentType "application/json" `
  -Body $resetRequestBody
```

Confirm password reset with the `uid` and `token` from the email link:

```powershell
$resetConfirmBody = @{
  uid = "<uid-from-email-link>"
  token = "<token-from-email-link>"
  new_password = "NewPassword123!"
  new_password_confirm = "NewPassword123!"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/api/auth/password-reset/confirm/" `
  -ContentType "application/json" `
  -Body $resetConfirmBody
```

Send an authenticated request:

```powershell
$headers = @{
  Authorization = "Bearer $($session.access)"
}

Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:8000/api/health/" `
  -Headers $headers
```

Change the current user's password:

```powershell
$passwordChangeBody = @{
  current_password = "StrongPass123!"
  new_password = "NewPassword123!"
  new_password_confirm = "NewPassword123!"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/api/auth/password-change/" `
  -ContentType "application/json" `
  -Headers $headers `
  -Body $passwordChangeBody
```

Start TOTP setup:

```powershell
$totpSetupBody = @{
  current_password = "StrongPass123!"
} | ConvertTo-Json

$totpSetup = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/api/auth/totp/setup/" `
  -ContentType "application/json" `
  -Headers $headers `
  -Body $totpSetupBody

$totpSetup
```

Confirm TOTP after scanning the returned `otpauth_url`:

```powershell
$totpConfirmBody = @{
  totp_code = "123456"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/api/auth/totp/confirm/" `
  -ContentType "application/json" `
  -Headers $headers `
  -Body $totpConfirmBody
```

Reset password with enrolled TOTP:

```powershell
$totpResetBody = @{
  email = "visitor@example.com"
  totp_code = "123456"
  new_password = "NewPassword123!"
  new_password_confirm = "NewPassword123!"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/api/auth/password-reset/totp/" `
  -ContentType "application/json" `
  -Body $totpResetBody
```

Test validation errors:

```powershell
$badBody = @{
  email = "not-an-email"
  password = "short"
  password_confirm = "different"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/api/auth/register/" `
  -ContentType "application/json" `
  -Body $badBody
```

`Invoke-RestMethod` throws for non-2xx responses. To inspect validation responses without stopping:

```powershell
try {
  Invoke-RestMethod `
    -Method Post `
    -Uri "http://localhost:8000/api/auth/register/" `
    -ContentType "application/json" `
    -Body $badBody
} catch {
  $_.ErrorDetails.Message
}
```

SSO login/signup:

```powershell
$ssoBody = @{
  provider = "google"
  token = "<google-id-token>"
} | ConvertTo-Json

$session = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/api/auth/sso/login/" `
  -ContentType "application/json" `
  -Body $ssoBody

$session
```

Link SSO to the current account:

```powershell
$headers = @{
  Authorization = "Bearer $($session.access)"
}

$linkBody = @{
  provider = "github"
  token = "<github-access-token>"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/api/auth/sso/link/" `
  -ContentType "application/json" `
  -Headers $headers `
  -Body $linkBody
```

## SSO Configuration

Google and Microsoft ID tokens must be issued for your configured client IDs:

```text
GOOGLE_OAUTH_CLIENT_ID=<google-web-client-id>
MICROSOFT_OAUTH_CLIENT_ID=<microsoft-application-client-id>
```

Optional settings:

```text
MICROSOFT_JWKS_URL=https://login.microsoftonline.com/common/discovery/v2.0/keys
DJANGO_SSO_HTTP_TIMEOUT_SECONDS=5
```

### Google SSO Status And Test

For the importable Postman collection, environment file, and full Postman setup guide, see [`backend/docs/POSTMAN.md`](postman/POSTMAN.md).

Current status:

- Backend Google SSO is wired.
- `GOOGLE_OAUTH_CLIENT_ID` is configured in local `backend/.env`.
- Docker loads `backend/.env` for the backend service.
- Frontend Google sign-in is not implemented yet, so there is no browser button that can produce the Google token.

Quick backend confidence test:

```powershell
cd backend
..\.venv\Scripts\python.exe manage.py test accounts
```

Real end-to-end test after a Google button exists:

1. Start backend and frontend.
2. Click "Continue with Google" in the frontend.
3. Pick a Google account.
4. The frontend sends Google's returned `credential` to `POST /api/auth/sso/login/`.
5. Success means CatSOS returns `access`, `refresh`, `token_type`, and `user`.

The important frontend detail is simple: send the Google `credential` value as `token`. Do not send a Google access token or client secret.

Expected API request:

```json
{
  "provider": "google",
  "token": "<google-credential-id-token>"
}
```

Expected API success:

```json
{
  "access": "<jwt-access-token>",
  "refresh": "<jwt-refresh-token>",
  "token_type": "Bearer",
  "user": {
    "id": 1,
    "email": "google-account@example.com"
  }
}
```

Postman test:

1. Start the backend.
2. Create a `POST` request to `http://localhost:8000/api/auth/sso/login/`.
3. In `Headers`, set `Content-Type` to `application/json`.
4. In `Body`, choose `raw` and `JSON`, then paste:

```json
{
  "provider": "google",
  "token": "<google-credential-id-token>"
}
```

5. Click `Send`.
6. Success is a `200 OK` response containing `access`, `refresh`, `token_type`, and `user`.

Do not use Postman's `Authorization` tab for this request. The Google token goes in the JSON body as `token`.

If you use Postman to get the Google token first, request OAuth scopes `openid email profile` and copy the returned `id_token`. Do not copy `access_token`; CatSOS verifies Google ID tokens only.

If testing fails, check only these three things first:

- `GOOGLE_OAUTH_CLIENT_ID` matches the Google Web Client used by the frontend.
- Google Cloud has `http://localhost:5173` as an authorized JavaScript origin.
- The frontend sends the Google `credential` value, not another token type.

If Postman shows `socket hang up`, the request probably did not reach a running Django app. Check the backend first:

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:8000/api/health/"
docker compose ps
docker compose logs --tail 80 backend
```

If the backend container is unhealthy or logs show missing Python packages, rebuild and migrate:

```powershell
docker compose up -d --build backend
docker compose exec backend python manage.py migrate
```

After that, the placeholder token request should return `400 Bad Request` with:

```json
{
  "token": ["Invalid Google ID token."]
}
```

That `400` means the endpoint is reachable. To get `200 OK`, replace the placeholder with a real Google ID token.

## Password Recovery Configuration

Password reset links use the configured frontend origin:

```text
DJANGO_FRONTEND_URL=http://localhost:5173
DJANGO_PASSWORD_RESET_TIMEOUT=3600
DJANGO_EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
DJANGO_DEFAULT_FROM_EMAIL=no-reply@catsos.local
DJANGO_TOTP_ISSUER_NAME=CatSOS
DJANGO_TOTP_STEP_SECONDS=30
DJANGO_TOTP_DIGITS=6
DJANGO_TOTP_WINDOW=1
```

`DJANGO_PASSWORD_RESET_TIMEOUT` is in seconds. Django's local console email backend is enough for development.
`DJANGO_TOTP_WINDOW=1` accepts one 30-second step before or after the current authenticator-app code to tolerate small clock drift.

## Throttling

Auth-sensitive endpoints and public profile lookups use scoped DRF throttling.

Default local rates:

| Scope | Default |
| --- | --- |
| Register | `20/hour` |
| Verify email | `30/minute` |
| Resend verification | `10/hour` |
| Change verification email | `10/hour` |
| Login | `20/minute` |
| Token refresh | `60/minute` |
| SSO login | `20/minute` |
| SSO link | `20/minute` |
| Public profile | `120/minute` |
| Lost report read | `120/minute` |
| Lost report write | `30/minute` |
| Sighting write | `30/minute` |
| Password reset per email | `5/hour` |
| Password reset per IP | `10/hour` |

Environment overrides:

```text
DJANGO_AUTH_REGISTER_RATE=20/hour
DJANGO_AUTH_VERIFY_RATE=30/minute
DJANGO_AUTH_RESEND_RATE=10/hour
DJANGO_AUTH_CHANGE_EMAIL_RATE=10/hour
DJANGO_AUTH_LOGIN_RATE=20/minute
DJANGO_AUTH_TOKEN_REFRESH_RATE=60/minute
DJANGO_AUTH_SSO_LOGIN_RATE=20/minute
DJANGO_AUTH_SSO_LINK_RATE=20/minute
DJANGO_PUBLIC_PROFILE_RATE=120/minute
DJANGO_LOST_REPORT_READ_RATE=120/minute
DJANGO_LOST_REPORT_WRITE_RATE=30/minute
DJANGO_SIGHTING_WRITE_RATE=30/minute
DJANGO_PASSWORD_RESET_EMAIL_RATE_LIMIT_PER_HOUR=5
DJANGO_PASSWORD_RESET_IP_RATE_LIMIT_PER_HOUR=10
```

When a throttle limit is exceeded, DRF returns:

```text
HTTP 429 Too Many Requests
```

## Automated Backend Checks

Run from `backend/`:

```powershell
..\.venv\Scripts\python.exe manage.py check
..\.venv\Scripts\python.exe manage.py test
..\.venv\Scripts\python.exe manage.py spectacular --file openapi-schema.yml --validate
```
