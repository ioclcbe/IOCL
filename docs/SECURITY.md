# Security Design

## Implemented controls

- bcrypt password hashing with cost 12 and timing-resistant unknown-user comparison.
- Configurable account lockout, with a default of five failed attempts.
- Short-lived HS256 JWT access tokens with issuer, audience, subject, JWT ID, session ID and authentication version validation.
- Opaque 384-bit refresh tokens in HTTP-only cookies; HMAC-SHA-256 hashes at rest; rotate-on-use; reuse detection and user-wide session revocation.
- Fixed maximum session lifetime (`SESSION_MAX_TTL`, default eight hours) that refresh rotation cannot extend.
- Password, role and active-state changes invalidate existing access/refresh sessions through `authVersion`.
- Active-user and current-role lookup on every protected API request.
- 30-minute browser inactivity logout for shared gate devices.
- Strict shared Zod request contracts; unknown/protected QR fields are rejected rather than ignored.
- QR-derived fields are sourced from the database on create and remain immutable; TT matching is recomputed by the server.
- Raw QR and refresh/password values are excluded from general request logging; request logs contain method, route, status, duration, request ID and IP only.
- Stale raw QR protection prevents an older physical QR from reducing newer crew-master validity dates.
- Helmet, API/web Content Security Policy, no-store API responses, body-size limits and disabled `x-powered-by`.
- Exact CORS allow-list and trusted-origin checks on cookie-authenticated login/refresh/logout operations.
- `COOKIE_SAME_SITE` supports strict/lax/none; startup refuses `none` unless Secure cookies are enabled.
- Global and authentication-specific rate limits.
- Prisma/parameterized database access, serializable critical transactions, optimistic record versions and PostgreSQL uniqueness constraints.
- CSV formula-injection protection and React output escaping.
- Production rejection of demo QR scan mode.
- Service worker caches static assets only, never API responses or authenticated pages.
- Audit records preserve both actor identity and role-at-action snapshot, before/after state, changed fields, IP, device information and request ID.
- Soft deletes are recoverable only by Admin and every delete/restore is audited.

## Session topology notes

For web and API hosts on the same site, prefer `COOKIE_SAME_SITE=strict`. When the web and API are genuinely cross-site, use `COOKIE_SAME_SITE=none` only with HTTPS, `COOKIE_SECURE=true`, the exact `WEB_ORIGINS` allow-list and the correct cookie domain/path. Access tokens remain in memory in the connected web application; only the refresh token uses the protected cookie.

## Audit and log handling

Forward API logs, security events and database audit records to a centralized append-only or tamper-evident destination. Restrict audit access to approved Supervisor/Admin users and operations personnel. Define masking and retention rules for driving-licence and crew personal data before go-live.

## Required production controls outside this repository

- Approved IOCL identity/MFA and device-management policy.
- Managed secrets service and secret rotation.
- TLS termination, WAF/reverse-proxy controls and restricted network paths.
- Encrypted PostgreSQL and encrypted off-site backups with a tested restore.
- Centralized tamper-resistant logs and monitoring/alerting.
- Dependency/SBOM scanning, vulnerability scanning and penetration testing.
- Managed Android kiosk controls and OS patching.
- Official signed QR format or IOCL verification service; plain-text parsing alone is not authenticity verification.

Never commit production secrets or deploy the standalone browser demo as the operational data store.
