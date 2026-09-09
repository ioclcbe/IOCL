# Lorry Entry/Exit Gate Management System — Build Specification

**Client:** Indian Oil (Coimbatore Smart Terminal) — Tank Truck Gate Register digitization
**Deployment:** Client's own domain, cloud-hosted
**Tech stack:** Next.js (React) frontend + Node.js backend (Next.js API routes or a separate
Express service) + PostgreSQL database + JWT-based auth

---

## 0. Build Phasing (read this first)

This spec is large by design — an enterprise system for an Indian Oil terminal needs audit
trails, backups, and security hardening, not just the happy-path screens. To keep the build
realistic, everything below is tagged:

- **[MVP]** — needed to replace the physical register and go live safely. Build this first.
- **[Phase 2]** — real value, but the gate can operate without it on day one. Build once MVP is
  stable in production.
- **[Future]** — hardware/integration items that depend on equipment the client may add later
  (RFID, ANPR, weighbridge, etc.). Design the schema so these slot in later without a rewrite,
  but do not build them now.

Trying to build all three tiers at once is how these projects stall — build MVP, get it running
at the actual gate, then layer on Phase 2.

---

## 1. Overview

Digitizes the physical "Tank Truck Gate Register" book into a web app with three roles:
**Entry/IN Gate Security**, **Exit/OUT Gate Security**, and **Admin**. All data is stored
day-wise in PostgreSQL and can be exported to Excel in the exact column layout of the physical
register. Visual identity matches Indian Oil branding (see Section 10).

---

## 2. Roles & Login **[MVP]**

Single login page, shared by all roles (role resolved server-side from Employee Code).

**Visual reference:** IOCL Phonebook app screenshot — Indian Oil orange background, centered
white circular logo badge, "Employee Code" field with person icon, "Password" field with lock
icon + show/hide toggle, "I am an ex-employee" checkbox (repurpose or omit — confirm with
client), pill-shaped orange "Login" button.

**Fields:** Employee Code, Password.
**Backend:** bcrypt-hashed passwords, JWT session cookie, `users.role` enum(`entry`,`exit`,`admin`).

On successful login, redirect by role → Entry Dashboard / Exit Dashboard / Admin Dashboard.

**Password policy [MVP]:** minimum 8 characters, account lock after 5 failed attempts, admin-
triggered password reset. Self-service "forgot password" via email/SMS is **[Phase 2]** (needs
a messaging provider — decide which one during dev).

**Session management [MVP]:** JWT expiry (e.g. 8-hour shift-length token), auto-logout after a
period of inactivity (e.g. 30 min) — important on shared gate devices. "Force logout from all
devices" is **[Phase 2]**.

---

## 3. Database Schema (PostgreSQL)

### `users` **[MVP]**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| employee_code | text unique | |
| password_hash | text | bcrypt |
| name | text | |
| role | enum(entry, exit, admin) | |
| is_active | boolean | for disable-user, Section 12 |
| failed_login_count | int | for account lock |
| created_at | timestamptz | |

### `gate_entries` (one row per lorry visit — created at IN, updated at OUT) **[MVP]**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| entry_date | date | day bucket — all day-wise logic keys off this |
| sl_no | int | auto-increment per day, resets each new date |
| name_destination_customer | text | manual entry by security |
| tank_truck_no | text | actual physical truck number, confirmed by security |
| abs | text | confirm exact meaning with client (Section 11) |
| challan_no | text | |
| time_in | timestamptz | auto-set on IN submit |
| time_out | timestamptz | auto-set on OUT submit, null until then |
| qty_ms | numeric | liters, editable only at exit |
| qty_xpms | numeric | liters, editable only at exit |
| qty_ebms | numeric | liters, editable only at exit |
| qty_hsd | numeric | liters, editable only at exit |
| safety_checks | jsonb | booleans, Section 7 |
| crew_id | text | from entry QR |
| crew_name | text | from entry QR |
| crew_type | text | from entry QR |
| pass_valid_upto | date | from entry QR |
| dl_no | text | from entry QR |
| dl_expiry_date | date | from entry QR |
| tt_no_on_pass | text | TT No as printed on the QR pass |
| tt_no_match | boolean | security's yes/no check |
| driver_pass_no | text | |
| helper_name | text | |
| helper_pass_no | text | |
| mobile_token_no | text | |
| driver_signature | text | confirm: checkbox vs signature-pad image (Section 11) |
| remarks | text | |
| status | enum(IN, OUT) | |
| invoice_no | text | from exit QR |
| invoice_date | date | from exit QR |
| invoice_value | numeric | stored for reference only, not used in totals |
| invoice_vehicle | text | matched against tank_truck_no |
| invoice_consignee | text | |
| invoice_products_raw | text | raw "Prd/Qty" string, kept for audit |
| created_by | uuid FK → users.id | entry security |
| updated_by | uuid FK → users.id | last editor |
| exit_created_by | uuid FK → users.id | exit security |
| is_deleted | boolean default false | **soft delete** — see Section 22, Data Retention |
| created_at / updated_at | timestamptz | |

