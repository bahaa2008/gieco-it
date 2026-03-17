# IT System — Features & Design Documentation

## 1) Product Overview

This project is an Arabic, RTL-oriented IT forms system built with **Node.js + Express** and a static HTML/JS frontend. It provides a central index and dedicated pages for ISO IT forms (`F-IT-01-01` to `F-IT-01-10`), plus user management and application settings.

Core goals:
- Standardize IT operational forms.
- Preserve core device and work-order data in SQLite.
- Support simple, low-friction operation in browser pages with Bootstrap RTL styling.

---

## 2) Architecture & Technology Design

### 2.1 Runtime Architecture
- **Backend service:** `server.js` Express app bound to `0.0.0.0:4173` by default.
- **Frontend delivery:** Static assets served from app root via `express.static(APP_ROOT)`.
- **Data store:** local `sqlite.db` accessed through the `sqlite3` CLI (`execFileSync` usage).

### 2.2 Main Technology Choices
- **Server:** Express 4.x.
- **DB strategy:** command-based SQLite calls (no ORM), with explicit SQL for schema + CRUD.
- **UI:** HTML pages using Bootstrap 5 RTL + custom CSS (`styles.css`).
- **State on client:** per-page JS modules with local state, and selective `localStorage` usage for settings/date range.

### 2.3 Data Model Design
Database tables:
1. `devices` (primary business entity for F-IT-01-01)
   - device identity and metadata fields.
   - foreign keys to lookups for user, country, maintenance plan.
2. `maintenance_plans` lookup table.
3. `users` lookup table.
4. `countries` lookup table.
5. `work_orders` (one work order schedule entry per device, unique by `device_id`).

Design notes:
- Lookup normalization avoids repeating user/country/plan text values across records.
- `work_orders.device_id` unique constraint enforces one active schedule payload per device (implemented as upsert behavior).
- Timestamps (`created_at`, `updated_at`) support sort-by-recency in API responses.

### 2.4 Routing Design
- Primary path style: `/page/<slug>/` (e.g., `/page/f-it-01-01`).
- Legacy compatibility redirects from `/F-IT-01-0X.html` to the new slug routes.
- Root index page (`index.html`) links to all forms + users + settings.

---

## 3) Feature Inventory

## 3.1 Global Features
1. **Arabic RTL interface** across all pages.
2. **Central forms index** with card/grid navigation to all modules.
3. **Custom branding/settings** stored in browser localStorage:
   - Company name
   - Logo URL
   - System title/subtitle
   - Dynamic page-title composition
4. **Legacy URL redirects** for backward compatibility.

## 3.2 Form F-IT-01-01 — Device Master Data
Implemented via `page/f-it-01-01` + `static/js/forms/f-it-01-01.js` + `/api/f-it-01-01-records*`.

Capabilities:
- Create, edit, delete device records.
- Bulk insert endpoint support.
- Search across multiple fields (tokenized query).
- Filter by maintenance plan, user, country.
- Sort by selectable field and direction.
- Pagination with configurable page size.
- Dynamic filters populated from current dataset.
- CSV import UI path (via file input + action button in page script).
- Modal-driven UX for form entry and advanced filters.

Record fields:
- `deviceName`, `deviceCode`, `deviceModel`, `originCountry`,
- `serialNumber`, `voltAmpere`, `deviceAmpere`, `deviceUser`, `maintenancePlan`.

Persistence notes:
- Records are persisted in SQLite `devices` and joined lookup tables.
- Seed data exists for first-run initialization.
- Legacy JSON migration path exists for old `data/f-it-01-01-records.json` payloads.

## 3.3 Form F-IT-01-02 — Preventive Maintenance Plan
Implemented via `page/f-it-01-02` + `static/js/forms/f-it-01-02.js` + `/api/f-it-01-02-schedule` and `/api/f-it-01-03-work-orders` integration.

Capabilities:
- Loads device records and computes preventive dates based on maintenance plan interval.
- Supports maintenance intervals (Arabic labels):
  - شهري, كل شهرين, ربع سنوي, نصف سنوي, سنوي.
- Date-range configuration modal with localStorage persistence.
- Search/filter/sort/pagination over generated schedule rows.
- “Create work order” action launches modal with selectable generated dates + optional custom date.
- Saves selected work-order dates to `f-it-01-03-work-orders` API.

Design behavior:
- Schedule dates are calculated by adding month intervals while preserving day-of-month semantics.
- Saved date range is reusable between sessions (browser storage key).

## 3.4 Form F-IT-01-03 — Maintenance Notification / Work Orders
Implemented via `page/f-it-01-03` + `static/js/forms/f-it-01-03.js` + `/api/f-it-01-03-work-orders`.

Capabilities:
- Reads and renders work-order entries created from F-IT-01-02.
- Presents scheduled dates per device in tabular format.
- Depends on existing device IDs from F-IT-01-01.

Server rules:
- Work-order payload is validated (required device and non-empty dates list).
- Device must exist; otherwise API returns 404.
- Upsert logic updates existing device work order or inserts new one.

## 3.5 Forms F-IT-01-04 to F-IT-01-10
Implemented as dedicated static page templates:
- F-IT-01-04: أمر شغل
- F-IT-01-05: سجل تاريخي لجهاز
- F-IT-01-06: طلب صيانة خارجي
- F-IT-01-07: تقرير فحص الأجهزة
- F-IT-01-08: إقرار إستلام جهاز
- F-IT-01-09: طلب إستخدام مواقع الإنترنت
- F-IT-01-10: طلب إنشاء حساب لموظف

