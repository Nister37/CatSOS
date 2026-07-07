# CatSOS Backend

Django backend for the CatSOS API.

## Entry Points

- Setup: [docs/SETUP.md](docs/SETUP.md)
- Backend tutorial and structure: [docs/TUTORIAL.md](docs/TUTORIAL.md)
- Django project settings: [config/settings.py](config/settings.py)
- API routes: [api/urls.py](api/urls.py)

## Local URLs

- API health: `http://localhost:8000/api/health/`
- Current user profile: `http://localhost:8000/api/me/`
- Current user profile picture: `http://localhost:8000/api/me/profile-picture/`
- Public contributor profile: `http://localhost:8000/api/profiles/<id>/`
- Lost cat reports: `http://localhost:8000/api/reports/`
- Lost cat report detail/edit: `http://localhost:8000/api/reports/<id>/`
- Lost cat report status: `http://localhost:8000/api/reports/<id>/status/`
- Lost cat report timeline: `http://localhost:8000/api/reports/<id>/timeline/`
- Similar nearby reports: `http://localhost:8000/api/reports/<id>/similar/`
- Lost cat report photos: `http://localhost:8000/api/reports/<id>/photos/`
- Lost cat report main photo: `http://localhost:8000/api/reports/<id>/photos/<photo_id>/main/`
- Public lost cat report list: `http://localhost:8000/api/public/reports/`
- Public lost cat report detail: `http://localhost:8000/api/public/reports/<public_id>/`
- Submit public report sighting: `http://localhost:8000/api/public/reports/<public_id>/sightings/`
- Mark searching nearby: `http://localhost:8000/api/public/reports/<public_id>/volunteer-searches/`
- Report volunteer searches: `http://localhost:8000/api/reports/<id>/volunteer-searches/`
- Account registration: `http://localhost:8000/api/auth/register/`
- Account email verification: `http://localhost:8000/api/auth/verify-email/`
- Resend verification code: `http://localhost:8000/api/auth/verification/resend/`
- Change pending verification email: `http://localhost:8000/api/auth/verification/change-email/`
- Account login: `http://localhost:8000/api/auth/login/`
- JWT token login: `http://localhost:8000/api/auth/token/`
- JWT token refresh: `http://localhost:8000/api/auth/token/refresh/`
- Password reset request: `http://localhost:8000/api/auth/password-reset/`
- Password reset confirm: `http://localhost:8000/api/auth/password-reset/confirm/`
- Password reset with TOTP: `http://localhost:8000/api/auth/password-reset/totp/`
- Logged-in password change: `http://localhost:8000/api/auth/password-change/`
- SSO login/signup: `http://localhost:8000/api/auth/sso/login/`
- Link SSO provider: `http://localhost:8000/api/auth/sso/link/`
- TOTP setup: `http://localhost:8000/api/auth/totp/setup/`
- TOTP confirm: `http://localhost:8000/api/auth/totp/confirm/`
- TOTP disable: `http://localhost:8000/api/auth/totp/disable/`
- OpenAPI schema: `http://localhost:8000/api/schema/`
- Swagger UI: `http://localhost:8000/api/docs/`

Registration sends an 8-digit email verification code. Email verification and login return JWT access and refresh tokens. Authenticated API requests should send the access token as `Authorization: Bearer <access>`.

Password recovery uses email reset links built from `DJANGO_FRONTEND_URL`, Django's default token generator, and enrolled authenticator-app TOTP codes as the second recovery option. Reset requests never return reset tokens in JSON. Successful password reset and logged-in password change send confirmation emails. SMS password recovery is intentionally not implemented in the MVP because it adds cost and weaker security. CatSOS uses email reset links, TOTP recovery, and logged-in password change with current-password verification. When TOTP is enabled, login, password change, and SSO provider linking require a valid authenticator code.

SSO login supports Google, GitHub, and Microsoft. Configure provider client IDs with `GOOGLE_OAUTH_CLIENT_ID` and `MICROSOFT_OAUTH_CLIENT_ID`; GitHub uses the provider access token to fetch the authenticated user's verified primary email.

Authenticated users can upload, replace, and delete their profile picture through `/api/me/profile-picture/`. The backend accepts JPEG, PNG, and WebP images up to `DJANGO_PROFILE_PICTURE_MAX_SIZE_BYTES` bytes, stores them under media storage with generated filenames, and returns `/api/me/` profile data with `profile_picture_url` plus `avatar_fallback` for users without an image.

