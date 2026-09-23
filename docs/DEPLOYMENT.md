# Production Deployment Runbook

## Release preparation

1. Use a connected, trusted CI runner with Node.js 22 and npm 10.
2. Review the committed `package-lock.json` and update it only through an approved dependency-change process.
3. Use `npm ci` for reproducible installation; do not use a floating production install.
4. Run `npm run verify`, software-composition analysis and container scanning.
5. Build immutable versioned images and retain their digests/SBOMs.

The release includes a committed lockfile. Docker dependency stages use `npm ci --ignore-scripts`; Prisma generation and workspace builds run only after the required source/schema files are present.

## Infrastructure deployment

1. Obtain approved HTTPS hostnames for web and API.
2. Create PostgreSQL with encryption in transit, automated backups and restricted network access.
3. Copy `.env.production.example`, generate unique secrets, URL-encode database credentials, and configure exact allowed origins/cookie domain.
4. Build and deploy with `docker-compose.production.yml` or equivalent approved Kubernetes manifests.
5. The one-shot `migrate` image must complete successfully before API rollout.
6. Verify `/health` and `/ready`; expose only the reverse proxy publicly.
7. Provision users using `npm run db:provision-user`; never run the demo seed in production.
8. Configure centralized JSON logs, alerts, time synchronization and retention.
9. Connect the official QR/pass source and replace seeded destinations/checklist wording.
10. Complete every acceptance check in `PRODUCTION_ACCEPTANCE.md` before opening the operational gate workflow.

## Environment notes

- `DATABASE_URL` is explicit and required; do not construct it from an unescaped password.
- `PUBLIC_API_URL` must be the browser-reachable HTTPS API URL ending in `/api/v1`.
- `WEB_ORIGINS` must contain exact HTTPS origins, comma-separated only when multiple approved frontends exist.
- Keep `NEXT_PUBLIC_DEMO_MODE=false` in operational builds.
- Use different, randomly generated access and refresh secrets of at least 32 characters.
- Configure the real reverse-proxy hop count; a wrong value can make IP-based controls unreliable.

## Database migration and rollback

- Back up PostgreSQL and validate restore before migration.
- Run `prisma migrate deploy` through the dedicated migrator image.
- Keep the previous immutable web/API image tags.
- Application rollback is safe only when the previous image supports the deployed schema.
- Never reverse a migration destructively without an approved data-recovery plan.

## Health and monitoring

- Liveness: `GET /health`
- Readiness/database: `GET /ready`
- Alert on repeated 5xx, readiness failures, account lockouts, refresh-token-reuse events, duplicate conflicts, migration failures and abnormal entry volume.
- Monitor database connection saturation, transaction conflicts, response latency and storage growth.

## Post-deployment smoke test

1. Sign in with a non-demo Entry Gate Security account.
2. Resolve an approved test QR pass.
3. Create an IN record and confirm the daily serial/time/status.
4. Attempt duplicate truck, crew pass and mobile token submissions; each must be blocked.
5. Edit the open record from one device and verify stale-version conflict from another.
6. Mark it OUT through the approved OUT workflow and confirm further edits are rejected.
7. Verify audit/security events, CSV authorization and log correlation by request ID.
