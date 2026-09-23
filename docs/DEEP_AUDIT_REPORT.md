# Deep Requirements Audit and Remediation Report

**System:** IOCL Lorry Entry/Exit Gate Management  
**Specification reviewed:** `docs/CLIENT_BUILD_SPECIFICATION.md` / supplied Lorry Entry/Exit Gate Management build specification  
**Audit date:** 6 August 2026  
**Audited release:** `IOCL_Lorry_Gate_Management_Production_Audited_Final`

## 1. Conclusion

The source tree now covers the specification's **MVP** workflow and operational controls for Entry Security, Exit Security and Administration. Phase 2 and hardware-dependent Future scope remain deliberately deferred, as directed by the specification's phased delivery model.

This package is a **production-structured release candidate**, not an assertion that an untested server is ready to open a live terminal. A clean dependency install, framework build, Prisma migration on PostgreSQL, Docker build, connected API/browser run, Android camera test, load test, security assessment and client UAT are still mandatory release gates on infrastructure with network, Docker and PostgreSQL access.

## 2. MVP compliance matrix

| Specification area | Result | Implemented evidence |
|---|---|---|
| Shared role-aware login | Complete | Employee Code/password login; role resolved by API; Entry, Exit, Supervisor and Admin authorization; role-based redirect |
| Password and session controls | Complete | bcrypt cost 12; minimum-complexity passwords; five-attempt default lockout; admin reset/unlock; short access token; rotating refresh cookie; fixed eight-hour maximum session; 30-minute browser inactivity logout |
| Entry dashboard | Complete | Current-day role-filtered summary and today's open IN records |
| Crew-pass QR | Complete | Camera, hardware-scanner and multiline manual fallback; strict label/date validation; legacy token fallback; structured warnings |
| Immutable QR fields | Complete | Crew/pass identity is never accepted in create/update input; server snapshots the master values; UI renders locked cards |
| Physical TT confirmation | Complete | Separate editable actual truck number; normalized server-side match calculation; mismatch remarks required |
| IN operational fields | Complete | Customer/destination, ABS, challan, driver/helper pass, ABT, mobile token, signature confirmation and remarks |
| Twelve-point safety checklist | Complete | Exactly 12 explicit Yes/No checks, including two separate Register Column items; no defaults; exception remarks required for any No |
| IN numbering and lifecycle | Complete | India business date, transaction-safe per-day serial, Time IN, status IN and actor snapshot |
| Duplicate protection | Complete | Database/application protection for active truck, active crew pass, same-day active mobile token and invoice number |
| Entry edit rules | Complete | Entry Security can update only own, current-day, open IN rows; optimistic version checks; Admin can make audited operational corrections while immutable source fields remain locked |
| Exit QR workflow | Complete | Strict invoice parser; open-IN lookup by physical vehicle; read-only entry/invoice review; MS/XPMS/EBMS/HSD entry; duplicate invoice prevention |
| OUT lifecycle | Complete | Time OUT, status OUT, exit actor, quantity correction rules and audit log; security ownership/current-day restrictions |
| Expiry handling | Complete | Expired crew data remains visible; production IN is blocked; OUT shows warning and requires explicit acknowledgement |
| Security navigation | Complete | Entry/Exit users see current day only, with own-edit restrictions and read-only counterpart records |
| Admin register | Complete | Date/status/search/match/creator filters, pagination, IN/OUT data, deleted-record view and restore |
| Admin record controls | Complete | Audited edit, soft delete, restore and month bulk delete with confirmation/reason |
| User management | Complete | Create, rename, employee-code change, role change, disable/enable, unlock and password reset; last-active-admin protection |
| Audit trail | Complete | Actor ID and role snapshot, action, entity, before/after snapshots, changed fields, IP, user-agent, request ID and timestamp |
| Excel register | Complete | On-demand `.xlsx`, physical-register column order, 12 checklist values, quantities, IN/OUT data, product totals and safe handling of legacy checklist rows |
| Quantity summary | Complete | MS/XPMS/EBMS/HSD plus config-driven Petrol (MS+XPMS+EBMS) and Diesel (HSD) totals |
| Error and loading UX | Complete | Branded 404/global/route error pages, unauthorized page, session-expired handling, offline banner, scan/submit feedback and inline errors |
| Security hardening | Complete in source | strict Zod objects, ORM, Helmet, CORS allow-list, trusted-origin checks, rate limiting, body limits, no-store, JWT verification, secure cookie configuration and redacted request logging |
| Backup and restore | Complete in source | checked `pg_dump`, SHA-256, restore validation, daily systemd timer, daily/weekly/monthly retention directories and documented restore drill |
| Deployment assets | Complete in source | Docker Compose, non-root containers, migration service, health/readiness probes, Nginx, PM2, Vercel web/API entry points and environment examples |

## 3. Defects found and fixed during this audit

### Critical

1. **Standalone client demo forms were not real inputs.** The shipped HTML contained literal pseudo-elements such as `<F .../>` and `<SelectYN .../>` inside a JavaScript template. Browsers created unknown HTML tags, so the vehicle form and safety checklist could not function. They were replaced with actual JavaScript helper calls. A complete desktop and mobile browser workflow now passes.

### High

2. **Refresh rotation could extend a session forever.** A fixed `sessionExpiresAt` is now stored and enforced; token rotation cannot exceed the default eight-hour shift session.
3. **Audit role could change historically.** Audit rows now preserve the actor's role at action time rather than depending only on the user's current role.
4. **Direct-ID Exit operations could bypass current-day restrictions.** Exit submission and Exit Security quantity correction now enforce current-business-day rules on the server.
5. **Last active administrator was race-prone.** User update and last-admin validation now run in a serializable transaction.
6. **Soft-deleted mobile tokens remained reserved.** PostgreSQL now uses an active-record partial unique index so an erroneous soft-deleted row does not block a legitimate replacement.
7. **Soft delete was not operationally recoverable.** An audited Admin restore endpoint and interface were added with uniqueness checks enforced by the database.
8. **Legacy raw QR could roll trusted expiry dates backward.** A stale QR is rejected when the stored crew master has newer pass/licence validity.

