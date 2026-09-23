# Architecture

## Layers

- **Web:** Next.js App Router PWA; tablet-first UI; access token held in memory; refresh through secure HTTP-only cookie.
- **API:** Express routes/controllers, Zod boundary validation, JWT authentication, role authorization, structured errors and request-correlated logs.
- **Domain/services:** pass validation, India business date, duplicate rules, serial allocation, TT comparison, safety rules, edit locking and audit snapshots.
- **Data:** PostgreSQL/Prisma with compound uniqueness, two partial unique indexes for open movements, optimistic record versions and serializable transactions.
- **Shared contracts:** TypeScript/Zod types reused by web and API.

## Core create transaction

Creating an entry performs pass validation, document-expiry checks, helper-rule checks, open-truck/open-crew checks, daily-token check, daily-counter allocation, entry creation, safety-checklist creation and audit creation in one serializable transaction. The transaction retries bounded serialization conflicts. PostgreSQL remains the final authority for concurrent uniqueness.

## Authentication model

The browser keeps the short-lived access token only in memory. The refresh token is opaque and placed in a secure HTTP-only cookie. The database stores only its HMAC hash, session metadata, expiry, revocation state and `authVersion`. Protected requests revalidate the user role/active state/version, while rotation/reuse logic supports revocation and incident response.

## Deployment model

The production compose topology contains PostgreSQL, a one-shot migration container, a lean non-root API runtime and a non-root Next.js standalone runtime. API startup depends on successful migration and database readiness. Public exposure should be through approved HTTPS reverse-proxy/WAF infrastructure only.

## Extensibility

The seeded `CrewPass` table is an integration boundary. Replace it with an adapter that verifies the official signed QR/pass service while preserving the read-only response contract. `facilityCode` and `gateCode` are environment-configured for multi-site rollout. Destination masters, OUT Gate events, identity/MFA and centralized logging can be connected without redesigning the entry-domain model.
