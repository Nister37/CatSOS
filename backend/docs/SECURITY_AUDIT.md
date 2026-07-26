# Security and quality audit

Date: 2026-07-26
Scope: CatSOS backend, frontend dependencies, API boundary, and CI/runtime configuration.

## Validated controls

- Authentication and authorization: contributions require JWT authentication; report ownership and staff moderation rules are enforced by backend permissions and covered by API tests.
- Public privacy: public report and sighting serializers exclude private contact details, internal notes, and unnecessary user identifiers.
- Inputs and uploads: serializers validate coordinates, timestamps, state transitions, image content, MIME type, extension, size, and safe generated filenames.
- External services: AI input is privacy-filtered and optional; Overpass inputs are capped, cached, timed out, and fail safely.
- Browser and API headers: production responses include CSP, frame denial, content-type sniffing protection, a referrer policy, and request correlation IDs. The frontend nginx image adds CSP and Permissions Policy at the static-app boundary.
- Secrets and CORS: secrets come from environment variables; production rejects an insecure Django key; CORS uses an explicit origin list.
- Database: local development may use SQLite, while Docker CI and deployment configuration exercise PostgreSQL through environment variables.
- Observability: production logging is structured JSON and includes the request ID returned in `X-Request-ID`. Incoming request IDs are accepted only when they match the documented safe format.
- Query efficiency: public report listing prefetches the filtered sightings used by serializers; a query-count regression test protects this path.

## Automated evidence

- OSV scans run for Python and Yarn dependencies in Jenkins and Docker Compose.
- Backend tests run against PostgreSQL.
- OpenAPI generation runs with schema validation enabled.
- Cypress covers authentication, protected routes, report creation, sighting validation/submission, accessibility, and a real owner-to-helper notification workflow against Django.
- A lightweight concurrent load smoke checks the health and public-report endpoints.
- Django production settings and security headers have focused tests.

The dependency scan is clean under the documented frontend exceptions in
`frontend/osv-scanner.toml`. Those exceptions are restricted to a React Router
Server Components advisory that does not apply to this Vite SPA and
`brace-expansion` instances used only by test/build tooling.

## Residual risks

These are bounded production-readiness risks, not known exploitable defects in
the reviewed application code:

1. Email and AI calls are synchronous. A slow provider can occupy a request
   worker even though timeouts and graceful failure prevent data corruption.
2. The default cache is process-local. Multiple production replicas should use
   a shared cache such as Redis for consistent throttling and Overpass caching.
3. Central log collection, alerting/APM, and automated PostgreSQL backups are
   deployment responsibilities and are not included in this repository.
4. Credentialed SMTP, Gemma, Google, and Microsoft smoke tests are opt-in and
   require deployment secrets. CI validates their adapters with mocks and skips
   real-provider calls when credentials are absent.
5. The frontend production bundle is approximately 760 kB minified (about
   210 kB gzip). It is acceptable for the MVP but route-level code splitting is
   the next measurable performance improvement.

## Verdict

No known critical or high-severity application security issue remains after
this review. This is not a guarantee that future vulnerabilities cannot exist:
dependency scanning, PostgreSQL tests, API contract validation, and E2E tests
must remain required CI gates.
