# CatSOS API

Base URL for local development:

```text
http://127.0.0.1:8000
```

Authenticated requests use JWT access tokens:

```text
Authorization: Bearer <access>
```

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
| `POST` | `/api/auth/sso/login/` | Public | `200` | Login or create an account with Google, GitHub, or Microsoft SSO. |
| `POST` | `/api/auth/sso/link/` | JWT | `200` | Link Google, GitHub, or Microsoft SSO to the authenticated account. |
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
  "password": "StrongPass123!"
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
  "token": "<provider-token>"
}
```

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

## Automated Backend Checks

Run from `backend/`:

```powershell
..\.venv\Scripts\python.exe manage.py check
..\.venv\Scripts\python.exe manage.py test
..\.venv\Scripts\python.exe manage.py spectacular --file openapi-schema.yml --validate
```
