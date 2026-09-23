# QA and Verification Report

**Date:** 6 August 2026  
**Release:** `IOCL_Lorry_Gate_Management_Production_Audited_Final`

For the complete requirements matrix and remediation details, read `DEEP_AUDIT_REPORT.md`.

## Verification completed

- Custom TypeScript/TSX source audit: **75 files**, **324 local imports**, **774 structures**, **0 errors**.
- JSON parsing: **12 files passed**.
- Audit role snapshots: **14/14 audit writes passed**.
- Crew-pass parser: **28 runtime cases passed**.
- Invoice parser: **6 runtime cases passed**.
- Standalone demo JavaScript syntax: passed.
- Standalone desktop browser lifecycle: passed.
- Android-size browser render and QR form: passed.
- Browser console errors: **0**; page errors: **0**.
- QR-derived editable controls: **0**; safety checks rendered: **12**.
- XLSX ZIP/XML integrity: passed.
- XLSX load/formula validation with `openpyxl`: passed.
- Docker Compose YAML parsing: passed for development and production files.
- Backup/restore shell syntax: passed.
- Mocked daily/weekly/monthly backup rollup and checksum verification: passed.
- PM2 configuration: passed for API and web applications.
- Release hygiene: no dependencies, framework build output, coverage output or secret `.env` file packaged.

## Important defect fixed by browser execution

The standalone client demo previously emitted `<F>` and `<SelectYN>` as unknown HTML tags instead of invoking its JavaScript form helpers. This made the vehicle and checklist screens non-functional even though the script was syntactically valid. The template was corrected and the full Entry → Exit → Admin browser workflow was rerun successfully.

## Runtime scope exercised

1. Entry user login.
2. Future-valid multiline QR scan.
3. Locked crew/pass details.
4. Separate actual physical TT number.
5. Twelve explicit manual safety answers.
6. Exception-remarks validation when one answer is No.
7. Review and IN submission.
8. Real expired client QR warning/block.
9. Exit login, invoice scan, vehicle match and quantities.
10. OUT completion.
11. Admin register visibility.
12. Mobile layout at 430 × 932.

## Release gates not executed here

The environment's internal npm mirror could not supply a declared public package, and Docker/PostgreSQL are unavailable. These mandatory staging/CI gates remain:

```bash
npm ci
npm run db:generate
npm run db:migrate
npm run typecheck
npm test
npm run build
npm run verify
npm audit --omit=dev

docker compose --env-file .env.production -f docker-compose.production.yml config
docker compose --env-file .env.production -f docker-compose.production.yml build
```

Also complete PostgreSQL concurrency tests, a migration test from the previous database, Android camera and hardware-scanner tests, an actual backup/restore drill, performance/load testing, vulnerability scanning, penetration testing and role-based terminal UAT.
