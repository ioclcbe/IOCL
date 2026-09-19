# Production Deployment — IOCL Coimbatore Lorry Gate

## Recommended topology

- Ubuntu LTS or a managed container platform.
- Nginx/load balancer terminating HTTPS and HSTS.
- Next.js web process on port 3000.
- Express API on port 4000, private except through the reverse proxy.
- Managed PostgreSQL with TLS and connection pooling where available.
- Daily systemd backup timer plus encrypted off-site replication.

## Critical environment settings

- `NODE_ENV=production`
- `DATABASE_URL` with TLS where supported.
- Unique 32+ character `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.
- `JWT_ACCESS_TTL=10m` and `SESSION_MAX_TTL=8h` or the approved shift policy.
- Exact production `WEB_ORIGINS` only.
- `COOKIE_SECURE=true`.
- `COOKIE_SAME_SITE=strict` for same-site hosts. Use `none` only for a genuine cross-site web/API deployment; Secure is mandatory.
- Correct `COOKIE_DOMAIN`, or blank for host-only cookies.
- `NEXT_PUBLIC_DEMO_MODE=false`.
- Real `FACILITY_CODE` and `GATE_CODE`.

## Docker deployment

```bash
docker compose --env-file .env.production -f docker-compose.production.yml config
docker compose --env-file .env.production -f docker-compose.production.yml build --pull
docker compose --env-file .env.production -f docker-compose.production.yml up -d migrate
docker compose --env-file .env.production -f docker-compose.production.yml up -d api web
docker compose --env-file .env.production -f docker-compose.production.yml ps
curl -fsS https://api.example.com/ready
```

The dedicated `migrate` service applies forward migrations before API startup. Next standalone output is enabled only inside the Docker build; Vercel keeps it disabled.

## Native Node + PM2

```bash
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed       # first deployment only; review/disable demo users immediately
npm run verify
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Install and customize `deploy/nginx-iocl.conf`, validate with `nginx -t`, and reload Nginx.

## Backup timer

Install `deploy/iocl-gate-backup.service`, `deploy/iocl-gate-backup.timer` and a protected `/etc/iocl-gate/backup.env` as described in `BACKUP_RECOVERY.md`. Configure off-site replication and alerting; local files alone do not meet the specification.

## Vercel option

Use `apps/web` as the Web project's Root Directory. The API includes `apps/api/api/index.ts` and `apps/api/vercel.json` for a separate API project. When Web and API use unrelated sites, set `COOKIE_SAME_SITE=none`, `COOKIE_SECURE=true`, an exact `WEB_ORIGINS` value and a compatible cookie domain. A long-running container/API remains preferable for predictable gate operations and backup control.

## Mandatory go-live checks

- Clean `npm ci`, typecheck, tests and production build pass.
- Prisma migrations pass on an empty database and a copy of the prior deployed schema.
- Docker images build and health checks pass.
- Demo users/passwords are removed or changed.
- Direct URL role tests pass for Entry, Exit and Admin.
- Actual Android camera and hardware scanner work over HTTPS.
- Duplicate truck, crew, token and invoice protections are tested concurrently.
- Excel is signed off against the physical register.
- Daily/weekly/monthly backups run, replicate off-site and restore successfully.
- Load/performance, vulnerability and penetration tests pass.
- Client accepts every unresolved field meaning and workflow decision.
