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

Authenticated owners can create and list their own lost cat reports through `/api/reports/` and retrieve or edit one owned report through `/api/reports/<id>/`. Creation and editing cover cat details, disappearance location, optional reward, and contact preferences. Owners can change status through `/api/reports/<id>/status/`, including an optional safe found message for `FOUND` or `CLOSED` reports. Resolved reports keep `found_message`, `resolved_at`, and `is_active_search=false`; reopened reports clear resolved metadata. The owner report list supports `active=true` and `active=false` filters. Status changes record `STATUS_CHANGED` timeline events readable through `/api/reports/<id>/timeline/`. Photo management is handled by a separate API. Staff moderation is handled separately in Django admin through the report moderation fields.

Auth endpoints and public profile responses return `Cache-Control: no-store` and are protected by scoped DRF throttles or cache-backed reset limits. Verification-code resend cooldowns and password reset rate limits return `429 Too Many Requests` with `Retry-After`.
