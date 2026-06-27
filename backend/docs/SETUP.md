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