### Medium

9. Audit write sites now consistently include role snapshots.
10. Raw QR parsing rejects every duplicated required label, invalid/impossible dates, unsupported crew types, control characters, oversized input and invalid identifiers.
11. Invoice parsing now rejects unsupported years and values outside database precision.
12. Admin records now paginate instead of silently showing only the first page.
13. The Entry dashboard recent list now represents today's open IN records.
14. Admin can correct an OUT/CANCELLED record's operational/checklist data through an audit trail while QR identity remains immutable.
15. Cross-origin refresh-cookie deployment is explicitly configurable with `COOKIE_SAME_SITE`; insecure `SameSite=None` is rejected at startup.
16. Product family totals are driven by shared configuration rather than duplicated business logic.
17. The Excel totals row was corrected: MS/XPMS/EBMS/HSD formulas now occupy their actual columns, with Petrol and Diesel subtotals clearly placed in the same final row. The worksheet filter no longer includes the totals row.
18. Daily backup automation now creates weekly and monthly retention rollups with portable checksum files, in addition to daily dumps.
19. Demo mode now protects against duplicate open crew passes as well as truck/token/invoice conflicts.
20. Shared login wording, metadata, expired-document feedback and production/demo labeling were corrected.

## 4. Verification executed in this environment

### Static source verification

- **75** TypeScript/TSX files parsed with TypeScript 5.8.3 syntax services.
- **324** local imports resolved to existing source targets.
- **774** object/type structures traversed by the custom audit.
- **12** JSON files parsed.
- Static audit errors: **0**.
- Every detected audit-log write includes `actorRole`: **14 of 14**.
- No literal standalone-demo pseudo-components remain.
- Shell syntax passed for backup and restore scripts.
- Mocked backup execution verified daily output, Sunday weekly rollup, first-day monthly rollup and portable checksum validation: **passed**.
- Both Docker Compose YAML files parsed.
- PM2 configuration loaded both `iocl-gate-api` and `iocl-gate-web`.
- No packaged `node_modules`, `.next`, `dist`, `coverage` or `.env` secrets.

### Parser and workbook runtime checks

- Crew QR parser cases: **28 passed**.
- Invoice QR parser cases: **6 passed**.
- Covered the exact client QR, LF/CRLF, aliases, whitespace/case variation, missing/duplicate labels, impossible dates, unsupported crew type, identifier validation, controls, size limits, invoice precision and invoice-year limits.
- Generated XLSX opened with `openpyxl`, contained valid formulas and passed ZIP/XML integrity checks.

### Browser workflow

Exact shipped standalone HTML/JavaScript was run in headless Chromium with:

- Desktop viewport: **1440 × 1000**.
- Mobile viewport: **430 × 932**.
- Entry login → future-valid QR → locked seven-field snapshot → vehicle form → 12 unselected checks → No/remarks validation → review → IN submit.
- Expired client QR remains visible with a blocking warning.
- Exit login → invoice match → quantity entry → OUT completion.
- Admin login → completed register record visible.
- Locked QR inputs: **0 editable controls**.
- Safety items: **12**.
- Browser console errors: **0**.
- Page errors: **0**.

## 5. Release gates not executable in this container

A clean `npm ci` was attempted, but the environment's configured internal package mirror returned a 404 for a declared public package. Docker and PostgreSQL executables are also unavailable. Consequently, these gates are documented but **not claimed as passed** here:

```bash
npm ci
npm run db:generate
npm run db:migrate
npm run typecheck
npm test
npm run build
npm run verify
npm audit --omit=dev

docker compose -f docker-compose.production.yml config
docker compose -f docker-compose.production.yml build
```

Run them in connected CI and again on a staging copy of the production topology. Test migrations both from an empty database and from the prior deployed schema.

## 6. Intentionally deferred Phase 2 / Future work

The following are not represented as MVP defects because the specification explicitly defers them:

- Central notification inbox and resolution workflow.
- Persistent QR scan history and raw-data retention policy.
- IndexedDB offline write queue and conflict resolution.
- Driver/truck/invoice photo uploads and object storage.
- Thermal pass/slip/label printing.
- RFID, boom barrier, ANPR, CCTV, GPS, weighbridge and SAP integrations.
- Self-service password recovery through email/SMS.
- Advanced analytics, charts, PDF reporting and detailed vehicle/driver history views.

## 7. Client decisions still required before terminal go-live

- Exact names of both repeated **Verify Register Column** checks and any blurred register headers.
- Meaning, allowed values and terminology for **ABS/ABT**.
- Whether TT mismatch is a warning/flag or a hard entry block.
- Whether expired documents at OUT are warning-only or a hard block.
- Driver signature method: confirmation checkbox or signature-pad image.
- Official signed QR format or approved IOCL verification service; local text parsing is not proof of authenticity.
- Approved retention periods and off-site backup destination.
- Whether multiple physical gates require a gate master and user-to-gate assignments.

## 8. Go-live decision

Do not open a live gate from this ZIP alone. Approve production only after every item in `docs/PRODUCTION_ACCEPTANCE.md` is signed off, including clean builds, database migrations, restore drill, real Android camera/hardware scanner UAT, concurrency checks, performance testing, vulnerability scanning and client acceptance of the Excel/register layout.
