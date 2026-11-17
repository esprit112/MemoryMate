# MemoryMate

A calm place to keep medical admin: the letters, the appointments, the medication list, and the question you meant to ask the doctor.

Built for one household managing memory loss, on the principle that the app should not become another thing its user has to remember.

## Status

**Prototype, mid-rewrite.** The interface, the data model and the document pipeline are here. The API routes are not: `api/index.js` at the current revision is a stub, so a fresh clone does not run end to end yet. Everything below describes the design as built, not a finished download.

## The problem

Memory clinics generate paper. Appointment letters, clinic summaries, medication changes, "we will write to you" letters. Those papers end up in a drawer, and the knowledge of what changed, when, and why ends up in one person's head: usually the carer, not the patient.

A notes app does not help, because it does not read the letter. MemoryMate is an attempt at something that does: drop in the document, get the appointment and the medication change out, keep the original, and never lose what was there before.

## What it is meant to do

| Area | Behaviour |
|---|---|
| Documents | A vault for letters, scans and images. The original stays; analysis is additive. |
| Reading documents | Gemini extracts appointment dates, times, locations, contacts and diagnoses, and notes where each came from. |
| Health insight | Plain-language summaries grounded in NHS guidance, with self-care suggestions kept separate from clinical advice. |
| Appointments | Upcoming appointments and recurring reminders, including recurrence rules. |
| Medication | Name, strength, directions, a photograph of the packet, and the date last issued. |
| Support cards | NHS pages and relevant charities matched to the conditions identified, not a generic directory. |
| Chat and vision | Questions about the record, and a photograph when a letter is easier to show than to type. |
| Alerts | Browser push notifications, an optional spoken reminder over text-to-speech, and SMS to a caregiver circle. |
| Safety net | Every add, update and delete is logged; deleted items can be restored from the log. |
| Admin | Whole-database backup and restore. |
| Housekeeping | Dark mode, an offline queue for failed writes, a live event console, and a watched folder that ingests new scans. |

## Who it is for

One account owner, and the people they look after. Each sub-profile is a separate person with separate documents, appointments and medication: a partner, a parent, a client. The point is isolation, not sharing. A sub-profile must never be able to see another's data.

## Architecture

```
api/index.js        Express app, deployed as a Vercel function
db.js               database layer: SQLite locally, libSQL/Turso or Postgres in production
schema.sql          tables
migration.sql       migrations
components/         React interface
services/           Gemini calls: analysis, chat, vision, summaries
utils/              shared helpers
data/               local database and per-user files during development
```

- **Frontend:** React, TypeScript and Vite.
- **API:** Express in one function, which is why `vercel.json` rewrites `/api/*` to `api/index.js`.
- **Auth:** Clerk. The publishable key reaches the browser by design; the secret key stays on the server.
- **Database:** SQLite on a single machine, Turso (libSQL) for a hosted instance, Postgres if one is already there. `db.js` picks at runtime from the environment.
- **AI:** Gemini, server-side. Document text and page images are sent to Google's API when analysed.

## Running it

Runtime configuration:

| Variable | Needed | What it is |
|---|---|---|
| `GEMINI_API_KEY` | yes | Gemini API key |
| `VITE_CLERK_PUBLISHABLE_KEY` | yes | Clerk publishable key, safe in the browser |
| `CLERK_SECRET_KEY` | yes | Clerk secret key, server only |
| `DB_PATH` | no | SQLite file. Defaults to `data/memorymate.db` |
| `USERS_BASE_DIR` | no | Root for per-profile files |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | no | Use Turso instead of local SQLite |
| `POSTGRES_URL` | no | Use Postgres instead |
| `VAPID_KEYS_PATH` | no | Web-push key pair for notifications |
| `SMS_WORKS_JWT` | no | SMS provider token for caregiver alerts |
| `PORT` | no | API port |

```bash
npm install
cp .env.example .env      # then fill in the required values
npm run build             # frontend into dist/
npx vercel dev            # API function and frontend together
```

`npm run dev` and `npm start` both run `node server.js` - a file that does not exist in this repository. The backend moved to a Vercel serverless function (`api/index.js`) and the scripts were never updated to match. `vercel dev` is the local runner that actually works, for the frontend; the API itself still ends at a placeholder comment (`// Maintain all your existing app.get, app.post, and watcher logic here`) where the routes are meant to go.

## Known limits

- **Not a medical device, and not a diagnosis.** Anything it says about a condition is a reading of a letter you gave it, produced by a language model. It can be wrong, and it can be confidently wrong.
- **Documents leave the machine when analysed.** Text and page images go to the Gemini API. That is the deal; if it is not acceptable for a particular letter, do not upload that letter.
- **No test suite yet.** The schema and the document pipeline are the parts that most need one.
- **Not multi-tenant hardened.** Per-profile isolation is enforced in middleware and by separate data directories. That is a design, not a security audit.

## Licence

No licence file. The code is public to read; all rights are reserved, and it is not intended for reuse or deployment as it stands.

---

Built by [Martin Greer](https://github.com/esprit112).
