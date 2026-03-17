# F-IT-01-02 / F-IT-01-03 — Features & Design Documentation

## 1) Scope
This document describes the implemented features and design decisions for:
- `F-IT-01-02` (الخطة السنوية للصيانة)
- `F-IT-01-03` (أمر شغل الصيانة)

Related implementation files:
- `page/f-it-01-02/index.html`
- `static/js/forms/f-it-01-02.js`
- `page/f-it-01-03/index.html`
- `static/js/forms/f-it-01-03.js`
- `server.js`

---

## 2) Functional Overview

### 2.1 F-IT-01-02 (Maintenance Schedule)
The page provides an interactive device maintenance schedule with:
- Search and filtering
- Sorting and pagination
- Date-range configuration for generated maintenance dates
- Row actions to generate single-device work orders
- Selection checkboxes for bulk actions
- Bulk action: generate work orders for selected devices
- Finished-status indicator (checkbox) based on existing persisted work orders

### 2.2 F-IT-01-03 (Work Order View)
The page displays generated work orders with:
- Device info
- Maintenance plan
- Flattened work-order dates as table rows
- Optional filtering by `deviceId` via query string

### 2.3 Backend Work-Order Persistence
SQLite-backed work-order storage is implemented using:
- Dedicated table: `work_orders`
- Upsert semantics per device:
  - Create new row for new device
  - Replace/update existing row for same device
- API endpoints for create and retrieval

---

## 3) UI & Page Design

## 3.1 Shared Visual Pattern
Both pages use:
- RTL layout (`dir="rtl"`)
- Bootstrap RTL stylesheet
- Shared global stylesheet (`styles.css`)
- Card/table layout with responsive container spacing

## 3.2 F-IT-01-02 Table Structure
Columns:
1. Selection checkbox (header select-all + per-row select)
2. اسم الجهاز
3. كود الجهاز
4. المخطط الزمني للصيانة الدورية
5. تواريخ الصيانة (rendered as list)
6. تم التنفيذ (read-only checkbox)
7. إجراءات (single-item work-order action icon)

## 3.3 Toolbar & Controls (F-IT-01-02)
Toolbar actions:
- `الفلاتر والفرز` (opens filter/sort modal)
- `إنشاء أوامر شغل للمحدد` (bulk action; enabled only when rows are selected)
- `إعداد التواريخ` (opens date-range modal)

Pagination controls:
- Page size selector
- Previous / next page navigation
- Results count and page indicator

## 3.4 Modals (F-IT-01-02)
1. **Filters modal**
   - Search field (tokenized)
   - Plan filter
   - Sort field + direction
   - Clear filters

2. **Date settings modal**
   - Start date
   - End date
   - Validation (valid dates + start <= end)

3. **Work-order modal** (single-device)
   - Read-only device info
   - Generated maintenance dates as checkboxes
   - Optional custom extra date
   - Submit to create/update work order

## 3.5 F-IT-01-03 Table Structure
Columns:
1. Sequence number
2. Device name
3. Device code
4. Maintenance plan
5. Work-order date

---

## 4) Client-Side Logic Design

## 4.1 Data Sources
`static/js/forms/f-it-01-02.js` loads data from:
- `/api/f-it-01-01-records` for devices
- `/api/f-it-01-03-work-orders` for work-order completion status

`static/js/forms/f-it-01-03.js` loads data from:
- `/api/f-it-01-03-work-orders`
- Optional `?deviceId=` query for device-specific view

## 4.2 Maintenance Date Calculation
The schedule calculates dates between start and end range using interval mapping:
- شهري => 1 month
- كل شهرين => 2 months
- ربع سنوي => 3 months
- نصف سنوي => 6 months
- سنوي => 12 months

Date generation logic:
- Validate start/end
- Start at range start
- Add interval months repeatedly until end date
- Render as `<ul><li>...</li></ul>`

## 4.3 Selection & Bulk State Model
In `static/js/forms/f-it-01-02.js`:
- `selectedRecordIds: Set<string>` tracks selected rows across rerenders
- Header select-all checkbox uses checked/indeterminate states based on current page
- Bulk button is disabled when `selectedRecordIds.size === 0`

## 4.4 Single Work-Order Generation Flow
1. User clicks row action icon
2. Work-order modal opens with generated dates
3. User selects one/more dates and/or custom date
4. Payload posted to backend
5. Success updates finished status and navigates to F-IT-01-03 for that device

## 4.5 Bulk Work-Order Generation Flow
1. User selects multiple rows
2. User clicks `إنشاء أوامر شغل للمحدد`
3. For each selected record:
   - Generate dates using configured range
   - Submit to backend with same API used by single mode
4. Success count shown to user
5. Finished-status checkboxes update for successful devices

---

## 5) Backend/API Design

## 5.1 Database Table: `work_orders`
Columns:
- `id` (TEXT, PK)
- `device_id` (TEXT, UNIQUE, FK to `devices.id`)
- `device_name` (TEXT)
- `device_code` (TEXT)
- `maintenance_plan` (TEXT)
- `dates_json` (TEXT; JSON array of date strings)
- `created_at` / `updated_at` (timestamps)

Design intent:
- Persist work orders separately from device master data
- Ensure one active work-order record per device (replace on same device)
- Keep records accumulated across different devices

## 5.2 API Endpoints
### `GET /api/f-it-01-03-work-orders`
- No query: return all work orders
- With `?deviceId=<id>`: return work order for that device or `null`

### `POST /api/f-it-01-03-work-orders`
Payload:
```json
{
  "deviceId": "...",
  "deviceName": "...",
  "deviceCode": "...",
  "maintenancePlan": "...",
  "dates": ["YYYY-MM-DD", "..."]
}
```
Behavior:
- Validate payload shape
- Ensure referenced device exists
- Upsert by `deviceId`
- Return normalized API response with parsed dates array

---

## 6) Validation & Error Handling

### Client Side
- Date validation in settings modal
- Prevent empty work-order date submission
- Bulk action skips records with no generated dates
- Alerts provide user-facing failure/success messages

### Server Side
- Work-order payload validation
- Device existence check before save
- Standard HTTP status handling:
  - `201` success
  - `400` invalid payload / save failure
  - `404` device not found

---

## 7) State Persistence

- Date range in `F-IT-01-02` persisted in `localStorage` key: `f-it-01-02-date-range`
- Work orders are persisted in SQLite (`work_orders` table)
- Finished status in UI is derived from persisted backend data, not transient local state

---

## 8) Extensibility Notes

Potential next bulk actions can reuse the same selection model:
- Bulk mark status operations
- Bulk export selected schedules
- Bulk navigation/report generation

Potential backend enhancements:
- Add work-order history table (multiple revisions per device)
- Add status lifecycle fields (open/in-progress/closed)
- Add created-by / approved-by metadata

---

## 9) Known Constraints / Current Behavior

- Bulk generation currently processes selected items sequentially.
- Per-device upsert means the latest generated work order replaces previous dates for that same device.
- F-IT-01-03 currently renders flattened date rows (one row per date occurrence).

