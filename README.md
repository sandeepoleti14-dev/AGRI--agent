# Secure Student Notes

Plain HTML/CSS/JavaScript frontend, Express API, PostgreSQL on Supabase, and
session-based authentication.

## Local Setup

1. If `.env` does not exist, copy `.env.example` to `.env`. Otherwise, keep
  its current database values and add any missing variables from the example.
  Set a long random `SESSION_SECRET`, `SUPABASE_URL`, and
  `SUPABASE_SERVICE_ROLE_KEY`.
2. In the Supabase SQL editor, run `schema.sql` for a new database. Run
  `migrations/001_note_attachments.sql` to ensure attachment metadata and the
  private Storage bucket exist, then run `migrations/002_note_content_text.sql`
  to preserve existing note content while ensuring its column is PostgreSQL
  `TEXT`.
3. Run `npm install` and `npm run dev` from this folder. The API listens on
  port 3000 by default.
4. Serve `frontend/index.html` on port 5500, for example with the VS Code Live
  Server extension at `http://127.0.0.1:5500/frontend/index.html`.

Use the same hostname for the frontend and API. The frontend automatically
uses its own hostname for port 3000, so `127.0.0.1` stays paired with
`127.0.0.1` and `localhost` stays paired with `localhost`. Add any other
frontend origin to `FRONTEND_ORIGINS` as a comma-separated list.

## Attachments

The migration creates `student-note-attachments-private` as a private bucket,
limited to 10 MB and JPEG, PNG, WebP, GIF, PDF, plain-text, and CSV files.
Files are uploaded by the backend using the service-role key. The browser
never receives that key or a Storage object path. Each authenticated file
request verifies note ownership and redirects to a 60-second signed URL.

The service-role key must exist only in the backend `.env` or deployment
secret store. Never add it to `frontend/index.html`, source control, or a
public client bundle. Restart the backend after changing environment values.

## API

- `POST /api/register`, `POST /api/login`, `POST /api/logout`, `GET /api/me`
- Authenticated note routes: `GET/POST /api/notes`,
  `GET/PUT/DELETE /api/notes/:id`, and
  `GET /api/notes/:id/attachment`
- Note titles remain limited to 255 UTF-8 bytes. Note content has no
  application-level 256-byte limit and is stored as PostgreSQL `TEXT`. Request
  parsers accept up to 20 MiB for a JSON body or an individual multipart text
  field; the separate attachment-file limit remains 10 MiB.
