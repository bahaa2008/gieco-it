# IT Forms Pages (Node.js + Express)

Arabic website that provides a dedicated page for each IT ISO form.

## Stack

- **Backend:** Node.js + Express
- **UI Framework:** Bootstrap 5 (RTL)
- **Persistence:** SQLite (via `sqlite3` CLI)

## Run

```bash
npm install
npm start
```

Then open `http://localhost:4173`.

## Data persistence

`F-IT-01-01` records are persisted in a local SQLite database file inside the app path:

- `sqlite.db`

The server creates and initializes this database automatically on first run.

Requires `sqlite3` CLI to be available on PATH.

## API highlights

- `GET/POST/PUT/DELETE /api/f-it-01-01-records`
- `POST /api/f-it-01-01-records/bulk`
- `GET/POST/PUT/DELETE /api/users`
- `POST /api/f-it-01-02-schedule`

## Routes

- `index.html`: forms index with links to all form pages.
- `page/f-it-01-01` ... `page/f-it-01-10`: one page per form code.
- `page/users-management`: users management page.
- Legacy routes like `/F-IT-01-01.html` and `/users-management.html` are redirected to slug routes.