### `daily_summary` (derived — compute on the fly, no need to persist) **[MVP]**
Total MS / XPMS / EBMS / HSD / Petrol-subtotal / Diesel-subtotal per date. Computed via query,
not stored, so it's always correct even after edits.

### `audit_logs` **[MVP]** — see Section 8
| column | type |
|---|---|
| id | uuid PK |
| user_id | uuid FK → users.id |
| role | text |
| action | text (e.g. `entry_created`, `entry_updated`, `exit_completed`, `record_deleted`, `password_changed`, `login_success`, `login_failed`) |
| record_id | uuid, nullable |
| old_value | jsonb, nullable |
| new_value | jsonb, nullable |
| ip_address | text |
| device_info | text (user agent) |
| created_at | timestamptz |

### `qr_scan_log` **[Phase 2]** — see Section 9
| column | type |
|---|---|
| id | uuid PK |
| qr_type | enum(entry_pass, exit_invoice) |
| raw_data | text |
| parsed_data | jsonb |
| scanned_by | uuid FK → users.id |
| scanned_at | timestamptz |
| status | enum(matched, no_match, error) |

### `notifications` **[Phase 2]** — see Section 10
| column | type |
|---|---|
| id | uuid PK |
| type | enum(tt_mismatch, dl_expired, pass_expired, duplicate_invoice, duplicate_entry, exit_without_entry) |
| record_id | uuid, nullable |
| message | text |
| is_read | boolean |
| created_at | timestamptz |

> **Product grouping** (confirmed with client, editable later): **Petrol = MS + XPMS + EBMS**,
> **Diesel = HSD**. Build as a config object, not hardcoded, so it can be reassigned later.
> **No price totals** — day-end shows quantity totals only (per client decision).

---

## 4. Entry / IN Gate Security — Flow **[MVP]**

1. Login → **Entry Dashboard**, showing only **today's** IN records.
2. **Scan QR** (camera) — crew ID pass, e.g.:
   ```
   Crew Id : IOC11965186D0010
   Name : RAGUPRABAHAR C
   Crew Type : Driver
   pass valid Upto : 03/08/2025
   TT No : TN74AZ8730
   DL No : Tn7420210005690
   DL Expiry Date : 02/07/2026
   ```
   Parse on `:` (label left, value right, trim both). Auto-fill Crew Id, Name, Crew Type, Pass
   Valid Upto, TT No (→ `tt_no_on_pass`), DL No, DL Expiry Date — **read-only**, not hand-editable.
3. Security enters/confirms the **actual physical Tank Truck No** (`tank_truck_no`) — a separate
   manual field from `tt_no_on_pass`.
4. **Yes/No toggle:** "Does TT No on pass match the lorry?" → sets `tt_no_match`. If **No**,
   flag for admin review (default: does not hard-block entry — confirm with client, Section 11).
5. Fill remaining fields: Customer/Destination, ABS, Challan No, safety checklist (Section 7),
   Driver Pass No, Helper Name/Pass No, Mobile Token No, Remarks.
6. **Submit** → `time_in` auto-stamped, row created `status = IN`, `created_by` set.
7. Visible to: this security (own IN list), exit security (today's IN, read-only), admin (IN
   records).
8. **Edit:** only own today's IN rows, only while `status = IN`.
9. **Hamburger (☰)** → drawer: **IN Records** (today, editable) / **OUT Records** (today,
   read-only).
10. Security UI shows **current date only** — no historical browsing for security roles; admin
    retains full history.

**Validation to add [MVP]:**
- Block/flag if the same `tank_truck_no` already has an open (`status = IN`) record today
  ("Vehicle already entered" notification).
