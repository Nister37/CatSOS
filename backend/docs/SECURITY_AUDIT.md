# Security Audit Report

**Date:** 2026-07-23  
**Scope:** CatSOS backend (Django REST Framework)  
**Tools used:** safety 3.8.1, bandit 1.9.4, Django `check --deploy`, manual code review  
**Branch:** `chore/backend/security-and-quality-audit`

---

## 1. Dependency Vulnerabilities

**Tool:** `safety check -r requirements.txt`  
**Result:** 0 vulnerabilities found across 33 packages.

All pinned dependencies are up-to-date with no known CVEs as of the scan date.

---

## 2. Static Analysis (Bandit)

**Tool:** `bandit -r . --severity-level medium -q`  
**Result:** 2 findings (1 Medium, 1 High by Bandit severity)

### B310: `urlopen` with dynamic URL (Medium)

- **Location:** `maps/services.py:68`
- **Issue:** `urlopen()` is called with a URL constructed from settings (`OVERPASS_API_URL`).
- **Risk:** Low in practice — the URL comes from server-side settings, not user input. The Overpass API URL is validated at startup via env configuration.
- **Recommendation:** Acceptable for MVP. In production, consider using `requests` library instead (already a dependency) for better error handling and proxy support.

### B324: MD5 hash usage (High by Bandit, Low in practice)

- **Location:** `maps/services.py:188`
- **Issue:** MD5 is used to generate cache keys for nearby-help responses.
- **Risk:** None — MD5 is not used for security here, only as a fast hash for cache key generation from already-rounded coordinates. No collision resistance needed.
- **Recommendation:** Add `usedforsecurity=False` parameter to suppress the warning: `hashlib.md5(raw.encode(), usedforsecurity=False)`. This is a documentation/lint improvement, not a security fix.

---

## 3. Django Deploy Check

**Tool:** `python manage.py check --deploy`  
**Result:** 8 issues (all warnings, expected in development mode)

| Issue | Status | Notes |
|-------|--------|-------|
| security.W004 (HSTS) | ✅ Handled | Enabled when `DEBUG=False` in production block |
| security.W008 (SSL redirect) | ✅ Handled | Enabled when `DEBUG=False` in production block |
| security.W009 (SECRET_KEY) | ✅ Handled | Production block exits if insecure key is used |
| security.W012 (SESSION_COOKIE_SECURE) | ✅ Handled | Enabled when `DEBUG=False` |
| security.W016 (CSRF_COOKIE_SECURE) | ✅ Handled | Enabled when `DEBUG=False` |
| security.W018 (DEBUG=True) | Expected | Only in local development |
| drf_spectacular.W001 | Cosmetic | Duplicate enum naming, no security impact |
| drf_spectacular.W002 | Cosmetic | NearbyHelpView missing serializer_class hint |

**Verdict:** All security warnings are properly handled by the production hardening block in `settings.py`. The `DEBUG=True` warning is expected in local development.

---

## 4. Manual Code Review Findings

### 4.1 Authentication & Authorization ✅

- All write endpoints require `IsAuthenticated`.
- All `AllowAny` usages are appropriate:
  - Auth endpoints (register, login, verify, password reset, SSO)
  - Public read endpoints (public reports list/detail, leaderboard, assistant, maps, healthcheck)
- Object ownership is enforced (reports filter by `owner=request.user`).
- Staff-only admin endpoints check `is_staff`.
- No anonymous contributions possible.

### 4.2 CORS Configuration ✅

- Explicit origin list from `DJANGO_CORS_ALLOWED_ORIGINS` env var.
- Default is `['http://localhost:5173']` (Vite dev server only).
- No `CORS_ALLOW_ALL_ORIGINS = True` anywhere.

### 4.3 Rate Limiting ✅

- Comprehensive throttle configuration with 16 named scopes.
- All endpoints use `ScopedRateThrottle` with appropriate rates.
- Auth endpoints have aggressive limits (20/hour register, 20/minute login).
- AI endpoints limited to 30/minute.
- Password reset has per-email and per-IP rate limiting.

### 4.4 Raw SQL ✅

- Zero raw SQL usage found. All queries use Django ORM.

### 4.5 Secrets in Code ✅

