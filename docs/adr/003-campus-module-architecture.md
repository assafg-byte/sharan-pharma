# ADR 003: Lilly Campus — Spaced Repetition Learning Module Architecture

**Date:** 2026-05-19  
**Status:** Accepted  
**Deciders:** Product Owner, Engineering

---

## Context

Lilly call center employees handle Mounjaro patient calls and need ongoing product knowledge. A one-time training does not produce durable recall. The product owner requested an in-app spaced repetition system (SRS) so employees review knowledge questions at intervals calibrated to their individual performance, integrated into the daily clock-in flow.

The initial design proposed replacing the existing `DailyChecklist` with campus questions when enabled. During an architectural review ("grill-me" session) this was identified as a design flaw: operational readiness (is Avaya up?) and knowledge testing are orthogonal concerns with different lifecycles and must remain independent.

---

## Decision 1 — Separate the Checklist from the Campus: the `CheckInPhase` State Machine

**Problem:** Two independent boolean flags (`showChecklist`, `showCheckInModal`) made invalid UI states representable — both modals could theoretically be shown simultaneously, or neither could fire after a network error.

**Decision:** Replace all modal booleans with a single `CheckInPhase` enum in `app/employee/page.tsx`:

```ts
type CheckInPhase = "loading" | "idle" | "clock-in" | "checklist" | "campus" | "done";
```

Transitions are **strictly sequential and mutually exclusive**:

```
loading → idle | clock-in | done   (on page-load data resolution)
idle    → clock-in                 (employee taps ▶ כניסה)
clock-in → checklist               (attendance record written; clock starts)
checklist → campus | done          (onComplete() fires; campus enabled?)
campus  → done                     (answered or dismissed)
done    → done                     (terminal; no re-entry this session)
```

**Consequences:**
- Invalid states (two modals open, stuck mid-chain) are **unrepresentable** by construction.
- `DailyChecklist` is a fully controlled component — visibility is driven by the parent phase, not internal state or `localStorage`. The `checklist_done_*` localStorage key was removed entirely.
- Page reload mid-shift: if an attendance record exists for today → `phase = "done"` immediately. No re-triggering of the chain.
- The `clockingIn` ref lock prevents duplicate attendance records from rapid double-taps before the POST response arrives.
- The catch branch of the main `Promise.all` sets `phase = "idle"` and clears loading, so a network failure on page load degrades to a usable dashboard rather than an infinite skeleton.

---

## Decision 2 — "Did Not Finish" (DNF) via Nullable `completedAt`

**Problem:** How to represent a session the employee abandoned mid-quiz without introducing a status enum that creates an invalid-state surface.

**Decision:** `CampusSession.completedAt` is `DateTime?` (nullable). A session is:

| State | Condition |
|---|---|
| In progress | `completedAt IS NULL AND startedAt >= now - 24h` |
| Abandoned (DNF) | `completedAt IS NULL AND startedAt < now - 24h` |
| Completed | `completedAt IS NOT NULL` |

There is no `status` column. The three states emerge from one nullable timestamp and one date comparison. Errors are defined out of existence: "skip" and "close before finishing" are not special cases — they simply leave `completedAt` as NULL.

**Consequence — session creation ordering:** Sessions are created **after** the due-questions query returns a non-empty list. Creating a session before checking for questions would produce a DNF record for an employee who had nothing to answer, inflating the manager's abandoned-session alert. The `init()` function in `CampusModal` is sequential by design:

```ts
const qRes = await fetch("/due?...");
if (!qRes.length) { setPhase("empty"); return; } // no session created
const sessionRes = await fetch("/sessions", { method: "POST" });
```

**Manager visibility:** `GET /api/campus/sessions` returns `abandonedCount = COUNT WHERE completedAt IS NULL AND startedAt < now - 24h`. This count also surfaces in `GET /api/notifications/manager` so the manager badge increments for genuine abandonment.

---

## Decision 3 — Atomic SRS Updates via `prisma.$transaction`

**Problem:** Recording a question attempt and updating the SRS schedule are two separate DB writes. A partial failure (attempt written, progress not updated) leaves the audit log and the scheduler in disagreement: the event log shows a correct answer, but the question shows as due again immediately.

**Decision:** Both writes are wrapped in a single Prisma transaction in `app/api/campus/sessions/[id]/attempts/route.ts`:

```ts
const [attempt] = await prisma.$transaction([
  prisma.campusQuestionAttempt.create({ data: { sessionId, questionId, employeeId, answeredCorrectly } }),
  prisma.campusProgress.upsert({
    where:  { employeeId_questionId: { employeeId, questionId } },
    create: { employeeId, questionId, nextReviewDate, intervalDays },
    update: { nextReviewDate, intervalDays },
  }),
]);
```

**SRS algorithm:**
- Correct answer → `intervalDays = 14`, `nextReviewDate = today + 14 days`
- Incorrect answer → `intervalDays = 3`, `nextReviewDate = today + 3 days`

**Progress rows are lazy:** `CampusProgress` rows are created on first answer only. A question with no row is treated as due immediately by the LEFT JOIN query (`p.id IS NULL → NULLS FIRST`). This means unanswered questions from a DNF session naturally resurface in the next session without any explicit scheduling.

---

