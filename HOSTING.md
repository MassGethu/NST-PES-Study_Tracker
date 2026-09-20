# Hosting the two-user tracker

The existing React/Vite application and Express API share one PostgreSQL database.
Each account owns one `user_states` document. Lectures, revisions, checklists,
recall sessions and contests keep their existing shapes and IDs. Rithika uses the
same structure plus a `worksheets` collection; there is no second lecture model.

## Configure the existing Vercel project

1. Connect PostgreSQL and set server-side `DATABASE_URL` in the project's
   environment variables. Do not use a `VITE_` prefix for secrets.
2. Set `AADARSH_INITIAL_PASSWORD` and `RITHIKA_INITIAL_PASSWORD` to different
   passwords, each 8–128 characters. These provision usernames `aadarsh` and
   `rithika`, with `student_nst` and `student_worksheet` roles respectively.
3. Retain/set `GEMINI_API_KEY` for the existing AI features.
4. Deploy this repository: build `npm run build`, output `dist`. The included
   `vercel.json` routes APIs before the SPA fallback and includes the SQL schema.
5. Check `/api/health` returns JSON, then log in as both users. After initial
   provisioning, remove the two initial-password variables and redeploy. They
   never reset existing users' passwords on subsequent starts.

Provisioning attaches the sole legacy server account to Aadarsh by keeping its
ID, email, state and version. It sets the requested new username/password and
role only. If there are multiple unclaimed accounts it stops without guessing.
No public registration or browser-controlled role assignment is exposed.
Passwords are salted and hashed; sessions use HttpOnly cookies (Secure on HTTPS).
Users can change passwords in Settings → Account.

## Move Aadarsh's existing local data online

Browser data is origin-specific: Vercel cannot read localhost's localStorage.
The old `nst_tracker_v1` entry is never modified or deleted by the new app.

1. In the same Chrome profile previously used for the tracker, open
   `http://localhost:5173`. On the login screen choose **Export existing local
   data**. This downloads the original data without requiring a local database.
2. On the hosted website, sign in as **aadarsh** and open Settings → Data.
3. Choose **Import JSON Backup** and select that downloaded file. The import
   makes a safety backup, preserves original IDs and fields, deduplicates exact
   matches and refuses conflicting records rather than overwriting either copy.
4. Wait for **Imported and saved online**, reload, and compare subjects, lectures,
   contests, checklists and recall history with the local backup. Keep the backup.
5. Sign in as Rithika and confirm her account contains none of Aadarsh's data.

For data already stored at the hosted origin, Aadarsh can instead use **Import
old data from this browser**. Login itself never imports or merges browser data.
Rithika starts empty; add her own courses in Settings → Subjects.

Per-account browser caches preserve unsaved changes. Saving is serialized and
version-checked. On a conflict, Settings lets you export the pending copy before
reloading the server copy. Sign-out waits for saving instead of discarding edits.

## Local development and tests

Copy `.env.example` to `.env`, configure a local PostgreSQL connection and the
initial passwords, then run `npm install` and `npm run dev`.

```sh
npm run build
npm test
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/test_db npm test
```

The integration test uses a uniquely named temporary schema, verifies legacy
state equality and account isolation, then removes only that test schema. Without
`TEST_DATABASE_URL`, integration testing is explicitly skipped.

## Existing attachment hosting limit

Photos/audio still live in the existing state document. Vercel Functions limit
request/response bodies to 4.5 MB, so large attachment-heavy state documents need
private object storage or the existing long-running Express deployment instead.
Do not delete attachments to make an import fit. Source:
https://vercel.com/docs/functions/limitations

For a long-running Node host, `npm run build && npm start` serves both frontend
and backend; set `DATABASE_URL`, `GEMINI_API_KEY` and the initial password variables
there. Hosting/provider setup and any paid resources need the owner's access.
