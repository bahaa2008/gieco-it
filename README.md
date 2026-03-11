# IT Forms Pages

Arabic website that provides a dedicated page for each IT ISO form.

## Run

```bash
npm start
```

Then open `http://localhost:4173`.

## Data persistence

`F-IT-01-01` records are persisted in a local SQLite database file inside the app path:

- `sqlite.db`

The server creates and initializes this database automatically on first run.

Requires `sqlite3` CLI to be available on PATH (works with Node 18+ without `node:sqlite`).

## F-IT-01-01 features

- Row actions with icons for add/edit/delete and popup form for add/edit, with filters/sorting and CSV import moved into a dedicated modal.
- Google-like smart search (multi-keyword), extra filters (plan/user/country), and sorting (A-Z / Z-A), plus pagination with page size options (50/100/150).
- Bulk CSV import from the form page (`استيراد CSV`).
- API endpoint for bulk import: `POST /api/f-it-01-01-records/bulk`.
- Backend data model is normalized into lookup tables (`maintenance_plans`, `users`, `countries`) plus `devices`.

## Pages

- `index.html`: forms index with links to all form pages.
- `F-IT-01-01.html` ... `F-IT-01-10.html`: one page per form code.
