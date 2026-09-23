# REST API Summary

Base path: `/api/v1`. Protected routes require `Authorization: Bearer <access-token>`. The rotating refresh token is stored in an HTTP-only cookie restricted to the authentication route path. Shared strict Zod schemas validate request bodies, path parameters and query strings.

## Authentication

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/auth/login` | Public/trusted origin | Resolve role by Employee Code and create the bounded session |
| POST | `/auth/refresh` | Refresh cookie/trusted origin | Rotate the refresh token within the original maximum session |
| POST | `/auth/logout` | Refresh cookie/trusted origin | Revoke the current refresh session |
| GET | `/auth/me` | Authenticated | Return the verified identity |

## Entry and Exit operations

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/crew-passes/resolve` | Entry, Supervisor, Admin | Parse multiline crew QR or resolve a token; return locked values and warnings |
| GET | `/masters/destinations` | Entry, Supervisor, Admin | List active destinations |
| GET | `/dashboard/summary` | Operational roles | Current-day role-filtered counts, quantities and recent movements |
| GET | `/gate-entries` | Operational roles | Search/filter/paginate records; security roles are current-day/ownership restricted |
| GET | `/gate-entries/:id` | Operational roles | Read one authorized record |
| POST | `/gate-entries` | Entry, Supervisor, Admin | Create a transactional IN movement |
| PATCH | `/gate-entries/:id` | Entry, Supervisor, Admin | Correct allowed operational/checklist data using `expectedVersion`; QR fields remain immutable |
| POST | `/gate-entries/exit/resolve` | Exit, Supervisor, Admin | Parse invoice QR and resolve today's matching open IN movement |
| POST | `/gate-entries/:id/exit` | Exit, Supervisor, Admin | Complete OUT, store invoice/quantities and audit the transition |
| PATCH | `/gate-entries/:id/exit-quantities` | Exit owner, Supervisor, Admin | Correct OUT quantities with current-day/ownership rules for Exit Security |
| DELETE | `/gate-entries/:id` | Admin | Soft-delete one record with a reason |
| POST | `/gate-entries/:id/restore` | Admin | Restore a soft-deleted record, subject to active uniqueness constraints |
| POST | `/gate-entries/bulk-delete` | Admin | Soft-delete active records in a selected month with typed confirmation/reason |
| GET | `/gate-entries/export.csv` | Supervisor, Admin | Export up to 10,000 filtered records with spreadsheet-formula protection |

### Crew-pass resolution errors of note

- `QR_MISSING_FIELD`, `QR_DUPLICATE_FIELD`, `QR_INVALID_DATE`, `QR_INVALID_CREW_TYPE` — malformed multiline QR.
- `STALE_CREW_PASS_QR` — the stored crew master contains newer validity dates than the scanned legacy QR.
- `PASS_EXPIRED`, `DL_EXPIRED` — scan data can be displayed, but production IN creation is rejected.

## Reports, users and audit

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/reports/summary?date=YYYY-MM-DD` | Supervisor, Admin | IN/OUT counts and config-driven product-family totals |
| GET | `/reports/excel?date=YYYY-MM-DD` | Supervisor, Admin | Generate the live `gate-log-YYYY-MM-DD.xlsx` register |
| GET | `/users` | Admin | Search/filter/paginate users |
| POST | `/users` | Admin | Create a user |
| PATCH | `/users/:id` | Admin | Change name/code/role/active state or unlock an account |
| POST | `/users/:id/reset-password` | Admin | Reset password and invalidate active sessions |
| GET | `/audit-logs` | Supervisor, Admin | Filter immutable audit records |

Public probes: `GET /health` and `GET /ready`.

## Response contract

Success:

```json
{ "success": true, "data": {}, "message": "optional", "meta": { "requestId": "optional" } }
```

Failure:

```json
{
  "success": false,
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Human-readable message",
    "fieldErrors": {},
    "requestId": "correlation-id"
  }
}
```

General request logs do not include the QR body, password or refresh token.
