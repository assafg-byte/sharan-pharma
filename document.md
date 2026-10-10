# Sharan Pharma (`sharan-pharma`) — Technical Document

One web application for the Sharan pharma division ("חטיבת פארמה שרן"). It unifies three platforms behind a single home page and a single deployment:

| Platform | Route | Audience | Access |
|---|---|---|---|
| **Customer call center — Mounjaro** (shifts, attendance, tasks, learning campus, leaflet) | `/mounjaro` → `/manager` or `/employee` | Call-center managers and employees | Login required, role-based |
| **Lilly PSP** — Omvoh / Ebglyss support-program flowchart + Q&A | `/psp` | Support-program representatives | Public to read; edit behind a shared admin password |
| **GSK Nucala** — interactive call script | `/nucala` | Representatives | Public to read; edit behind the same admin password |

Hebrew-first, RTL (`<html lang="he" dir="rtl">`). All UI copy uses feminine Hebrew grammar; gender-aware strings use a `{male|female}` placeholder syntax resolved per employee.

---

## 1. Technology

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript 5 |
| Styling | Tailwind CSS v4 (inline utility classes) + hand-written CSS for PSP/Nucala (`app/psp/*.css`, `app/nucala/nucala.css`) |
| Fonts | Rubik (main app), Assistant (PSP/Nucala) via `next/font/google` — needs network at build time |
| Database | SQLite through Prisma 7. Local: file `dev.db`. Production: Turso (LibSQL) via `@prisma/adapter-libsql` |
| Auth | NextAuth v4, credentials provider, JWT sessions, bcrypt (`bcryptjs`) |
| Tests | Vitest (unit), Playwright (e2e) |
| Hosting (current) | Vercel; build step runs the database migration scripts |
| Runtime | Node.js 20+ (developed on 24) |

Drag-and-drop uses the browser's native HTML5 drag events; the schedule PNG export is custom canvas code (`lib/exportCanvas.ts`). There are no UI-kit dependencies.

> Cleanup note: `package.json` still lists unused packages (`@dnd-kit/*`, `html2canvas`, `dom-to-image-more`, `better-sqlite3` + its Prisma adapter). They can be removed.

## 2. Repository layout

```
app/                    Pages and API routes (Next.js App Router)
  page.tsx              Home: platform chooser (Mounjaro / Lilly PSP / GSK)
  login/                Login form
  manager/ employee/    The two role dashboards of the call-center platform
  mounjaro/             Auth gate → redirects to /login, /manager or /employee
  psp/  nucala/         Public platforms (server page + CSS)
  api/                  REST-style route handlers (see §6)
  generated/prisma/     Generated Prisma client (git-ignored; `prisma generate`)
components/             UI (schedule table, attendance panel, campus, kanban, …)
  psp/  nucala/         Editors/viewers of the two content platforms
lib/                    Auth, DB client, domain logic (see §3)
prisma/                 schema.prisma + SQL migrations
scripts/                Idempotent migrations, seeding, export, maintenance (see §8)
tests/                  unit / api / integration / e2e
docs/                   ADR and content-authoring guidance
public/                 Static assets (logos, Mounjaro images, link-preview image)
middleware.ts           Session gate for pages and APIs (see §5)
vercel.json             Build command (runs migrations, then `next build`)
```

## 3. Key modules (`lib/`)

| File | Responsibility |
|---|---|
| `db.ts` | Prisma client singleton. Uses Turso when `TURSO_DATABASE_URL` is set, else the local `dev.db` |
| `auth.ts` | NextAuth options: credentials provider, JWT/session callbacks (carries `role`, `employeeId`, `gender`, `employeeType`) |
| `authSecret.ts` | Returns `NEXTAUTH_SECRET`; throws if unset (no default) |
| `serverAuth.ts` | `requireAuth(req, role?)` — validates the JWT inside API handlers |
| `conflictCheck.ts` | Detects shift conflicts: approved time-off, part-time availability |
| `exportCanvas.ts` | Renders the weekly schedule to a PNG with the 2D canvas API |
| `trafficLight.ts`, `useTrafficLight.ts` | Staffing color model (see §7.3) and its client store |
| `notificationSweep.ts` | Creates manager notifications for abandoned learning sessions and unviewed tasks |
| `mounjaroContent.ts` | Mounjaro leaflet text (topics, sub-topics, wizard steps) |
| `psp/*` | PSP content model (`types.ts`), default content, screen/flow logic (`screens.ts`), versioned store, edit-cookie auth (`editAuth.ts`) |
| `nucala/*` | Nucala content model, defaults, versioned store |

## 4. Data model (Prisma / SQLite — 23 models)

Source of truth: `prisma/schema.prisma`.

