# Hosting NST Study Tracker

The production app is a single deployable service:

- Vite builds the React frontend into `dist/`.
- Express serves that frontend and all `/api/*` routes.
- PostgreSQL stores one isolated tracker state per account.
- Photos and audio remain inside the state document for compatibility with existing data.

## Required environment variables

```env
DATABASE_URL=postgresql://user:password@host:5432/database
GEMINI_API_KEY=your_key
NODE_ENV=production
```

Optional variables are documented in `.env.example`.

## Render deployment

The included `render.yaml` creates a web service and PostgreSQL database. Create a Render Blueprint from the repository, then enter `GEMINI_API_KEY` when prompted.

The server creates missing tables from `api/schema.sql` during startup. Existing rows are never dropped or truncated.

## Data migration

Create the first account from **Settings → Account** in the browser that contains the existing tracker data. The app creates a local backup, merges the current browser data into the empty server account, and then syncs future changes automatically.

Other accounts begin with their own independent state and cannot access this account's records.
