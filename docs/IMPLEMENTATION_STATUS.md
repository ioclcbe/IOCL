# Implementation Status

## Completed MVP

- Shared login with server-side role resolution for Entry, Exit, Supervisor and Admin.
- bcrypt passwords, configurable five-attempt account lock, admin reset/unlock, rotating refresh cookie, fixed eight-hour maximum session and 30-minute inactivity logout.
- Entry dashboard and current-day role visibility.
- Strict plain-text multiline crew-pass QR parser, legacy token fallback and stale-QR protection.
- Immutable crew/pass snapshots and separately editable physical truck number.
- Exact 12-point manual checklist with two separate Register Column checks, explicit Yes/No state and exception validation.
- Customer/destination, ABS, challan, pass, ABT, helper, mobile-token, signature-confirmation and remarks fields.
- Duplicate active truck, active crew pass, same-day active mobile token and invoice protections.
- Transaction-safe day serial allocation and optimistic record locking.
- Exit invoice QR parser, open-IN resolution, MS/XPMS/EBMS/HSD quantities, expiry acknowledgement and OUT lifecycle.
- Admin date register, filters, pagination, product totals, operational corrections, soft delete, restore and month bulk delete.
- User creation, rename/code/role/active changes, unlock and password reset with last-active-admin protection.
- Role-snapshotted create/update/exit/delete/restore/user/auth audit history.
- On-demand Excel register and CSV export; corrected MS/XPMS/EBMS/HSD/Petrol/Diesel totals.
- Branded mobile/tablet/desktop UI, custom errors, offline banner and camera/manual scanner fallback.
- Docker, Vercel, Ubuntu/Nginx/PM2 assets; health/readiness endpoints.
- Daily PostgreSQL backup timer with daily/weekly/monthly retention, checksums and restore runbook.
- A corrected zero-install client demo with verified Entry, Exit and Admin workflows.

## Intentionally deferred

These are Phase 2/Future items under the supplied specification: centralized notifications, persistent QR scan history, offline write queue/conflict resolution, file/photo uploads, thermal printing, advanced charts/reports/history, RFID, ANPR, CCTV, GPS, boom barrier, weighbridge, SAP and email/SMS self-service password recovery.

## Client confirmations required

- Final wording for duplicate Register Column checks and blurred register fields.
- ABS/ABT meaning and allowed values.
- TT mismatch warning versus hard block.
- OUT expiry warning versus hard block.
- Driver signature checkbox versus signature-pad image.
- Official signed QR/authenticity contract or verification API.
- Retention duration and off-site backup target.
- Multi-gate/gate-master requirement.

## Release status

**Production-structured release candidate.** Source-level and standalone-browser verification passed. Connected install/build/migration/Docker/staging/security/UAT gates remain mandatory and are listed in `QA_REPORT.md` and `PRODUCTION_ACCEPTANCE.md`.