- **People & time:** `Employee` (role `EMPLOYEE`/`MANAGER`, gender, employment type `FULL_TIME`/`PART_TIME`, `phone4`, `passwordHash`, soft-delete `archived`), `Shift` (day 0–4 = Sun–Thu, `startHour`, `durationHours`, `weekKey` = Sunday of the week), `Attendance` + `AttendanceBreak`, `TimeOffRequest`, `PartTimeAvailability`, `ManagerCoverage`, `DayNote`
- **Work management:** `Task` (assignees stored as comma-separated ids), `TaskView` (first-view record per employee/task), `Notification` (manager inbox; `cleared` hides instead of deleting, so the dedupe sweeps do not re-create items)
- **Daily flow:** `ChecklistItem`, `BreakSlotConfig`, `BreakSelection` (one break per employee per day, unique slot per day)
- **Learning campus:** `CampusSettings` (incl. `leafletLocked`), `CampusQuestion`, `CampusSession`, `CampusQuestionAttempt`, `CampusProgress` (spaced-repetition schedule), `LeafletTopicOrder`
- **Display config:** `TrafficLightConfig` (singleton)
- **Content platforms:** `PspContentVersion`, `NucalaContentVersion` — each save is a new row holding the whole JSON document (full version history, restorable)

Conventions: dates are `YYYY-MM-DD` strings (local calendar day, to avoid timezone drift); hours are floats (`13.5` = 13:30); singleton settings rows use `id = 1`.

## 5. Authentication & authorization

1. **Login:** last 4 digits of the phone + password → bcrypt compare → JWT session cookie.
2. **`middleware.ts`** (matcher: `/manager`, `/employee`, `/api/*`): every request needs a valid JWT, except `/api/auth/*` and the public platforms' APIs `/api/psp/*`, `/api/nucala/*`. Unauthenticated API calls get `401`; pages redirect to `/login`. `/manager` is manager-only and `/employee` employee-only.
3. **Per-route checks** (`requireAuth`): managers may do everything; employees are limited to their own records (attendance, breaks, time-off, availability, learning sessions) and to tasks assigned to them. Shifts, employees, settings, the campus question bank and team learning reports are manager-only.
4. **PSP / Nucala edit mode:** one shared password (`PSP_EDIT_PASSWORD`). A correct password sets a signed, HTTP-only cookie (HMAC with `NEXTAUTH_SECRET`, 30-day expiry). Content writes verify the cookie and use optimistic concurrency (`baseVersion` must equal the latest version, else `409`).
5. **Secrets:** `NEXTAUTH_SECRET` is mandatory — there is no fallback value.

## 6. API surface (`app/api`)

| Area | Endpoints (methods) |
|---|---|
| Auth/setup | `auth/[...nextauth]`, `setup` (POST; first-manager bootstrap), `warmup` (GET) |
| Schedule | `schedule` (GET week + roster), `shifts` (GET, POST), `shifts/[id]` (PATCH, DELETE), `day-notes` (GET, PUT) |
| Attendance | `attendance` (GET, POST), `attendance/today` (GET), `attendance/[id]` (PATCH), `attendance/[id]/break` (POST), `attendance/[id]/break/[breakId]` (PATCH, DELETE) |
| People | `employees` (GET, POST), `employees/[id]` (PATCH, DELETE = archive), `availability` (GET, POST), `time-off` (GET, POST), `time-off/[id]` (PATCH, DELETE) |
| Tasks | `tasks` (GET, POST), `tasks/[id]` (PATCH, DELETE), `tasks/[id]/view` (POST) |
| Notifications | `notifications/manager` (GET runs the sweeps; DELETE = clear history), `notifications/[id]` (PATCH read/unread) |
| Daily flow | `checklist` (GET, POST), `checklist/[id]`, `checklist/callback` (POST), `break-slots` (GET, POST, DELETE), `break-slots/config` (GET, PATCH) |
| Campus | `campus/settings` (GET, PATCH), `campus/questions` (GET, POST), `campus/questions/[id]`, `campus/questions/due`, `campus/sessions` (GET, POST), `campus/sessions/[id]/attempts`, `campus/sessions/[id]/complete`, `leaflet/order` |
| Display config | `traffic-light` (GET, PATCH) |
| PSP / Nucala | `psp/auth` (GET status, POST login, DELETE logout), `psp/content` (GET, PUT), `psp/versions` (GET list, POST restore); same shape under `nucala/` |

Errors are JSON `{ error }` with `400` (validation), `401` (no session), `403` (not allowed), `404`, `409` (conflict).

## 7. Functional reference

### 7.1 Customer call-center platform (`/manager`, `/employee`)

**Manager** — weekly schedule builder (display and edit modes, native drag-and-drop, copy week, conflict warnings against approved time-off and part-time availability, PNG export); attendance control panel (live status, manual clock-in/out, correction of past shifts and breaks); tasks Kanban; hours report; time-off approvals; part-time availability; employee management (add, edit, archive); manager coverage; the Campus admin (settings, question bank, check-in checklist editor, CSV import, reports); the notification bell.

