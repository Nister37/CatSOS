# CatSOS API

Base URL for local development:

```text
http://127.0.0.1:8000
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
| `GET` | `/api/health/` | Public | `200` | Backend health check. |
| `POST` | `/api/auth/register/` | Public | `201` | Create an unverified account and send an 8-digit email code. |
| `POST` | `/api/auth/verify-email/` | Public | `200` | Verify the 8-digit email code and return JWT tokens. |
| `POST` | `/api/auth/verification/resend/` | Public | `200` | Resend the verification code after the 120-second cooldown. |
| `POST` | `/api/auth/verification/change-email/` | Public | `200` | Change the email for an unverified account and send a new code. |
| `POST` | `/api/auth/login/` | Public | `200` | Login alias that returns JWT tokens. |
| `POST` | `/api/auth/token/` | Public | `200` | Login endpoint that returns JWT tokens. |
| `POST` | `/api/auth/token/refresh/` | Public | `200` | Exchange a refresh token for a new access token. |
| `POST` | `/api/auth/password-reset/` | Public | `200` | Request an email password reset link without revealing account existence. |
| `POST` | `/api/auth/password-reset/confirm/` | Public | `200` | Reset a password with a valid `uid` and Django reset token. |
| `POST` | `/api/auth/password-reset/totp/` | Public | `200` | Reset a password with email plus a valid enrolled TOTP code. |
| `POST` | `/api/auth/password-change/` | JWT | `200` | Change the authenticated user's password after current-password verification. |
| `POST` | `/api/auth/sso/login/` | Public | `200` | Login or create an account with Google, GitHub, or Microsoft SSO. |
| `POST` | `/api/auth/sso/link/` | JWT | `200` | Link Google, GitHub, or Microsoft SSO to the authenticated account. |
| `POST` | `/api/auth/totp/setup/` | JWT | `200` | Start authenticator-app setup and return the secret plus otpauth URI. |
| `POST` | `/api/auth/totp/confirm/` | JWT | `200` | Confirm a valid authenticator code and enable TOTP. |
| `POST` | `/api/auth/totp/disable/` | JWT | `200` | Disable TOTP after current-password and TOTP verification. |
| `GET` | `/api/schema/` | Public | `200` | OpenAPI schema. |
| `GET` | `/api/docs/` | Public | `200` | Swagger UI. |

## Auth Payloads

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

## Manual Testing With PowerShell

Start the backend first:

```powershell
cd backend
..\.venv\Scripts\python.exe manage.py migrate
..\.venv\Scripts\python.exe manage.py runserver
```

Health check:

```powershell
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8000/api/health/"
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
  -Uri "http://127.0.0.1:8000/api/auth/register/" `
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
  -Uri "http://127.0.0.1:8000/api/auth/verify-email/" `
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
  -Uri "http://127.0.0.1:8000/api/auth/verification/resend/" `
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
  -Uri "http://127.0.0.1:8000/api/auth/verification/change-email/" `
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
  -Uri "http://127.0.0.1:8000/api/auth/token/" `
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
  -Uri "http://127.0.0.1:8000/api/auth/token/refresh/" `
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
  -Uri "http://127.0.0.1:8000/api/auth/password-reset/" `
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
  -Uri "http://127.0.0.1:8000/api/auth/password-reset/confirm/" `
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
  -Uri "http://127.0.0.1:8000/api/health/" `
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
  -Uri "http://127.0.0.1:8000/api/auth/password-change/" `
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
  -Uri "http://127.0.0.1:8000/api/auth/totp/setup/" `
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
  -Uri "http://127.0.0.1:8000/api/auth/totp/confirm/" `
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
  -Uri "http://127.0.0.1:8000/api/auth/password-reset/totp/" `
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
  -Uri "http://127.0.0.1:8000/api/auth/register/" `
  -ContentType "application/json" `
  -Body $badBody
```

`Invoke-RestMethod` throws for non-2xx responses. To inspect validation responses without stopping:

```powershell
try {
  Invoke-RestMethod `
    -Method Post `
    -Uri "http://127.0.0.1:8000/api/auth/register/" `
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
  -Uri "http://127.0.0.1:8000/api/auth/sso/login/" `
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
  -Uri "http://127.0.0.1:8000/api/auth/sso/link/" `
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

Auth-sensitive endpoints use scoped DRF throttling.

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
