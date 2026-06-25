# Frontend Setup

This file is only about preparing and running the frontend. Architecture and conventions are in [TUTORIAL.md](TUTORIAL.md).

## Requirements

- Node.js 26
- Yarn 1.22.22
- Docker Desktop, optional but recommended for the intern workflow

If Yarn is not installed globally, use:

```powershell
npx.cmd -y yarn@1.22.22 <command>
```

## Local Setup

From the frontend directory:

```powershell
cd frontend
npx.cmd -y yarn@1.22.22 install
Copy-Item .env.example .env
```

Start Vite:

```powershell
npx.cmd -y yarn@1.22.22 dev
```

## Frontend Checks

Run unit tests and accessibility checks:

```powershell
cd frontend
npx.cmd -y yarn@1.22.22 test
npx.cmd -y yarn@1.22.22 a11y
```

Run lint and production build:

```powershell
cd frontend
npx.cmd -y yarn@1.22.22 lint
npx.cmd -y yarn@1.22.22 build
```

Run Cypress:

```powershell
cd frontend
npx.cmd -y yarn@1.22.22 e2e:ci
```

## Docker Setup

Run only the frontend service:

```powershell
docker compose up --build frontend
```

Run frontend CI checks in containers:

```powershell
docker compose -f docker-compose.ci.yml run --rm frontend-quality
docker compose -f docker-compose.ci.yml up --abort-on-container-exit --exit-code-from frontend-e2e frontend-e2e
docker compose -f docker-compose.ci.yml build frontend-runtime
```
