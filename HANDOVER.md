# Handover — Sharan Pharma (`sharan-pharma`)

One site for the Sharan pharma division, unifying three platforms: the Mounjaro customer call center (shifts, attendance, tasks, learning campus), Lilly PSP and GSK Nucala.
Hebrew-first, RTL. Roles (call-center platform): **MANAGER** and **EMPLOYEE**. See `document.md` for the full technical document.

## 1. Stack

| Layer | Technology |
|---|---|
| App | Next.js 16 (App Router) + React 19 + TypeScript, Tailwind CSS v4 |
| Auth | NextAuth (credentials: last 4 phone digits + password, bcrypt), JWT session |
| Database | Prisma 7 + SQLite. Local: `dev.db` file. Production: Turso (LibSQL) via `@prisma/adapter-libsql` |
| Hosting (current) | Vercel; build runs `scripts/run-build-migrations.ts` then `next build` (`vercel.json`) |
| Tests | Vitest (`npm test`), Playwright (`npm run test:e2e`) |

## 2. Run it locally

```bash
npm install                      # also runs `prisma generate`
cp .env.example .env.local       # then set NEXTAUTH_SECRET (openssl rand -base64 32)
npx tsx scripts/run-build-migrations.ts   # creates/updates tables in dev.db
npm run dev                      # http://localhost:3000
```

The first manager account must exist in the database. If you start from an empty
database, create one row in `Employee` with `role = 'MANAGER'` (password = bcrypt hash).
When loading the exported data (section 4) the existing accounts come with it.

## 3. Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXTAUTH_SECRET` | **Always** | Signs login tokens and the PSP edit cookie. **No default** — the app refuses to run without it. Use a fresh value; do not reuse the old one. |
| `NEXTAUTH_URL` | Production | Public URL of the site |
| `SITE_URL` | Optional | Public address for link previews (title/image shown when the link is shared). Defaults to the current Vercel address — set it when the site moves to its own domain |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Production | Database. If empty, the app uses the local `dev.db` |
| `PSP_EDIT_PASSWORD` | Optional | Shared password that unlocks edit mode on `/psp` and `/nucala`. Edit mode stays locked until set |
| `DATABASE_URL` | Local only | Used by `prisma.config.ts` for Prisma CLI |

## 4. Data

Schema: `prisma/schema.prisma`. Schema changes are applied by the idempotent scripts
in `scripts/apply-migration-*.ts` (safe to re-run; listed in `scripts/run-build-migrations.ts`),
mirrored by SQL files in `prisma/migrations/`.

The existing data (employees, schedules, attendance, tasks, learning history, settings) is
delivered separately as a single SQL file produced by `scripts/export-database.ts`:

```bash
sqlite3 new.db < export.sql              # into a local SQLite file
turso db shell <db-name> < export.sql    # into a Turso database
```

**The export contains personal data** (names, last 4 phone digits, birth dates, bcrypt
password hashes, attendance records). Handle per your data-protection policy.
Employees keep their current passwords; consider forcing a reset after migration.

## 5. How access control works

- `middleware.ts` requires a valid session for every page and every `/api/*` route, except
  NextAuth's own endpoints and the public read-only `/api/psp/*` and `/api/nucala/*`
  (their writes need the PSP edit password cookie).
- Page guards: `/manager` is manager-only, `/employee` is employee-only.
- Each API route then checks authorization with `requireAuth(req, role?)` (`lib/serverAuth.ts`):
  - Managers: everything.
  - Employees: only their own attendance, breaks, time-off, availability; only tasks assigned
    to them; own learning sessions only; read-only schedule. Shifts, employees, settings, the campus
    question bank (with correct answers) and the team's learning reports are manager-only.

## 6. Security notes

Fixed before handover:
- Removed the hard-coded fallback signing secret (`NEXTAUTH_SECRET` is now mandatory).
- Removed the one-off `/api/temp-seed-rdd` endpoint (unauthenticated, hard-coded token) and an empty `temp-add-manager` folder.
- Added per-record ownership checks to attendance, breaks, tasks, time-off and availability APIs
  (previously any logged-in employee could read or change other employees' records); shift
  creation is now manager-only.
- Input validation: invalid IDs/fields now return 400 instead of 500.
- "Clear notification history" hides rows instead of deleting them (the sweeps re-created deleted ones).

Known / for your review:
- **Mounjaro leaflet hiding is cosmetic.** The leaflet text lives in `lib/mounjaroContent.ts` and ships
  in the client bundle; the manager toggle (Campus → Settings) only hides it in the UI. Move it behind an
  API if it must be confidential.
- `/api/setup` creates the first manager only when none exists; it still requires a logged-in session
  through the middleware, so it cannot bootstrap an empty database (see section 2).
- No rate limiting / lockout on the login form (4-digit identifier + password).
- The PSP/Nucala edit mode is a single shared password.
- Task/notification APIs trust the client for some free-text fields (rendered by React, so escaped, but not length-limited).
- `npm test`: `tests/api` and `tests/integration` expect a running server with seeded users and are not self-contained; `tests/unit` is.
- `npx eslint` reports several pre-existing `react-hooks/set-state-in-effect` errors (style rule, no functional impact).

## 7. Layout

```
app/            pages + API routes (app/api/*)
components/     UI (WeekDisplay = schedule table, CampusDashboard = learning admin, …)
lib/            auth, DB client, schedule/conflict logic, traffic-light model, notification sweeps
prisma/         schema + SQL migrations
scripts/        idempotent migrations, seeding, export, one-off maintenance (reset-tasks.ts)
tests/          unit / api / integration / e2e
docs/           ADR and content guidance
```
