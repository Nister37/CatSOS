# CatSOS

CatSOS is a training-oriented full-stack workspace for a Django REST API and a React SPA.

## Project layout

```text
backend/   Django, Django REST Framework, OpenAPI
frontend/  React SPA, Vite, Yarn, Jest, Cypress, accessibility tooling
jenkins/   Jenkins image and setup docs for the shared CI server
```

## Start Here

- Backend entry point: [backend/README.md](backend/README.md)
- Frontend entry point: [frontend/README.md](frontend/README.md)
- Full API reference: [API.md](API.md)
- Git and pull request workflow: [GIT.md](GIT.md)
- Postman collection: [postman/POSTMAN.md](postman/POSTMAN.md)
- Jenkins setup and usage: [jenkins/README.md](jenkins/README.md)

## Docker Entry Points

There are three Compose files on purpose: `docker-compose.yml` is the small local development stack, `docker-compose.ci.yml` builds the CI test stack, and `docker-compose.jenkins.yml` runs the Jenkins server.

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
docker compose -f docker-compose.jenkins.yml up --build jenkins
```

Run the full Jenkins pipeline before merging any backend or frontend branch into `main`. See [jenkins/README.md](jenkins/README.md) for the Jenkins UI flow and the equivalent local Docker Compose commands.

CI containers and tools:

```text
backend-test      Python 3.14, Django checks, Django tests
backend-openapi   Python 3.14, Django, drf-spectacular
backend-api       Python 3.14, Django development server
frontend-quality  Node 26, Yarn 1, ESLint, Jest, TypeScript
frontend-dev      Node 26, Yarn 1, Vite development server
frontend-e2e      Cypress, Node, Yarn, Testing Library Cypress, Cypress Axe
frontend-runtime  Node/Yarn/TypeScript/Vite build, nginx runtime
```

Jenkins server:

```text
jenkins           Jenkins LTS, JDK 21, Docker CLI, Docker Compose plugin
```

Detailed setup lives in each layer's `docs/SETUP.md`; development conventions live in each `docs/TUTORIAL.md`.

Backend password recovery uses email reset links and enrolled authenticator-app TOTP. Configure the reset-link origin, email backend, and TOTP defaults in `backend/.env`; SMS password recovery is intentionally not implemented because it adds cost and weaker security.