## Decision 4 — UTC-Consistent Date Arithmetic

**Problem:** `addDays()` used `d.getDate()` (local time) combined with `d.toISOString()` (UTC). On a server running UTC+3 at 11pm local, the computed `nextReviewDate` could be one day behind the UTC date used by `todayStr()` in the due-questions query, causing drift that accumulates across sessions.

**Decision:** Use pure millisecond arithmetic throughout:

```ts
function addDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}
```

Both `addDays` and `todayStr` operate in UTC. The due-questions query compares `nextReviewDate <= today` where both sides are UTC ISO strings. Verified in production: a correct answer at 2026-05-19 produced `nextReviewDate = 2026-06-02`, exactly 14 UTC days later.

---

## Decision 5 — API Input Validation: Whitelist over Passthrough

**Problem:** `PATCH /api/campus/settings` was spreading the raw request body directly into Prisma's `update` object, allowing a client to attempt overwriting the primary key or injecting arbitrary fields.

**Decision:** All campus PATCH routes explicitly whitelist permitted fields and validate their types:

```ts
const update: { enabled?: boolean; questionsPerSession?: number } = {};
if (typeof body.enabled === "boolean") update.enabled = body.enabled;
if (typeof body.questionsPerSession === "number"
    && body.questionsPerSession >= 1
    && body.questionsPerSession <= 20) {
  update.questionsPerSession = body.questionsPerSession;
}
```

Unexpected fields are silently ignored; invalid values (wrong type, out of range) are discarded. The Prisma call receives only the validated subset.

---

## Schema Summary

```prisma
model CampusSettings {
  id                  Int      @id @default(1)   // singleton
  enabled             Boolean  @default(false)
  questionsPerSession Int      @default(3)
  updatedAt           DateTime @updatedAt
}

model CampusQuestion {
  id             Int      @id @default(autoincrement())
  text           String
  type           String   // "SINGLE_CHOICE" | "TRUE_FALSE" | "MULTI_SELECT"
  optionA        String
  optionB        String
  optionC        String   @default("")
  optionD        String   @default("")
  correctAnswers String   // "A" | "B" | "A,C"
  explanation    String
  attempts       CampusQuestionAttempt[]
  progress       CampusProgress[]
}

model CampusSession {
  id          Int       @id @default(autoincrement())
  employeeId  Int
  date        String    // "YYYY-MM-DD"
  startedAt   DateTime  @default(now())
  completedAt DateTime? // null = in-progress or DNF (> 24h)
  attempts    CampusQuestionAttempt[]
}

model CampusQuestionAttempt {
  // append-only event log — never mutated after creation
  sessionId         Int
  questionId        Int
  employeeId        Int
  answeredCorrectly Boolean
  answeredAt        DateTime @default(now())
}

model CampusProgress {
  // SRS scheduler state — one row per (employee, question)
  employeeId     Int
  questionId     Int
  nextReviewDate String  // "YYYY-MM-DD" UTC
  intervalDays   Int     @default(1)
  @@unique([employeeId, questionId])
}
```

---

## Due-Questions Query

```sql
SELECT q.*
FROM CampusQuestion q
LEFT JOIN CampusProgress p
  ON p.questionId = q.id AND p.employeeId = $employeeId
WHERE p.id IS NULL OR p.nextReviewDate <= $today
ORDER BY p.nextReviewDate ASC NULLS FIRST
LIMIT $n
```

Unseen questions (`p.id IS NULL`) sort first. Overdue questions follow, oldest-due first. Questions scheduled for the future are excluded.

---

## Regression Verification (2026-05-19)

| Check | Result |
|---|---|
| Orphaned sessions (`completedAt IS NULL`, 0 attempts) in production | **0** — Fix 2 confirmed effective |
| Raw body spreads in `/api/campus/` routes | **None** — security scan clean |
| `nextReviewDate` UTC format after correct answer | **2026-06-02** (exactly +14 UTC days) |
| State machine transitions visible in source | All 6 transitions confirmed, `.catch()` and `clockingIn` lock present |

---

## Files

| File | Role |
|---|---|
| `app/employee/page.tsx` | `CheckInPhase` state machine, clock-in lock, error recovery |
| `components/DailyChecklist.tsx` | Fully controlled; no internal visibility state |
| `components/CampusModal.tsx` | Sequential init, try/catch, DNF on abort |
| `components/CampusQuestionCard.tsx` | Question UI, distractor elimination, celebration burst |
| `components/CampusDashboard.tsx` | Manager 4-tab panel (settings, question bank, import scaffold, reports) |
| `app/api/campus/settings/route.ts` | Singleton GET/PATCH with field whitelist |
| `app/api/campus/questions/route.ts` | Question CRUD |
| `app/api/campus/questions/due/route.ts` | SRS due-questions LEFT JOIN query |
| `app/api/campus/sessions/route.ts` | Session GET (reporting) + POST |
| `app/api/campus/sessions/[id]/attempts/route.ts` | Atomic attempt + progress transaction |
| `app/api/campus/sessions/[id]/complete/route.ts` | Set `completedAt = now()` |
| `app/api/notifications/manager/route.ts` | Includes `abandonedSessions` count |
| `prisma/schema.prisma` | 5 Campus models + Employee reverse relations |
