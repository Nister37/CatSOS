# CatSOS 🐱

> Community-driven lost and found cat reunion platform featuring interactive sighting maps, volunteer search alerts, AI description enhancement, and automated poster generation.

<p align="center">
  <img src="https://img.shields.io/badge/python-3.14-blue" alt="Python" />
  <img src="https://img.shields.io/badge/django-6.0-green" alt="Django" />
  <img src="https://img.shields.io/badge/react-19-cyan" alt="React" />
  <img src="https://img.shields.io/badge/leaflet-1.9-brightgreen" alt="Leaflet" />
  <img src="https://img.shields.io/badge/docker-compose-blueviolet" alt="Docker" />
</p>

---

## 🌟 What is CatSOS?

When a beloved cat goes missing, every hour counts. **CatSOS** provides neighborhood communities, cat owners, and volunteer searchers with a unified platform to coordinate search efforts:

- 🗺️ **Interactive Geolocation Maps**: Plot and track lost cat reports, sightings, and nearby veterinary clinics / shelters with Leaflet.
- 📸 **Photo Sighting Verification**: Upload sightings with photos and map pins; owners can verify leads as pending, useful, or false.
- 📄 **Automated PDF Poster & QR Generator**: Instantly generate ready-to-print flyers with QR codes pointing to live report updates.
- 🤖 **AI-Assisted Descriptions**: Optional Gemma AI cleanup of lost-cat details and automatic multilingual translation suggestions.
- 🌳 **"I Found a Cat" Decision Tree**: Step-by-step triage assistant guiding finders on safe handling, scanning for microchips, and shelter intake.
- 🌐 **Multilingual & Accessible**: Native support for English, Polish, Dutch, and French with WCAG AAA accessibility standards.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python 3.14, Django 6.0, Django REST Framework, drf-spectacular (OpenAPI 3.0) |
| **Frontend** | React 19, Vite, Redux Toolkit, Leaflet / React-Leaflet, Tailwind CSS |
| **Authentication** | JWT, TOTP Authenticator 2FA, OAuth SSO (Google, Microsoft) |
| **Database & Maps** | SQLite 3 (Dev) / PostgreSQL (Prod), Overpass OpenStreetMap API |
| **Testing** | Django Test Runner (410+ tests), Jest, React Testing Library, Cypress, Cypress Axe |

---

## 🚀 Quickstart (One Command)

The fastest way to launch CatSOS with both backend and frontend running:

### 1. Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Git](https://git-scm.com/)

### 2. Launch
```bash
# 1. Clone repository
git clone https://github.com/Nister37/CatSOS.git
cd CatSOS

# 2. Configure local environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Start containers
docker compose up --build
```

### 3. Open in Browser
- 🌐 **Web Client**: [http://localhost:5173](http://localhost:5173)
- 🔌 **Backend REST API**: [http://localhost:8000/api/](http://localhost:8000/api/)
- 📖 **Interactive Swagger UI**: [http://localhost:8000/api/docs/](http://localhost:8000/api/docs/)

---

## 💻 Local Development Setup

If you wish to develop without Docker:

### 1. Backend Setup
```powershell
cd backend

# Create & activate virtualenv
python -m venv .venv
.\.venv\Scripts\activate   # Linux/macOS: source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy configuration
cp .env.example .env

# Run migrations & start server
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

### 2. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Copy configuration
cp .env.example .env

# Start Vite development server
npm run dev
```

---

## 🧪 Testing

CatSOS maintains comprehensive test coverage across both backend and frontend:

```powershell
# Run backend Django tests (412 tests)
python backend/manage.py test

# Validate OpenAPI schema against DRF Spectacular
python backend/manage.py spectacular --validate

# Run frontend tests with coverage (318 tests)
npm --prefix frontend test

# Run frontend accessibility (A11y) audit
npm --prefix frontend run a11y

# Run production build check
npm --prefix frontend run build
```

---

## 📚 Deep Dive Documentation

- 📜 **Full REST API Reference**: [API.md](API.md)
- 🏗️ **Architecture & Domain Design**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 💻 **Backend Guide**: [backend/README.md](backend/README.md)
- 🎨 **Frontend Guide**: [frontend/README.md](frontend/README.md)
- 📮 **Postman Collection & Flows**: [postman/POSTMAN.md](postman/POSTMAN.md)
- 🚀 **CI/CD & Jenkins Pipeline**: [jenkins/README.md](jenkins/README.md)
- 🌿 **Git & Branching Workflow**: [GIT.md](GIT.md)