Current implementation status:
- Each page provides a form-style table layout (document template UX).
- Each page applies dynamic page-title settings.
- No dedicated CRUD API integration is currently implemented for these forms.

## 3.6 Users Management Module
Implemented via `page/users-management` + `static/js/admin/users-management.js` + `/api/users`.

Capabilities:
- List users.
- Search/filter by name on client side.
- Create user.
- Edit user name.
- Delete user (with server-side protection if linked to devices).

Data integrity:
- Server blocks deletion of a user linked to any `devices.user_id` row (returns 409).

## 3.7 Settings Module
Implemented via `page/settings` + `static/js/core/settings.js`.

Capabilities:
- Update app branding values.
- Live logo preview.
- Reset to defaults.
- Persist settings in localStorage.
- Apply page title convention across modules.

---

## 4) API Design Details

## 4.1 Device Records API (`F-IT-01-01`)
- `GET /api/f-it-01-01-records` → list records.
- `POST /api/f-it-01-01-records` → create record.
- `PUT /api/f-it-01-01-records/:recordId` → update record.
- `DELETE /api/f-it-01-01-records/:recordId` → delete record.
- `POST /api/f-it-01-01-records/bulk` → bulk insert records.

Validation:
- All required fields must be string-typed.
- Bulk payload must be non-empty array of valid records.

## 4.2 Schedule Generator API (`F-IT-01-02`)
- `POST /api/f-it-01-02-schedule` → generates schedule events based on date range and maintenance rate.
- `GET /api/f-it-01-02-schedule` → explicitly returns 405 (method not allowed).

Validation:
- Valid start/end dates.
- startDate <= endDate.
- Valid maintenance rate (Arabic/English aliases or positive integer months).

## 4.3 Work Orders API (`F-IT-01-03`)
- `GET /api/f-it-01-03-work-orders` → all work orders.
- `GET /api/f-it-01-03-work-orders?deviceId=<id>` → one work order by device.
- `POST /api/f-it-01-03-work-orders` → upsert work order.

Validation:
- Requires `deviceId`, `deviceName`, `deviceCode`, `maintenancePlan`, and non-empty `dates[]`.
- Device existence required.

## 4.4 Users API
- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/:userId`
- `DELETE /api/users/:userId`

Validation/Rules:
- User name must be non-empty.
- Delete forbidden when linked devices exist.

---

## 5) UX / UI Design Details

### 5.1 Design System Patterns
- Bootstrap RTL as base UI framework.
- Custom theme variables and utility classes in `styles.css`.
- Consistent card-based layout and table wrappers.
- Action icons/buttons follow color-coded intent (add/edit/delete).

### 5.2 Interaction Patterns
- Modal-first editing on interactive pages.
- Table views for operational data.
- Immediate client-side filtering and sorting feedback.
- Pagination controls with current-range indicator.

### 5.3 Accessibility & Internationalization Notes
- Arabic language and RTL direction configured per page.
- Use of semantic table structures and form labels.
- Action buttons include labels/titles in key interaction components.

---

## 6) Initialization, Seeding, and Migration

1. On startup server initializes schema (idempotent CREATE TABLE IF NOT EXISTS).
2. Legacy JSON migration runs once if old file exists, then renames to `.migrated`.
3. If `devices` is empty, app seeds initial records.

Operational requirement:
- `sqlite3` CLI must be available in PATH for DB operations.

---

## 7) Security & Reliability Design Notes

- SQL values are escaped (`'` doubled) before SQL composition to reduce injection risk in this CLI-based approach.
- Input validation exists at API boundaries for all active write routes.
- Referential constraints used in schema and user-delete business rule.
- 404 fallback for unknown routes.

Known technical trade-off:
- DB operations are synchronous (`execFileSync`) and may block event loop under heavy load; acceptable for lightweight/internal deployment but not ideal for high concurrency.

---

## 8) Current Scope vs. Future Expansion

### Currently Data-Driven
- F-IT-01-01 (devices)
- F-IT-01-02 (schedule generation + work-order creation flow)
- F-IT-01-03 (work-order persistence/visualization)
- Users management
- Settings/branding

### Currently Template-Driven (Static Forms)
- F-IT-01-04 through F-IT-01-10 pages are mostly layout templates.

### Suggested Next Enhancements
1. Add APIs + persistence for F-IT-01-04 … F-IT-01-10.
2. Introduce auth/roles for edit permissions.
3. Replace CLI SQLite calls with a native Node SQLite driver for async + stronger parameterization.
4. Add test coverage (API unit/integration).
5. Add export/print workflows per form with structured document generation.

---

## 9) File/Module Map

Backend:
- `server.js`

Frontend shared:
- `index.html`
- `styles.css`
- `static/js/core/settings.js`

Interactive form modules:
- `static/js/forms/f-it-01-01.js`
- `static/js/forms/f-it-01-02.js`
- `static/js/forms/f-it-01-03.js`
- `static/js/admin/users-management.js`

Pages:
- `page/f-it-01-01/index.html` … `page/f-it-01-10/index.html`
- `page/users-management/index.html`
- `page/settings/index.html`

---

## 10) Conclusion

The system already delivers a practical operational baseline: full device registry management, preventive schedule generation, work-order persistence flow, and reusable user/settings modules. The architecture is intentionally simple and maintainable for internal use, while leaving clear extension points to convert all remaining ISO forms from static templates into fully data-driven modules.