- `.env` is in `.gitignore` and not tracked by git.
- `.env.example` contains only placeholder values.
- `settings.py` uses environment variables for all secrets.
- Production block exits if insecure secret key is detected.
- No API keys, passwords, or tokens hardcoded in Python source files.

### 4.6 AI Privacy Filtering ✅

- `sanitize_text_for_ai()` strips emails, phone numbers, and street addresses.
- System instructions explicitly prohibit inventing contact details.
- AI output requires user review (never auto-saved).
- AI is optional and gracefully disabled.

### 4.7 File Upload Security ✅

- Image validation with Pillow.
- Max size enforcement (5MB default for all upload types).
- Safe filename generation (UUID-based).
- Allowed types restricted.
- Original filenames never trusted.

### 4.8 Input Validation ✅

- Serializer validation on all endpoints.
- Coordinate validation on map/geo endpoints.
- Radius capping (max 30km for nearby help, max 100km for report search).
- Status transition validation.
- File type and size validation.

### 4.9 Error Handling ✅

- DRF default exception handler (no stack traces in responses).
- Field-based validation errors.
- No internal details leaked in error responses.

---

## 5. Noted Non-Security Issues

### 5.1 `.env` File Contains Real Credentials (Local Only)

The local `.env` file contains a Resend SMTP API key. This is NOT committed to git (`.gitignore` covers it), but developers should be aware:
- Rotate this key if the `.env` was ever accidentally shared.
- The `.env.example` correctly uses empty placeholder values.

### 5.2 SQLite in Use (Development Only)

SQLite is acceptable for local development and demos but should be replaced with PostgreSQL for any production deployment.

### 5.3 No Logging Configuration

Django's default logging is in use. No structured logging, no log rotation, no audit trail beyond Django's basic request logging.

---

## 6. Portfolio Strength Recommendations

### What's Already Strong

1. **Security posture** — production hardening block, rate limiting on all endpoints, AI privacy filtering, ownership enforcement, no raw SQL, CORS locked down.
2. **Architecture** — clean service layer, thin views, proper serializer separation (public/owner/admin).
3. **Test coverage** — comprehensive permission tests, edge cases, error states.
4. **API design** — consistent pagination, throttling, RESTful routes, OpenAPI docs.
5. **File upload handling** — Pillow validation, UUID filenames, size limits.

### What Would Make This Production-Ready

1. **PostgreSQL** — Replace SQLite for concurrent access, proper indexing, and production reliability.
2. **Redis caching** — Already used in-memory for nearby-help cache; Redis would persist across restarts.
3. **Celery for async** — Email sending, AI calls, and notification delivery should be async in production.
4. **Structured logging** — JSON logging with correlation IDs for observability.
5. **Healthcheck improvements** — Check database connectivity, cache availability, AI service status.
6. **HTTPS everywhere** — TLS termination (nginx/load balancer) in front of Django.
7. **Content Security Policy** — Add CSP headers for admin pages.
8. **Dependency scanning in CI** — Automated `safety` or `pip-audit` in the Jenkins pipeline.
9. **Backup strategy** — Database backup automation.
10. **Monitoring** — APM integration (Sentry, Datadog, or similar).

---

## 7. Summary

| Category | Rating | Notes |
|----------|--------|-------|
| Dependency vulnerabilities | ✅ Clean | 0 known CVEs |
| Authentication | ✅ Strong | JWT + TOTP + SSO, proper scoping |
| Authorization | ✅ Strong | Object ownership, staff checks |
| Input validation | ✅ Strong | Serializers + custom validators |
| Rate limiting | ✅ Strong | 16 scoped throttles |
| CORS | ✅ Correct | Explicit origin list |
| SQL injection | ✅ Safe | ORM only, no raw SQL |
| File upload | ✅ Safe | Pillow validation, UUID names |
| AI privacy | ✅ Good | PII stripping before AI calls |
| Secrets management | ✅ Good | Env vars, .gitignore, prod guard |
| Production readiness | ⚠️ MVP | SQLite, sync email, no Redis |
| Logging/monitoring | ⚠️ Basic | No structured logging or APM |

**Overall verdict:** The codebase demonstrates senior-level security awareness for a hackathon MVP. All critical security boundaries are properly enforced. The remaining gaps are infrastructure concerns (database, caching, async processing) rather than application security vulnerabilities.
