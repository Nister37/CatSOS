# CatSOS

CatSOS is a training-oriented full-stack workspace for a Django REST API and a React SPA.

## Project layout

```text
backend/   Django, Django REST Framework, OpenAPI
frontend/  React SPA, Vite, Yarn, Jest, Cypress, accessibility tooling
jenkins/   Local Jenkins image used by the CI Compose stack
```

## Start Here

- Backend entry point: [backend/README.md](backend/README.md)
- Frontend entry point: [frontend/README.md](frontend/README.md)
- Local Jenkins: [jenkins/README.md](jenkins/README.md)

## Docker Entry Points

There are two Compose files on purpose: `docker-compose.yml` is the small local development stack, while `docker-compose.ci.yml` builds the CI/Jenkins test stack.

Run the app stack:

```powershell
docker compose up --build
```

Run CI-like checks through Docker builders:

```powershell
docker compose -f docker-compose.ci.yml run --rm backend-test
docker compose -f docker-compose.ci.yml run --rm frontend-quality
```

Start local Jenkins for the same CI pipeline:

```powershell
docker compose -f docker-compose.ci.yml up --build jenkins
```

CI containers and tools:

```text
backend-test      Python 3.14, Django checks, Django tests
backend-openapi   Python 3.14, Django, drf-spectacular
backend-api       Python 3.14, Django development server
frontend-quality  Node 26, Yarn 1, ESLint, Jest, TypeScript, Vite
frontend-dev      Node 26, Yarn 1, Vite development server
frontend-e2e      Cypress, Node, Yarn, Testing Library Cypress, Cypress Axe
frontend-runtime  Node/Yarn/TypeScript/Vite build, nginx runtime
jenkins           Jenkins LTS, JDK 21, Docker CLI, Docker Compose plugin
```

Detailed setup lives in each layer's `docs/SETUP.md`; development conventions live in each `docs/TUTORIAL.md`.