**Employee** — clock in/out, then the **entry chain** once per day: daily checklist (including break-time selection) → campus quiz (if enabled) → dashboard. Weekly schedule with "mine only" filter, personal hours report, time-off requests, own tasks board, part-time availability, Mounjaro leaflet, and the **break board** (today's break slots for everyone who is on shift, scheduled **or clocked in today**; each employee edits only her own).

New schedule/dashboard rules:
- **Hours coverage** stat = employee-hours (hours × days × people on shift).
- **Daily full-time default:** opening a future week with no shifts auto-creates Sun–Thu 08:00–16:00 for every full-time employee (skipping approved days off).

### 7.2 Learning campus
Question types: single choice, true/false, multi-select, and a drag-and-drop "report form" exercise. Spaced repetition: correct → next review after an interval that doubles (3, 6, 12, 24, 30 days cap); incorrect → 3 days. The **Reports** tab lists, per question, who answered wrongly and how often (wrong/total), plus a hint whether the question or one employee is the likely issue. Sessions left open for more than 24 h raise one manager notification per employee per day.

**Mounjaro leaflet** — topic grid, detail view and wizard modal. A manager switch (Campus → Settings) hides the content while keeping the topics visible. *The hiding is UI-only: the text is part of the client bundle.*

### 7.3 Traffic-light staffing model
Schedule cells are colored by how many employees are on shift in that period: **red** below the orange threshold, **orange**, **yellow**, **green**. The colors are fixed; the headcount thresholds are configured in Campus → Settings (defaults: orange from 1, yellow from 2, green from 3; stored in `TrafficLightConfig`, validated as strictly ascending integers ≤ 20). Applied to the table, its legend and the PNG export.

### 7.4 Lilly PSP (`/psp`)
Flowchart-style guidance for Omvoh and Ebglyss support programs, SMS templates, and a searchable Q&A. All texts, task lists, due-date offsets, SMS templates and Q&A live in one JSON document (`PspContent`) edited in-app and versioned in `PspContentVersion`. The flow *structure* (screens and transitions) is code (`lib/psp/screens.ts`). In the Q&A, newly added questions show a red **"חדש"** badge for a configurable number of days (`settings.qaNewDays`, default 14, 0 = off; per-question add/remove in the editor).

### 7.5 GSK Nucala (`/nucala`)
An interactive call script: nodes (screens) with choices, a patient form and a copyable call summary. Admins can edit texts and add, delete and re-wire nodes. Versioned in `NucalaContentVersion`; same edit password and cookie as PSP.

## 8. Scripts (`scripts/`)

| Script | Purpose |
|---|---|
| `run-build-migrations.ts` | Build entry point: runs every `apply-migration-*.ts` in order, then `cleanup-duplicate-shifts` |
| `apply-migration-*.ts` | **Idempotent** schema changes (`CREATE TABLE IF NOT EXISTS`, add column if missing). Safe on every deploy; mirrored by `prisma/migrations/*/migration.sql` |
| `export-database.ts` | Read-only full export (schema + rows) to a `.sql` file. Requires `TURSO_DATABASE_URL`, or `--local` to export `dev.db` |
| `reset-tasks.ts` | One-off: delete all tasks and their views/notifications (dry-run unless `--yes`) |
| `seed-*.ts`, `delete-test-question.ts` | Content seeding / cleanup helpers |

## 9. Configuration

| Variable | Required | Purpose |
|---|---|---|
| `NEXTAUTH_SECRET` | always | Signs sessions and the PSP/Nucala edit cookie; no default |
| `NEXTAUTH_URL` | production | Public site URL for NextAuth |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | production | Database; when empty the app uses `dev.db` |
| `PSP_EDIT_PASSWORD` | optional | Unlocks edit mode on `/psp` and `/nucala`; locked until set |
| `SITE_URL` | optional | Base URL for link-preview (Open Graph) images |
| `DATABASE_URL` | local | Used by the Prisma CLI config |

## 10. Build, run, deploy

```bash
npm install                                  # also runs `prisma generate`
cp .env.example .env.local                   # set NEXTAUTH_SECRET
npx tsx scripts/run-build-migrations.ts      # create/upgrade tables
npm run dev                                  # development, http://localhost:3000
npm run build && npm start                   # production build / server
npm test                                     # unit tests
```
On Vercel the `buildCommand` in `vercel.json` runs the migrations and then `next build`. On any other Node host, run the migration script once before `next start`.

## 11. Tests

- `tests/unit` — self-contained (`npm test`): conflict check, week utilities, checklist templating, traffic-light model.
- `tests/api`, `tests/integration`, `tests/e2e` — expect a running server with seeded users. The `@known-vulnerability` cases in `tests/api/apiSmoke.test.ts` document the pre-hardening behavior and are now outdated.

## 12. Known limitations

- Leaflet "hiding" is cosmetic (content ships in the client bundle).
- No rate limiting or lockout on login (4-digit identifier + password).
- One shared edit password for PSP and Nucala.
- `/api/setup` cannot bootstrap an empty database (it sits behind the login gate).
- Pre-existing lint errors (`react-hooks/set-state-in-effect`) in several components; no functional impact.
- The link-preview image (`public/og-home.png`) is a static screenshot of the home page and must be regenerated if the home page changes.
