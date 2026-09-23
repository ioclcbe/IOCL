# Research and Hardening Notes

Reviewed: 5 August 2026

The upgraded design was checked against current official platform and security guidance rather than treating the presentation demo as a production backend.

## Key decisions

- **Supported framework line:** Next.js is pinned to a patched 15.5 maintenance release rather than an untested major upgrade. Major dependency upgrades should pass connected CI, integration tests and device UAT before release.
- **Database concurrency:** daily serial allocation and record creation use PostgreSQL serializable transactions with bounded retry, while partial/compound unique indexes remain the final concurrency guard.
- **Session design:** short-lived access tokens, opaque rotating refresh tokens, secure HTTP-only cookies, trusted-origin checks, server-side user/version validation, reuse detection and session invalidation are used together; JWT signature validation alone is not treated as sufficient authorization.
- **Browser storage:** production access tokens are not stored in local storage. The service worker caches static assets only.
- **Operational logging:** audit records preserve business changes, while security events and request IDs support incident investigation without relying on client messages.
- **Supply chain:** exact top-level versions are declared. A committed lockfile, clean `npm ci`, SCA and image scanning remain mandatory release gates.
- **Deployment separation:** migration tooling is isolated in a one-shot image; the API runtime is leaner and runs as a non-root user.

## Remaining organization-specific inputs

Official QR signing/verification, gate SOP, safety wording, destination master, OUT integration, identity/MFA, retention periods, infrastructure topology and brand approval cannot be inferred safely. They are explicit go-live dependencies rather than hidden assumptions.
