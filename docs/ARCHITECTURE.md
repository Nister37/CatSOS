# CatSOS Architecture & System Design

This document details the architectural boundaries, domain flows, security controls, and design patterns of the CatSOS platform.

---

## 1. System Overview

CatSOS connects pet owners, community finders, volunteers, and shelters through a geo-enabled lost-and-found registry:

```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ React Frontend  │ ────> │  Django REST    │ ────> │ SQLite /        │
│ SPA (Leaflet)   │       │  Framework API  │       │ PostgreSQL DB   │
└─────────────────┘       └─────────────────┘       └─────────────────┘
                                   │
                   ┌───────────────┼───────────────┐
                   ▼               ▼               ▼
           ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
           │ Overpass API │ │ Google Gemma │ │ SMTP /       │
           │ (Maps/Vets)  │ │ (AI Assist)  │ │ Console Mail │
           └──────────────┘ └──────────────┘ └──────────────┘
```

---

## 2. Core Backend Modules

- **`accounts/`**: User registration, email verification (8-digit code cooldown), JWT authentication, profile pictures, multi-provider SSO (Google, Microsoft), and TOTP authenticator-app 2FA.
- **`reports/`**: Lost cat reports, public/private photo management, public UUID mapping, report status lifecycle (`MISSING`, `RECENTLY_SEEN`, `FOUND`, `CLOSED`), and timeline event logging.
- **`sightings/`**: Community sightings submission with geolocation coordinates, photo evidence, owner verification (`PENDING`, `USEFUL`, `FALSE`), and volunteer search party registration.
- **`maps/`**: Overpass OSM proxy querying nearby veterinary clinics, pet hospitals, and animal shelters with in-memory / disk caching and upstream retry logic.
- **`assistant/`**: Found cat triage assistant featuring interactive decision tree guidance and shelter intake submission.
- **`ai/`**: Optional Gemma AI assistance for improving lost cat descriptions, generating multilingual translation suggestions, and drafting poster texts.
- **`points/`**: Gamification and badge system rewarding helpful sightings, active search participation, and successful reunions.
- **`notifications/`**: In-app notifications alerting owners about new sightings and verification status updates.

---

## 3. Frontend Architecture

The frontend (`frontend/`) is a Single Page Application crafted with:
- **React 19 & Vite**: Ultra-fast build and reactive state rendering.
- **Redux Toolkit**: Centralized store for authentication, active reports, language selection, and notification state.
- **React-Leaflet & OpenStreetMap**: Interactive map clustering, radius search, custom SVG cat markers, and user geolocation tracking.
- **Internationalization (i18n)**: Multilingual support for English (`en`), Polish (`pl`), Dutch (`nl`), and French (`fr`).
- **Accessibility (A11y)**: ARIA standards, keyboard navigation, high-contrast modes, tested via Cypress Axe and Jest A11y tests.

---

## 4. Security & Trust Boundaries

- **Public vs Private Isolation**: Public report endpoints (`/api/public/reports/`) expose only non-sensitive descriptors and fuzz locations, hiding exact home addresses and contact phones.
- **Rate Limiting & Throttling**: Strict IP and user throttling on auth endpoints, email resends, and AI generation.
- **No Secrets in Client Builds**: All OAuth secrets remain on backend or use PKCE / client ID tokens without exposed secrets.
