# CatSOS Backend

Django backend for the CatSOS API.

## Entry Points

- Setup: [docs/SETUP.md](docs/SETUP.md)
- Backend tutorial and structure: [docs/TUTORIAL.md](docs/TUTORIAL.md)
- Django project settings: [config/settings.py](config/settings.py)
- API routes: [api/urls.py](api/urls.py)

## Local URLs

- API health: `http://127.0.0.1:8000/api/health/`
- Account registration: `http://127.0.0.1:8000/api/auth/register/`
- Account email verification: `http://127.0.0.1:8000/api/auth/verify-email/`
- Resend verification code: `http://127.0.0.1:8000/api/auth/verification/resend/`
- Change pending verification email: `http://127.0.0.1:8000/api/auth/verification/change-email/`
- Account login: `http://127.0.0.1:8000/api/auth/login/`
- JWT token login: `http://127.0.0.1:8000/api/auth/token/`
- JWT token refresh: `http://127.0.0.1:8000/api/auth/token/refresh/`
- OpenAPI schema: `http://127.0.0.1:8000/api/schema/`
- Swagger UI: `http://127.0.0.1:8000/api/docs/`

Registration sends an 8-digit email verification code. Email verification and login return JWT access and refresh tokens. Authenticated API requests should send the access token as `Authorization: Bearer <access>`.
