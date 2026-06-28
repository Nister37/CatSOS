# Backend Setup

This file is only about preparing and running the backend. Project conventions are in [TUTORIAL.md](TUTORIAL.md).

## Requirements

- Python 3.14
- Docker Desktop, optional but recommended for the intern workflow

## Local Python Setup

From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r backend\requirements.txt
```

Copy environment defaults when you need local overrides:

```powershell
Copy-Item backend\.env.example backend\.env
```

Password recovery uses email reset links. Local development can use Django's console email backend:

```text
DJANGO_FRONTEND_URL=http://localhost:5173
DJANGO_EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
DJANGO_DEFAULT_FROM_EMAIL=no-reply@catsos.local
DJANGO_PASSWORD_RESET_TIMEOUT=3600
DJANGO_PASSWORD_RESET_EMAIL_RATE_LIMIT_PER_HOUR=5
DJANGO_PASSWORD_RESET_IP_RATE_LIMIT_PER_HOUR=10
```

SMS password recovery is intentionally not implemented in the MVP because it adds cost and weaker security. CatSOS uses email reset links and logged-in password change with current-password verification.

Run migrations and start Django:

```powershell
cd backend
python manage.py migrate
python manage.py runserver
```

This project uses a custom email-based user model. If your ignored local `backend\db.sqlite3` was created before the `accounts` app existed, recreate that local database before running migrations again.

## Backend Checks

Run Django checks and unit tests:

```powershell
cd backend
python manage.py check
python manage.py test
```

Generate and validate OpenAPI:

```powershell
cd backend
python manage.py spectacular --file openapi-schema.yml --validate
```

## Docker Setup

Run only the backend service:

```powershell
docker compose up --build backend
```

Run backend CI checks in containers:

```powershell
docker compose -f docker-compose.ci.yml run --rm backend-test
docker compose -f docker-compose.ci.yml run --rm backend-openapi
```
