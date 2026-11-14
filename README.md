# CatSOS

> Community-powered search network for lost and spotted cats with interactive maps, volunteer alerts, and automated poster generation.

<p align="center">
  <img src="docs/assets/catsos-logo.svg" alt="CatSOS Logo" width="160" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-%3E%3D3.13-blue" alt="Python" />
  <img src="https://img.shields.io/badge/Django-6.0-green" alt="Django" />
  <img src="https://img.shields.io/badge/DRF-Spectacular-teal" alt="DRF Spectacular" />
  <img src="https://img.shields.io/badge/React-19-cyan" alt="React" />
  <img src="https://img.shields.io/badge/Leaflet-1.9-brightgreen" alt="Leaflet" />
  <img src="https://img.shields.io/badge/Docker-Compose-blueviolet" alt="Docker" />
</p>

---

## Overview

When a family cat goes missing, every hour counts. Coordinating local searchers across social media groups and text threads is chaotic and slow.

**CatSOS** provides:
- **Interactive Sighting Maps**: Plot lost cat reports, sightings, and nearby veterinary clinics or shelters in real time with Leaflet.
- **Photo Sighting Verification**: Upload sightings with photos and map pins; owners confirm or reject leads as pending, useful, or false.
- **Instant Printable Flyers**: Automatically generate ready-to-print PDF posters with QR codes pointing to live report updates.
- **AI-Enhanced Descriptions**: Optional Gemma AI cleanup of lost-cat physical traits and automatic multilingual translation suggestions.
- **Found Cat Decision Tree**: Step-by-step triage guide for safe handling, microchip scanning, and shelter intake.
- **Multilingual & Accessible**: Native support for English, Polish, Dutch, and French following WCAG AAA accessibility standards.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python 3.13+, Django 6.0, Django REST Framework, drf-spectacular (OpenAPI 3.0) |
| **Frontend** | React 19, Vite, Redux Toolkit, Leaflet / React-Leaflet, Tailwind CSS |
| **Authentication** | JWT, TOTP Authenticator 2FA, OAuth SSO (Google, Microsoft) |
| **Database & Maps** | SQLite 3 (Dev) / PostgreSQL (Prod), Overpass OpenStreetMap API |
| **Testing** | Django Test Runner (418 tests), Jest, React Testing Library, Cypress, Cypress Axe |

---

## Quickstart (Docker Compose)

The fastest way to launch the complete CatSOS stack (Backend REST API, Database, and Web UI) is via Docker Compose:

### 1. Prerequisites
- Docker Desktop (Docker Compose v2+)
- Git

### 2. Launch
```bash
# 1. Clone repository
git clone https://github.com/Nister37/CatSOS.git
cd CatSOS

# 2. Configure local environment
cp .env.example .env

# 3. Start all services
docker compose up -d
```

### 3. Service URLs
- **Web Application**: [http://localhost:5173](http://localhost:5173)
- **Backend REST API**: [http://localhost:8000/api/](http://localhost:8000/api/)
- **Interactive Swagger UI**: [http://localhost:8000/api/docs/](http://localhost:8000/api/docs/)

---

## Local Development Setup

If you prefer running services directly on your host machine:

### 1. Backend Setup (Django API)
```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate       # Windows: .\.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure local environment & run migrations
cp .env.example .env
python manage.py migrate

# Start backend server (Port 8000)
python manage.py runserver 0.0.0.0:8000
```

### 2. Frontend Setup (React Client)
```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Start Vite development server (Port 5173)
npm run dev
```

---

## Testing

CatSOS features comprehensive automated test coverage across both backend and frontend:

```bash
# Run backend Django tests (418 tests)
python backend/manage.py test

# Validate OpenAPI schema against DRF Spectacular
python backend/manage.py spectacular --validate

# Run frontend tests (318 tests)
npm --prefix frontend test

# Run frontend accessibility (A11y) audit
npm --prefix frontend run a11y

# Run frontend production build check
npm --prefix frontend run build
```

---

## Deep Dive Documentation

For advanced architecture, API specifications, and operational guides, see the dedicated documentation in `/docs`:
- **System Architecture & Domain Design**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Full REST API Reference**: [API.md](API.md)
- **Backend Service Guide**: [backend/README.md](backend/README.md)
- **Frontend Architecture & Components**: [frontend/README.md](frontend/README.md)
- **Security Audit & Hardening**: [backend/docs/SECURITY_AUDIT.md](backend/docs/SECURITY_AUDIT.md)
- **Postman Flows & Collection**: [postman/POSTMAN.md](postman/POSTMAN.md)
- **CI/CD & Jenkins Automation**: [jenkins/README.md](jenkins/README.md)
- **Git & Branching Workflow**: [GIT.md](GIT.md)