- Block duplicate Mobile Token No within the same open day.

---

## 5. Exit / OUT Gate Security — Flow **[MVP]**

1. Login → **Exit Dashboard**, today's OUT records submitted so far.
2. **Scan Invoice QR**, e.g.:
   ```
   Inv:0793356259 Dt:06.06.25 Val:1143122.00 Veh:TN59CL2839 Prd/Qty:BULK-MS/8;BULK-HSD/4 Con:203031(VASUGI AGENCIES)
   ```
   Parse via labeled tokens (`Inv:`, `Dt:`, `Val:`, `Veh:`, `Prd/Qty:`, `Con:`), regex per label
   up to the next known label.
3. Search **today's `gate_entries`** where `tank_truck_no = Veh AND status = IN`.
   - **No match** → **"No data found"**. Exit security cannot create an entry from scratch.
   - **Match** → show **Block A** (entry data, read-only) + **Block B** (invoice data: Inv No,
     Date, Veh, Consignee — read-only; raw `Prd/Qty` shown as reference).
4. **Editable fields — exactly two groups:** small quantity inputs for MS / XPMS / EBMS / HSD;
   security fills in only the ones that apply (e.g. `BULK-MS/8` → `qty_ms = 8`; `BULK-HSD/4` →
   `qty_hsd = 4`). Maps directly to the Excel columns.
