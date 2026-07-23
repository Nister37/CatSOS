# Portfolio Improvements Roadmap

**Date:** 2026-07-23  
**Purpose:** Prioritized list of improvements to make CatSOS portfolio-ready and production-capable.

---

## Priority 1: Infrastructure (Production Essentials)

### 1.1 Switch to PostgreSQL

- Replace SQLite with PostgreSQL for concurrent access, proper indexing, full-text search, and production reliability.
- Update `DATABASES` setting to use `django.db.backends.postgresql`.
- Add `psycopg[binary]` to `requirements.txt`.
- Update Docker Compose to include a PostgreSQL service.

### 1.2 Redis for Caching

- The nearby-help cache currently uses Django's in-memory `LocMemCache` (default).
- Add Redis as a cache backend for persistence across restarts and shared state between workers.
- Add `django-redis` to requirements.
- Configure `CACHES` setting with Redis URL from environment.

### 1.3 Celery for Async Tasks

- Move email sending, AI API calls, and notification creation to background tasks.
- Add `celery[redis]` to requirements.
- Create `catsos/celery.py` configuration.
- Convert `send_email_notification()`, `generate_gemma_text()` wrappers to Celery tasks.
- Keeps request latency low and prevents timeout on slow AI/email operations.

### 1.4 Gunicorn + Nginx

- Use Gunicorn as the WSGI server (replace `runserver`).
- Use Nginx for static file serving, TLS termination, and rate limiting at the edge.
- Add `gunicorn` to requirements.
- Update Dockerfile entrypoint.

---

## Priority 2: Observability

### 2.1 Structured Logging

- Configure Django logging with JSON formatter.
- Add correlation/request IDs for tracing.
- Log key events: auth failures, report creation, sighting creation, moderation actions, AI failures.
- Ensure no secrets are logged (already partially handled).

### 2.2 Application Performance Monitoring

- Integrate Sentry (or equivalent) for error tracking and performance monitoring.
- Add `sentry-sdk[django]` to requirements.
- Configure DSN from environment variable.

### 2.3 Enhanced Healthcheck

- Current `/api/health/` returns static response.
- Add database connectivity check.
- Add cache availability check.
- Add optional AI service status check.
- Return degraded status if non-critical services are unavailable.

---

## Priority 3: Code Quality

### 3.1 Add `usedforsecurity=False` to MD5 Cache Key

- In `maps/services.py:188`, add parameter to suppress Bandit warning.
- `hashlib.md5(raw.encode(), usedforsecurity=False).hexdigest()`

### 3.2 Replace `urlopen` with `requests` in Overpass Client

- `maps/services.py` uses `urllib.request.urlopen` while the project already depends on `requests`.
- Using `requests` would provide consistent HTTP client usage, better error handling, and session reuse.

### 3.3 Add Type Hints to Service Functions

- Service functions (`reports/services.py`, `sightings/services.py`, etc.) lack return type annotations.
- Adding them improves IDE support and documentation.

### 3.4 Add `py.typed` Marker

- Signal to consumers that the package supports type checking.

---

## Priority 4: Features for Portfolio Completeness

### 4.1 API Versioning

- Add URL-based versioning (`/api/v1/`) to allow future breaking changes without disruption.

### 4.2 Webhook/Event System

- Add a simple webhook dispatch for report status changes.
- Enables external integrations (Slack notifications, third-party dashboards).

### 4.3 Export/GDPR Compliance

- Add user data export endpoint (`GET /api/me/export/`).
- Add account deletion endpoint (`DELETE /api/me/`) with cascade cleanup.
- Required for GDPR compliance in EU deployment.

### 4.4 Admin Dashboard API Expansion

- Add time-range filtering to stats endpoint.
- Add user management endpoints (suspend, unsuspend).
- Add bulk moderation actions.

### 4.5 Image Optimization Pipeline

- Resize uploaded images to standard dimensions.
- Generate thumbnails for list views.
- Convert to WebP for bandwidth efficiency.
- Store multiple sizes (thumbnail, medium, full).

---

## Priority 5: Testing & CI

### 5.1 Automated Dependency Scanning

- Add `safety check` or `pip-audit` to Jenkins pipeline.
- Fail builds on high-severity vulnerabilities.

### 5.2 Automated Code Security Scanning

- Add `bandit` to CI pipeline.
- Configure baseline to suppress known false positives.

### 5.3 Load Testing

- Add k6 or Locust load tests for key endpoints.
- Document expected throughput and latency.

### 5.4 Integration Tests with External Services

- Add integration tests for Overpass API (with VCR/recorded responses).
- Add integration tests for Gemma API (with mocked responses — already done).

---

## Priority 6: Documentation

### 6.1 Architecture Decision Records (ADRs)

- Document key decisions: SQLite for MVP, JWT in Authorization header, service layer pattern, AI privacy approach.

### 6.2 Deployment Guide

- Document production deployment steps.
- Include environment variable reference.
- Include database migration procedure.
- Include backup/restore procedure.

### 6.3 API Changelog

- Maintain a changelog for API breaking changes.
- Useful for frontend team coordination.

---

## What NOT to Add (Per Project Rules)

- MongoDB
- Microservices architecture
- Kafka/RabbitMQ
- Kubernetes
- GraphQL
- Django Channels/WebSockets
- Complex event bus
- Custom dependency injection

---

## Implementation Order (If Time Available)

1. PostgreSQL migration (highest impact, enables production deployment)
2. Structured logging (immediate observability benefit)
3. Enhanced healthcheck (demonstrates production awareness)
4. Redis caching (performance improvement)
5. `usedforsecurity=False` fix (trivial, removes Bandit warning)
6. Replace `urlopen` with `requests` (consistency)
7. Celery setup (enables async email/AI)
8. GDPR data export (legal compliance)
9. Image optimization (user experience)
10. API versioning (future-proofing)
