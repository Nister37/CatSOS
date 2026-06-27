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
| `POST` | `/api/auth/register/` | Public | `201` | Create an account and return JWT tokens. |
| `POST` | `/api/auth/login/` | Public | `200` | Login alias that returns JWT tokens. |
| `POST` | `/api/auth/token/` | Public | `200` | Login endpoint that returns JWT tokens. |
| `POST` | `/api/auth/token/refresh/` | Public | `200` | Exchange a refresh token for a new access token. |
| `GET` | `/api/schema/` | Public | `200` | OpenAPI schema. |
| `GET` | `/api/docs/` | Public | `200` | Swagger UI. |

## Auth Payloads

### Register

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
  "access": "<jwt-access-token>",
  "refresh": "<jwt-refresh-token>",
  "token_type": "Bearer",
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

## Automated Backend Checks

Run from `backend/`:

```powershell
..\.venv\Scripts\python.exe manage.py check
..\.venv\Scripts\python.exe manage.py test
..\.venv\Scripts\python.exe manage.py spectacular --file openapi-schema.yml --validate
```