5. **Submit** → `time_out` auto-stamped, `status = OUT`, `exit_created_by` set.
6. Visible to: this security (own OUT list), entry security (today's OUT, read-only), admin
   (OUT records).
7. **Hamburger (☰)** → drawer: **IN Records** (today, read-only) / **OUT Records** (today,
   editable — own submissions).

**Validation to add [MVP]:**
- Block the same `invoice_no` being submitted twice ("Duplicate invoice").
- If `dl_expiry_date` or `pass_valid_upto` on the matched entry is in the past, show a warning
  banner before allowing exit submission (does not have to hard-block — confirm with client).

---

## 6. Notifications & Duplicate Validation **[Phase 2]**

Server-side checks that raise entries in the `notifications` table, surfaced as a bell/badge in
the Admin dashboard (and optionally a banner on the security screen at the moment of the
triggering action):

- TT Number mismatch (`tt_no_match = false`)
- Expired Driving License at entry or exit time
- Expired Pass at entry time
- Duplicate Invoice scanned
- Vehicle already entered (duplicate open IN for the same truck)
- Vehicle exited without a matching entry ("No data found" case, logged for admin visibility)

Admin can mark notifications as read/resolved. This is Phase 2 because the **inline validation
messages** in Sections 4–5 (MVP) already prevent the bad states at the point of entry — this
section is about giving admin a retrospective, centralized view.

---

## 7. Safety Checklist Fields (Register Image 2 — columns 16–32) **[MVP]**

The physical register photo is partly blurred; below is a best-effort transcription. **Verify
each label against the physical book before building the form** — these are compliance fields:

- Rubber hose cum coupling (marked / STIT No / OK)
- PPE
- Spark Arrestor approved by CCOE
- Trem card & Training card
- Self starter working
- Rubber cover on battery terminals
- No container/explosives in TT cabin
- VMU working
- Truck tyre condition
- Name of Driver
- Driver Pass No
- ABT (driver)
- Name of Helper
- Helper Pass No
- ABT (helper)
- Mobile Token No
- Signature of Driver
- Remarks

Most read naturally as **Yes/No toggles**, except name/pass-no/token (text) and Remarks (free
text). Build as a config-driven list so relabeling later doesn't need code changes.

Register Image 1, columns 12–15 (right edge, cropped in the photo, roughly "Driving License as
per CMV Rule 9") — **confirm the exact headers and column count**.

---

## 8. Audit Logs **[MVP]**

Every state-changing action writes an `audit_logs` row: who (user + role), what action, which
record, old value → new value (jsonb diff), when, from what IP/device. Minimum actions to log:

- Entry created / updated
- Exit completed
- Record deleted (soft-delete, Section 22)
- Password changed
- Login success / failed attempt
- Admin bulk-delete

This is the single most important addition for an Indian Oil deployment — it is what makes the
system defensible during an internal or external audit. Build this from day one, not bolted on
later, since retrofitting audit trails onto existing data is messy.

---

## 9. QR Scan History **[Phase 2]**

Log every scan attempt (successful or not) to `qr_scan_log` — raw text, parsed JSON, who
scanned, when, and whether it matched a record. Useful for debugging "the scanner isn't
working" reports and for fraud investigation (e.g. was this invoice QR ever scanned before, on
a different truck).

---

## 10. Admin Dashboard **[MVP core + Phase 2 additions marked]**

**[MVP]**
1. Landing view: date picker (defaults today) → that date's IN and OUT records, two tabs/tables.
2. Hamburger (☰) → drawer: **IN Records** (all dates, filterable) / **OUT Records** (all dates,
   filterable).
3. Full edit access on any record.
4. Delete individual records (soft delete, Section 22).
5. Bulk-delete by month, with a confirmation step (destructive, logged to `audit_logs`).
6. **Download Excel** for any date — regenerated from the database on request (Section 13).
7. Day-end totals for the selected date: Total MS / XPMS / EBMS / HSD, Total Petrol, Total
   Diesel. No price totals.

**[Phase 2] Dashboard statistics cards:**
`Today's Entries | Today's Exits | Pending (still IN) | Completed (OUT) | MS/XPMS/EBMS/HSD
Quantity Today`

**[Phase 2] Charts:** Daily entries (last 30 days), Monthly entries, Product distribution.

**[Phase 2] Search & filters:** by Date, Vehicle Number, Invoice Number, Driver Name, Customer,
Status, Employee Code, Product, Pass Number — combinable, not just single-field.

**[Phase 2] Reports:** Daily / Weekly / Monthly / Custom-date-range, Vehicle history, Driver
history. Export as Excel, PDF, and CSV (Excel is MVP via Section 13; PDF/CSV variants are
Phase 2).

**[Phase 2] Vehicle history:** click a truck number → all past visits (entry/exit times,
customer, invoice, products, remarks) for that `tank_truck_no`.

**[Phase 2] Driver history:** click a driver → visit count, license expiry, pass validity,
past mismatch/violation flags (derived from `notifications`).

**[Phase 2] Activity dashboard (live status board):** color-coded live view — Entered (green),
Pending Exit (orange), Completed (blue), Mismatch (red), Expired License (red). Good for a
screen mounted at the terminal office.

**[MVP] User management:** admin can add user, disable user (`is_active = false`), reset
password, change role, change employee code. This is MVP, not Phase 2 — without it, onboarding
a new security guard requires a database admin, which isn't realistic for daily operations.

---

## 11. Open Questions / To Confirm Before Dev Starts

1. Exact wording of register columns 12–15 (image 1) and 16–32 (image 2, transcribed in
   Section 7) — verify against the physical book.
2. What "ABS" (column 4) refers to exactly.
3. If `tt_no_match = No`, should entry be **blocked** or just **flagged**? Spec assumes flagged.
4. Driver Signature — digital signature pad (image) vs a "confirmed by driver" checkbox?
   Signature pads add real complexity (image storage) — confirm if truly needed for MVP.
5. Can one lorry carry more than one product within the same group (e.g. both MS and XPMS)?
   Spec supports it (one input per product).
6. Multiple physical gates in future? If yes, add `gate_id` to `users` and `gate_entries` now
   even if only one gate exists at launch, to avoid a schema migration later.
7. Expired DL/Pass at exit (Section 5) — hard-block or warning-only?
8. File uploads (Section 20) — is this needed for MVP, or can it wait? Driving license / truck
   photo / invoice image capture adds storage cost and complexity; recommend Phase 2 unless the
   client has an immediate dispute-resolution need for it.

---

## 12. UI/UX Principles (clean, clear, and easy to use under gate conditions)

Security staff will use this **standing at a gate, in daylight, sometimes one-handed, on a
budget Android phone** — design for that reality, not a typical office app:

- **One primary action per screen.** Entry and Exit flows are each a single vertical form with
  one clear "Submit" / "Confirm Exit" button at the end — no competing calls to action.
- **Large touch targets** (minimum ~44px), especially the Scan and Submit buttons, since gloves
  or quick taps in sunlight are common.
- **High-contrast, readable in direct sunlight** — avoid low-contrast grey-on-white text; the
  security dashboards should favor solid, high-contrast colors over subtle gradients.
- **Read-only fields are visually distinct** (e.g. greyed background, lock icon) from editable
  fields, so security never wonders "can I change this?" — critical given the spec's rule that
  QR-sourced fields are locked and only specific fields (TT No confirm, safety checklist,
  petrol/diesel quantity) are editable.
- **Inline validation, not silent failure.** "Vehicle already entered", "No data found",
  "Duplicate invoice" etc. should appear as clear, specific banners near the relevant field —
  never a generic "Error" toast.
- **Status is always visible.** A persistent badge/chip showing IN / OUT / Pending state on any
  record card, using the same three colors consistently everywhere (e.g. green = IN, blue =
  OUT, red = flagged) — this maps directly to Section 10's activity dashboard palette, so
  security and admin share the same visual language.
- **Minimal typing.** Anything the QR already provided should never be re-typed; anything with
  a fixed set of options (product type, crew type) should be a dropdown/toggle, not free text.
- **Admin dashboard is denser** (tables, filters, charts) since it's used on a desktop, seated —
  don't force the same sparse mobile-first layout on admin screens; optimize each role's UI for
  how it's actually used.
- **Empty and loading states are designed, not default.** "No records yet today" with a simple
  icon, not a blank white table. Loading spinners on scan/submit so security knows the tap
  registered (gate operations are fast-paced; unclear loading states cause double-submits).
- Full accessibility basics: visible keyboard focus states, adequate color contrast, and
  reduced-motion respected — cheap to build in from the start, expensive to retrofit.

---

## 13. Excel Export Format **[MVP]**

One workbook per date (`gate-log-YYYY-MM-DD.xlsx`), sheet "Register". Column order matches the
physical book:

`SL.NO | Name & Destination of Customer | Tank Truck No | ABS | Challan No | Time In | Time Out
| MS | XPMS | EBMS | HSD | [driving-license column(s) — TBC] | [safety checklist columns 16–24]
| Name of Driver | Driver Pass No | ABT | Name of Helper | Helper Pass No | ABT | Mobile Token
No | Signature Driver | Remarks`

- One row per lorry, `SL.NO` = day-scoped auto-increment.
- Quantity columns show liters entered at exit, blank if not yet exited.
- Last row: **Totals** — MS, XPMS, EBMS, HSD sums, Petrol-subtotal, Diesel-subtotal.
- Downloadable any time (live snapshot), not gated on all lorries having exited.
- Generate with `exceljs` (Node), **on-demand from the database** rather than archiving static
  files — single source of truth, no drift between the DB and old files.

---

## 14. Backup & Recovery **[MVP]**

- Automated **daily** database backup (retain e.g. 30 days), plus weekly/monthly rollups
  (retain longer, e.g. 1 year) — standard `pg_dump` on a cron job is sufficient at this scale.
- Store backups off the primary server (separate disk/object storage), not just locally.
- Documented, tested **restore procedure** — a backup nobody has restored from is not a backup.
- This is MVP, not Phase 2: a gate log is the kind of data where "we lost a day's records" is
  an operational and compliance problem, not just an inconvenience.

---

## 15. Security Requirements **[MVP]**

- HTTPS only (redirect HTTP → HTTPS), HSTS header.
- Parameterized queries / ORM (no raw string-built SQL) — SQL injection protection.
- Output encoding / React's default escaping — XSS protection.
- CSRF protection on state-changing requests (or rely on `SameSite` cookies + JWT-in-header
  pattern, whichever fits the chosen auth flow).
- Rate limiting on login endpoint (ties into account-lock policy, Section 2).
- Server-side input validation on every field (never trust client-side validation alone).
- Passwords hashed with bcrypt (never reversible encryption, never plaintext).
- Secure, `httpOnly`, `SameSite` cookies for the session token.

---

## 16. Performance Requirements **[MVP targets, tune after real load-testing]**

- QR scan → parsed result: under ~2 seconds on a mid-range Android phone.
- Login: under ~1 second.
- Dashboard load: under ~2 seconds.
- Excel export: under ~10 seconds for a full day's data.
- Target: 100+ concurrent users (generous for a single terminal, but cheap to design for
  upfront — stateless API + connection pooling gets you there without special effort).

---

## 17. Error Pages **[MVP]**

Custom, on-brand pages for: 404, 500, network error (offline detection), session expired
(redirect to login with a clear message, not a silent bounce), unauthorized (role tried to
access a route it shouldn't — e.g. entry security hitting an admin URL directly).

---

## 18. Camera / QR Scanner UX **[MVP core, Phase 2 extras marked]**

**[MVP]** Manual QR text input as a fallback (camera/lighting issues happen at a gate — never
let a broken scanner block operations), retry-scan button, clear "scanning…" state.

**[Phase 2]** Flashlight toggle (for night shifts), switch front/back camera, pinch-to-zoom.

---

## 19. File Uploads **[Phase 2 — see Open Question 8]**

Support uploading Driver License photo, Truck photo, Invoice image, Remarks attachment —
useful during disputes. Needs object storage (e.g. S3-compatible bucket), not just DB rows.
Recommend deferring past MVP unless the client has an immediate need.

---

## 20. Offline Support **[Phase 2 — genuinely useful, but non-trivial]**

If gate internet drops: queue the submission locally (e.g. IndexedDB in the browser), show a
clear "saved locally, will sync" state, auto-sync when connectivity returns. This is valuable
at real gate operations but adds meaningful complexity (conflict resolution if the same truck
was also entered from another device) — build after MVP is proven stable online.

---

## 21. Barcode & QR Printing **[Phase 2]**

Print Gate Pass / Entry Slip / Exit Slip / QR sticker from the admin or security UI — needs a
defined slip layout and a thermal/label printer integration at the gate. Scope this once the
client confirms what physical printers (if any) will be at each gate.

---

## 22. Data Retention Policy **[MVP: soft delete. Long-term policy: confirm with client]**

- **Soft delete only** — `is_deleted = true` flag, never a hard `DELETE`, so admin "delete" and
  "bulk delete by month" (Section 10) are recoverable and still show up in `audit_logs`.
- Retention period (e.g. "keep records 7 years" is typical for fuel/logistics compliance in
  India, but **confirm the exact figure with the client's compliance team** — do not assume).
- Archive-old-data-automatically (e.g. move records older than N years to cold storage) is
  **[Future]** — not needed until the dataset is actually large.

---

## 23. Future Modules **[Future — design schema to allow, don't build now]**

- RFID integration (tag read at gate instead of/alongside QR)
- Automatic boom barrier integration (auto-raise on valid entry — ties into Section 12's barrier
  visual metaphor used in the earlier prototype)
- ANPR (automatic number plate recognition) — could cross-check `tank_truck_no` automatically
- CCTV integration
- SMS / Email notifications (ties into Section 6's notification types)
- GPS tracking
- Weighbridge integration (capture gross/tare weight per visit)
- SAP integration (push completed visits to the client's SAP instance)

Keep `gate_entries` fields general enough (e.g. `gate_id`, structured JSON for extensibility)
that these can be added without a full schema rewrite.

---

## 24. API Endpoints (representative — full list to be documented as built) **[MVP]**

```
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/entries              (create IN record)
PUT    /api/entries/:id          (update — entry security or admin)
POST   /api/entries/:id/exit     (submit OUT — exit security)
GET    /api/entries?date=&status=&search=...
DELETE /api/entries/:id          (soft delete — admin only)
GET    /api/excel?date=YYYY-MM-DD
GET    /api/summary?date=YYYY-MM-DD
POST   /api/users                (admin: add user)
PUT    /api/users/:id            (admin: disable/reset/change role)
GET    /api/audit-logs?...       (admin)
```
Document every endpoint (request/response shape, auth required, role required) as it's built —
don't leave this for the end.

---

## 25. Deployment Specification **[MVP]**

- Ubuntu server, Nginx as reverse proxy, PM2 (or systemd) to keep the Node process alive and
  auto-restart on crash.
- SSL certificate (Let's Encrypt via Certbot is the standard free option) on the client's domain.
- PostgreSQL (managed service recommended if budget allows — e.g. RDS-equivalent — otherwise
  self-hosted with the backup plan from Section 14).
- Environment-based config (`.env`) for secrets — never commit credentials to the repo.
- Daily automated DB backup job (Section 14) wired into the deployment from day one, not added
  later.

---

## Next Step

This spec is ready to hand to a developer, or I can build the working Next.js + Node +
PostgreSQL codebase directly here (MVP scope first, per Section 0), with setup/deploy
instructions for your domain — let me know which you'd like, and if you want to lock in any
answers to Section 11's open questions before I start.
