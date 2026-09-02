# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-user React workout tracker built for one specific person (Arlene) — not a
multi-tenant product. There's no auth layer; the Supabase anon key is public in
`src/lib/supabase.js` by design, protected only by an unlisted deployment URL.
Personalization (name, program dates) is edited directly in source, not configured
at runtime.

## Commands

Run from the `momapp/` directory (this is the actual repo root — the parent
`MomProgram/` folder is not part of the git repo).

- `npm run dev` — start Vite dev server
- `npm run build` — production build
- `npm run lint` — oxlint (rules: `react/rules-of-hooks`, `react/only-export-components`)
- `npm run preview` — preview a production build locally
- `npm run deploy` — builds and pushes `dist/` to the `gh-pages` branch only (does **not** commit source changes to `main` — commit/push those separately)

There is no test suite configured in this repo.

## Architecture

**Data-driven program, thin components.** `src/data/program.js` is the single
source of truth for the entire training program — exercises, sets, rep ranges,
RPE targets, muscle groups, alternatives, deload logic, muscle-group volume
thresholds. Nothing exercise/week/rep related should be hardcoded into a
component; add or change program content only in this file. `src/data/helpers.js`
layers pure query/computation functions on top of it (block/week math, volume
tallies, exercise lookups) and is the bridge between static program data and
Supabase-backed session data.

**Session-count-based progression, not calendar-based.** The current block/week
isn't derived from dates — `getCurrentBlockAndWeek()` in `helpers.js` counts
*completed* Supabase sessions (5 sessions = 1 week, 4 weeks = 1 block, week 4 is
always an auto-applied 50%-volume deload). Missed days or uneven pacing never
skew the schedule; only actual completed sessions advance it. Session count is
fetched fresh on every page that needs it (Dashboard, WorkoutSession) rather than
cached/passed between routes, so it's always correct even after completing a
session and immediately starting another.

**Routing:** `HashRouter` with three tabs (Home/Dashboard, History, Progress)
plus a session flow at `/session/:dayId`. `WorkoutSessionRoute` in `App.jsx` keys
`WorkoutSession` on `dayId` specifically to force a clean remount on day change —
this lets the component read its initial state synchronously from storage via
lazy `useState` initializers instead of a restore effect, avoiding a race where a
same-tick persist effect could stomp just-loaded data. The Volume tab (a body
diagram color-coded by weekly training volume) was removed from the nav/routes
for now, but its underlying computation (`getPlannedWeeklyVolume`,
`getVolumeStatus`, `VOLUME_THRESHOLDS` in `helpers.js`/`program.js`) was left in
place since it's self-contained and may come back in a future pass.

**Fixed weekday schedule:** `PROGRAM_DAYS` (Day 1-5) are pinned to Mon-Fri via
`SCHEDULE_WEEKDAYS`/`getProgramDayForWeekday()` in `program.js`. `helpers.js`
builds a Mon-Sun `getWeekSchedule()` from that mapping plus real Supabase session
dates, which drives the Home tab's Today's Workout card, week strip, and the
"current streak"/"training days this week" stats. This sits alongside — doesn't
replace — the session-count-based block/week progression below.

**Workout session lifecycle:** a `workout_sessions` row is created lazily — only
when the first set is actually logged (`ensureSession()` in `WorkoutSession.jsx`),
never just from opening the session screen. Each logged set is written to
`exercise_logs` immediately (`handleLogSet`), not batched at the end. `status`
('in_progress' → 'completed') plus `started_at`/`completed_at`/`duration_seconds`
track the session; the elapsed-time display is computed from `started_at` on a
1s client-side tick (`getElapsedSeconds`, capped at `MAX_WORKOUT_DURATION_SECONDS`
= 2h) rather than written to the DB continuously — only the final duration is
persisted, on completion. `localStorage` (per-day key, not `sessionStorage` —
iOS Safari reclaims sessionStorage readily when backgrounded) still holds a
*draft* of not-yet-logged weight/rep entries, exercise swaps, and the effort
pick; anything already logged lives in Supabase and wins on resume
(`findInProgressSession` + `getSessionExerciseLogs`, merged over the local draft
on mount). The Home tab's "Continue Workout" card (`getAnyInProgressSession`)
surfaces whichever session is in progress, even if it belongs to a different day
than today's scheduled one.

**Supabase schema** (`supabase/schema.sql`): four tables —
`workout_sessions` (one row per session; `status`/`duration_seconds` were added
after initial launch, so the schema file also carries `alter table` + a backfill
`update` for already-deployed rows — rerunning the whole file is safe/idempotent),
`exercise_logs` (one row per logged set, references `exercise_id` from
`program.js`), `personal_records`, and `body_weight_logs` (one row per
body-weight check-in, independent of workout sessions, feeds the Progress tab).
RLS is enabled on all tables but scoped open to the `anon` role (single-user app,
no auth). When adding fields to a logged set or session, update both the schema
and the insert calls in `WorkoutSession.jsx`.

**Exercise progress math** (`helpers.js`, used by the Progress tab): logged sets
for an exercise are grouped by `session_id` (`groupLogsBySession`), and each
session's "top set" (heaviest weight, ties broken by reps — `getTopSet`) is what
drives the progression chart and the Epley-formula strength estimate
(`estimate1RM`) — deliberately not raw weight alone, since rep ranges shift
intentionally across a block. The estimate is always labeled "estimated" in the
UI, never presented as a true 1RM. Raw per-set data is never discarded; it stays
available in each session's `sets` array for the drill-down detail view.

**Styling:** Tailwind v4 via `@tailwindcss/vite`, theme tokens defined in
`src/index.css` under `@theme`. The `base-*` color scale is intentionally
*reversed* from a typical dark-theme convention — `base-950` is the lightest
(page background) and `base-100` is the darkest (primary text) — kept this way
so existing `text-base-100`/`bg-base-950` usage continues to mean "primary
text"/"page background" without a rename pass. Display font is Nunito (bold
rounded sans, `font-display`); body/UI text is Inter (`font-body`). Cards use the
flat `.card` class (opaque `base-800` surface + soft shadow, no blur/border) —
this replaced the original `.glass` treatment tab-by-tab as each got its design
pass; all tabs are now on `.card`. `.glass` still exists and is still used by
`EffortTap.jsx` only, left untouched per explicit instruction — don't remove it
while that consumer remains. Nav is a floating dark pill (`App.jsx`) with the
active tab rendered as a white sub-pill.

**History tab:** a flat chronological list of completed sessions (most recent
first, no block/week grouping — that context already lives on the Home tab),
with an All / This Week / This Month filter. `getCompletedSessions()` fetches
the sessions and `getExerciseLogsForSessions()` bulk-fetches every logged set
across all of them in one query (not per-row), so each row's summary — minutes,
set count, total volume via `getSetsVolume()` — is available up front rather
than lazily. Tapping a row expands it in place to the full workout:
`groupSessionLogsByExercise()` groups sets per exercise and flags a swapped-in
alternative via its `originalName` field (set whenever a logged
`exercise_name` differs from the prescribed exercise), plus the session's
duration/volume/effort response.

## Before deploying

`vite.config.js`'s `base` must match the GitHub repo name, and
`src/lib/supabase.js` must point at the real Supabase project — see
`README.md` for the setup checklist. Note: the README also mentions a
`PROGRAM_START_DATE` setting from an earlier phase; progression is now
session-count-based (see above), so that setting no longer exists in source.
