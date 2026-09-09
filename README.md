# IOCL Lorry Entry/Exit Gate Management System

Production-structured, mobile-first release candidate for digitising the Tank Truck Gate Register at Indian Oil Coimbatore Smart Terminal.

## What is implemented

- **Entry Gate:** multiline crew-pass QR scan, locked driver/pass snapshot, physical truck confirmation, customer/challan/pass/token/ABS/ABT fields, exact 12-point manual safety checklist, daily serial and time IN.
- **Exit Gate:** invoice QR scan, match to today’s open IN movement, MS/XPMS/EBMS/HSD quantity entry, duplicate-invoice prevention, time OUT and record locking.
- **Admin:** date-based register, pagination, IN/OUT filters, product totals, XLSX/CSV export, audited corrections, soft delete/restore, month bulk delete, user creation/disable/role/unlock/password reset and audit history.
- **Security:** bcrypt passwords, account lockout, short-lived JWT access tokens, rotating httpOnly refresh cookies, server-side role checks, strict Zod validation, CORS allow-list, Helmet, rate limiting, audit logs and optimistic locking.
- **Operations:** PostgreSQL/Prisma migrations, Docker/Vercel/Ubuntu/Nginx/PM2 assets, health/readiness probes, and daily/weekly/monthly backup plus restore tooling.

See [Deep Audit Report](docs/DEEP_AUDIT_REPORT.md), [QA Report](docs/QA_REPORT.md) and [Implementation Status](docs/IMPLEMENTATION_STATUS.md) for requirements coverage, fixes, verified results and remaining release gates.

## Repository layout

```text
apps/web                 Next.js/React tablet and desktop UI
apps/api                 Express REST API
packages/shared          Shared Zod contracts and TypeScript types
packages/database        Prisma schema, migrations and seed
client-demo/index.html   Zero-install, single-file working client preview
deploy/                  Nginx reference configuration
scripts/                 PostgreSQL backup/restore scripts
docs/                    Architecture, API, security, deployment and acceptance docs
```

## Requirements

- Node.js 22+
- npm 10+
- PostgreSQL 15+ (17 is used by Docker Compose)
- HTTPS for camera access outside localhost

## Local setup

```bash
cp .env.example .env
# Update DATABASE_URL and secrets
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. API readiness is at `http://localhost:4000/ready`.

### Seed users

All seed users use `Gate@123` for local/demo setup only:

| Employee code | Role |
|---|---|
| `SEC1001` | Entry Gate Security |
| `EXT1001` | Exit Gate Security |
| `SUP1001` | Supervisor |
| `ADM1001` | Admin |

Disable these users or reset every password before go-live.

## QR samples

### Client-supplied expired crew pass

```text
Crew Id : IOC11965186D0010
Name : RAGUPRABAHAR C
Crew Type : Driver
pass valid Upto : 03/08/2025
TT No : TN74AZ8730
DL No : Tn7420210005690
DL Expiry Date : 02/07/2026
```

The fields are displayed but production IN submission is blocked because the dates have expired.

### Future-valid crew pass

```text
Crew Id : IOC11965186D0020
Name : ARUN KUMAR S
Crew Type : Driver
pass valid Upto : 31/12/2028
TT No : TN59CL2839
DL No : TN5920200019283
DL Expiry Date : 30/06/2029
```

### Invoice QR

```text
Inv:0793356259 Dt:06.06.26 Val:1143122.00 Veh:TN59CL2839 Prd/Qty:BULK-MS/8;BULK-HSD/4 Con:203031(VASUGI AGENCIES)
```

## Verification commands

```bash
npm run typecheck
npm test
npm run build
```

Database deployment uses forward-only migrations:

```bash
npm run db:generate
npm run db:migrate
```

## Client preview

Open `client-demo/index.html` directly in Chrome or Edge. It has Entry, Exit and Admin workflows, preserves the real expired client QR dates, provides a future-valid QR for successful submission and stores preview records only in browser local storage.

## Production deployment

Read [Production Deployment](docs/DEPLOYMENT_PRODUCTION.md) and [Backup & Recovery](docs/BACKUP_RECOVERY.md). The client’s official QR authenticity contract, final safety wording, retention policy and terminal user-acceptance test are external go-live dependencies.

## Important data rules

- QR-derived Crew ID, driver, crew type, pass dates, DL details and TT number on pass are immutable.
- Actual physical tank truck number is separate and editable while status is `IN`.
- TT match is calculated by the server; mismatch remarks are mandatory.
- Every one of the 12 safety checks requires an explicit Yes or No. Any No requires exception remarks.
- One open movement is permitted per physical truck and per crew pass.
- Mobile token is unique per business date; invoice number is globally unique.
- QR identity remains locked. Security editing is lifecycle-restricted; Admin operational corrections and authorized OUT quantity corrections are audited.
- Deletes are soft deletes only.
