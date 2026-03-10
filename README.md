# IT Forms Pages

Arabic website that provides a dedicated page for each IT ISO form.

## Run

```bash
npm start
```

Then open `http://localhost:4173`.

## Data persistence

`F-IT-01-01` records are persisted in a local file inside the app path:

- `data/f-it-01-01-records.json`

The server creates this file automatically on first run.

## Pages

- `index.html`: forms index with links to all form pages.
- `F-IT-01-01.html` ... `F-IT-01-10.html`: one page per form code.