Public contributor profiles are available at `/api/profiles/<id>/` for active, email-verified users with public activity. The response includes display name, profile picture, points, badges, and explicit public info only. Account email is never returned unless a separate public contact email is set.

Authenticated owners can create and list their own lost cat reports through `/api/reports/` and retrieve or edit one owned report through `/api/reports/<id>/`. Creation and editing cover cat details, disappearance location, optional reward, and contact preferences. Report creation also accepts an optional multipart `photo` file field. Owners can manage the gallery for one owned report through `/api/reports/<id>/photos/`, choose the main photo through `/api/reports/<id>/photos/<photo_id>/main/`, and delete incorrect photos through `/api/reports/<id>/photos/<photo_id>/`. The backend accepts JPEG, PNG, and WebP report photos up to `DJANGO_REPORT_PHOTO_MAX_SIZE_BYTES` bytes, stores them under media storage with generated filenames, and never exposes original filenames or storage paths through public photo responses. Owners can change status through `/api/reports/<id>/status/`, including an optional safe found message for `FOUND` or `CLOSED` reports. Resolved reports keep `found_message`, `resolved_at`, and `is_active_search=false`; reopened reports clear resolved metadata. The owner report list supports `active=true` and `active=false` filters. Report creation, sighting creation, and status changes record chronological timeline events readable through `/api/reports/<id>/timeline/`. Staff moderation is handled separately in Django admin through the report moderation fields.

Owners can fetch deterministic similar nearby report suggestions through `/api/reports/<id>/similar/`. The current matcher is AI-free and uses approximate distance plus simple breed, coat, and gender matches. Suggested reports use the public-safe card shape and exclude hidden or resolved candidates.

Public lost-cat report browsing is available through `/api/public/reports/`, defaulting to active searches and supporting `active` and `status` filters. Public report cards include `detail_url`, status, location summary, disappearance date, `main_photo`, and `latest_sighting`. Public report details are available through `/api/public/reports/<public_id>/`. Public `latest_sighting` summaries prefer confirmed useful sightings and fall back to the latest pending sighting when no confirmed sighting exists; false sightings are excluded, and the summary includes the sighting verification status for UI labeling. Public responses use the report `public_id`, approximate coordinates, public-safe contact instructions, URL-only photo objects, and status timeline events without actor private data. They do not expose owner IDs, exact addresses, chip numbers, notification preferences, moderation fields, original photo filenames, storage paths, sighting notes, or helper identity.

Authenticated helpers can submit sightings for active public reports through `/api/public/reports/<public_id>/sightings/`. The endpoint requires JWT authentication, stores timestamp, coordinates, location notes, confidence, and description notes, and creates a `SIGHTING_CREATED` report timeline event. It also accepts an optional multipart `photo` file field. The backend accepts JPEG, PNG, and WebP sighting photos up to `DJANGO_SIGHTING_PHOTO_MAX_SIZE_BYTES` bytes, stores them with generated filenames, and returns URL-only photo objects. Hidden reports return `404`; resolved reports reject new sightings.

Authenticated helpers can also mark that they are searching nearby through `/api/public/reports/<public_id>/volunteer-searches/`. The first action creates a `VOLUNTEER_SEARCH_STARTED` timeline event; repeated actions refresh the existing volunteer-search record instead of creating duplicates. Report owners and staff can list helpers through `/api/reports/<id>/volunteer-searches/`. Responses expose safe display summaries only, without helper email, phone, or internal user IDs.

Report owners can review all sightings for their own reports through `/api/reports/<id>/sightings/`, including sightings marked false. Owners and staff can set a sighting verification status through `/api/reports/<id>/sightings/<sighting_id>/verification/` using `PENDING`, `USEFUL`, or `FALSE`. Useful and false decisions create sighting review timeline events; useful sightings also drive the public `latest_sighting` summary. These owner/admin responses expose safe submitter and verifier summaries only, without account email or phone fields.

Auth endpoints and public profile responses return `Cache-Control: no-store` and are protected by scoped DRF throttles or cache-backed reset limits. Verification-code resend cooldowns and password reset rate limits return `429 Too Many Requests` with `Retry-After`.
