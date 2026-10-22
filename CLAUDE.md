# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-user React workout tracker built for one specific person (Arlene) — not a
multi-tenant product. There's no auth layer; the Supabase anon key is public in
`src/lib/supabase.js` by design, protected only by an unlisted deployment URL.
Personalization (name, program) is edited directly in source, not configured
at runtime.

## Commands

Run from the `momapp/` directory (this is the actual repo root — the parent
`MomProgram/` folder is not part of the git repo).

- `npm run dev` — start Vite dev server
- `npm run build` — production build
- `npm run lint` — oxlint (rules: `react/rules-of-hooks`, `react/only-export-components`)
- `npm run preview` — preview a production build locally
- `npm run deploy` — builds and pushes `dist/` to the `gh-pages` branch only (does **not** commit source changes to `main` — commit/push those separately)
- `npm run dev:fixture` — the app on fake in-memory data at
  `http://<host>:5199/momapp/` (LAN-exposed for phone testing). Only for this
  dev server, `vite.config.js` aliases the Supabase client to
  `src/dev/fixture/fixtureClient.js`; it never contacts Supabase, resets on
  reload (incl. drafts on that origin), and is never in a build. Data:
  `src/dev/fixture/seed.js` (also used by tests). URL switches before the `#`:
  `?empty`, `?blockDone`, `?failEffort`, `?nobanner`. Use it to test anything
  that writes; never test writes against live data.
- `npm test` — Vitest (unit + jsdom component tests)


## Architecture

**Data-driven program, thin components.** `src/data/program.js` is the single
source of truth for the training program — days, exercises, sets, rep ranges,
muscle groups, alternatives, per-exercise weights (`startWeight`/`goalWeight`/
`increment`/`confidence`), block structure constants, deload logic, volume
thresholds. Nothing exercise/week/rep related should be hardcoded into a
component; change program content only in this file. `src/data/helpers.js`
layers query/computation functions on top of it (block/week + queue math,
session writes, auto-close, progression suggestions, volume tallies, lookups)
and is the bridge between static program data and Supabase-backed session data.

**Block 01 (current).** 4 days run as a *queue* — Upper A → Lower A → Upper B →
Lower B → repeat (`PROGRAM_DAYS` order). 21 unique movements across 22 slots
(Leg Press Calf Raise is one shared object on Day 2 and Day 4). Exercise ids
are stable kebab-case of the name. Each exercise has exactly 2 alternatives,
only for equipment/comfort problems. No cardio anywhere. Pilot data from the
earlier 5-day program is `block = 0` in Supabase; new sessions write
`CURRENT_BLOCK` (1). The saved data contract (what gets written to Supabase)
is frozen for Block 01 — a future redesign must not change it.

**Session-count-based progression, not calendar-based.** Only
`status = 'completed'` sessions in `CURRENT_BLOCK` count.
`getCurrentBlockAndWeek(completedInBlock)` describes the session she's about
to do: 4 sessions = 1 week, 24 = 1 block, sessions 21–24 (week 6) are the
auto-applied deload (`applyDeloadToSets`: half the sets, min 2). After 24 the
block is complete and nothing new starts (no auto Block 02).
`getBlockState()` returns that plus `nextDay` — the day after the most recent
completed block-1 session (`getNextQueueDay`), Day 1 if none. A `partial`
session doesn't count, so the same day stays next; a missed calendar day never
skips content. Home's "Choose a different day" lets her start any day; the
queue then continues from whichever day she completed last. Counts are fetched
fresh on every page that needs them (Home, WorkoutSession).

**Planned weekdays are display only.** `PLANNED_WEEKDAYS` (Mon, Tue, Thu, Fri)
drives only the Home week card (`buildTrainingWeek` → `buildWeekRows` in
`src/domain/weekPlan.js`: completed rows show the workout actually done, on
any weekday; today/upcoming planned days are filled with the next queue days,
never past the block's end; past planned days with nothing done are muted
"missed" rows). A workout on any day counts. The card's "X of 4 done" (can
exceed 4) and the streak count any completed session regardless of block. Streak (`getWeeklyStreak`) = consecutive Mon–Sun
weeks with ≥ 3 completed sessions; an unfinished current week never breaks it.

**Routing:** `HashRouter` with three tabs (Home, History, Progress)
plus a session flow at `/session/:dayId`. `WorkoutSessionRoute` in `App.jsx` keys
`WorkoutSession` on `dayId` to force a clean remount on day change, so the
component reads its draft synchronously via lazy `useState` initializers (no
restore-then-overwrite race). The Volume tab was removed from nav/routes, but
its computation (`getPlannedWeeklyVolume`, `getVolumeStatus` with
`VOLUME_THRESHOLDS_BY_GROUP`) was kept since it may come back.

**Auto-close runs before anything counts.** The app can't run timers while
closed, so `App.jsx` calls `runAutoClose()` on open and on `visibilitychange`
→ visible. It closes any `in_progress` session idle ≥ 90 min (since last set)
or ≥ 120 min since its first set: `completed_at` = last set's `logged_at`,
`duration_seconds` = last − first set, `closed_by = 'auto'`, `session_rpe`
null, `status` = completed if ≥ 6 sets else partial. A stale zero-set session
is deleted. All writes are guarded on `status = 'in_progress'`, so it's
idempotent. Pages `await afterAutoClose()` before computing queue/week/resume
state, and listen for `SESSIONS_AUTO_CLOSED_EVENT` to refresh (Home) or
stop logging (WorkoutSession). No pg_cron / scheduled DB jobs.

**Workout session lifecycle** (`src/features/workout/`: `useWorkoutSession`
owns all of this, `workoutDraft.js` the draft, `WorkoutPage` + components the
UI; pure parts in `src/domain/workoutState.js`):
- A `workout_sessions` row is created lazily on the first saved set
  (`createSession`, deduped by a promise ref against double taps), never from
  just opening the page. Only one `in_progress` session at a time: same day
  resumes it; a different day shows "Another workout is in progress".
- Set saves are idempotent upserts on `(session_id, exercise_name,
  set_number)` (`saveSet`; unique index in the schema). `exercise_name` is
  always written (what she actually did, including swaps), reps must be a whole
  number > 0, `logged_at` is never sent so edits keep the original time.
  Logged sets can be tapped to edit or removed (`removeLiveSet`); removing the
  session's last set deletes the session row.
- Swapping after logging renames that slot's logged rows
  (`renameExerciseInSession`); unsaved entries are cleared on swap so weights
  never carry across movements.
- Last-set difficulty (3+ / 1–2 / 0 reps left → `rpe` 7 / 8.5 / 10) lives on
  exactly one row per exercise: the highest logged `set_number`
  (`syncExerciseRpe` moves it when a higher set is logged or the holder is
  removed). The hook mirrors every sync onto its in-memory rows
  (`withRpeOnTopSet`) — `removeLiveSet` relies on `row.rpe` to re-home the
  tap. Shown as "Easy / 3+ left", "Just right / 1–2 left", "Hard / 0 left"
  once ≥ 1 set is logged, highlighted after the final prescribed set. There is
  no per-set RPE input.
- Session effort is a 1–10 tap (`EffortPicker`) on the Workout complete
  screen, after Finish: `useSessionEffort` saves it with `updateSessionRpe`
  (session_rpe only, same write as History; saves queued so the latest pick
  lands last). Skipping leaves it null. A failed save shows a toast with
  Retry; the workout stays finished. `finishSession` still writes the draft's
  `sessionRpe` (null unless an old draft carried a pick). The legacy `effort` column is never written (History still labels
  pilot values via `EFFORT_OPTIONS`).
- Finish (`finishSession`, sticky bottom bar) is disabled at 0 sets. With < 6
  sets an AlertDialog asks "Only N sets logged" → "Count it" `completed` or
  `partial`; `closed_by = 'user'`; duration = first → last set (never wall
  clock). The live timer is display only.
- `localStorage` key `block1:session-in-progress-<dayId>` (namespaced by block
  so pilot drafts can't resume) holds only the draft: unsaved entries, swaps,
  the effort pick. Anything saved lives in Supabase and wins on resume.
- UI: full screen (no nav), one exercise open at a time; it auto-advances to
  the next unfinished one once all prescribed sets are logged and the last
  set's feel is tapped. Removing a set and swapping over typed numbers ask
  first. Loads use the throwing services with the 8 s timeout and a real
  error state (offline no longer looks like a fresh block).

**Progression suggestions** (`getExerciseSuggestion`) — suggestions only,
she can always override. Read from `getProgressionLogs`: block ≥ 1 sets only
(pilot reps were pre-filled and untrustworthy), completed + partial sessions,
tracked per `exercise_name` (an alternative never inherits the base
exercise's weight or goal). Double progression against her last session of
that name: all sets at top of range and last set not "0 left" → +increment,
reps back to bottom; at top with "0 left" → repeat once (then increase); > half
the sets below bottom in each of the last 2 sessions at the same weight →
−increment; otherwise same weight, more reps. Hold rule: < 3 completed sessions
in 7 days → no increases. `confidence: 'low'` → no target until logged in 2
sessions (calibration). Deload week → last working weight, no suggestions.
The weight input prefills with the target on increase/decrease days (with a
"Last time" note), otherwise the last logged block ≥ 1 weight, else
`startWeight`. Reps always start blank.

**History tab:** a flat chronological list of finished (`completed` +
`partial`) sessions, most recent first, with an All / This Week / This Month
filter. `getFinishedSessions()` + one bulk `getExerciseLogsForSessions()` query
give each row's summary up front. Partial sessions carry a "Partial" tag;
auto-closed ones say so. Rows expand to the full workout
(`groupSessionLogsByExercise`, with `originalName` flagging swaps). For 48 h
after `completed_at` (`isWithinEditWindow`) sets, last-set difficulty and
session effort are editable; edits only touch `exercise_logs` / `session_rpe`
and never `status`/`completed_at`/`closed_by` — except removing every set
(`removeHistorySet`) marks the session `partial`. Older sessions (incl. all
pilot ones) are read-only.

**Home tab** (`src/features/home/`: `HomePage` loads, `HomeView` renders from
props; fixtures in `__fixtures__/homeFixtures.js`): date + greeting, block/week
chip, `QuoteCard`, the hero (next in queue with real exercise names and the
day's fixed `estimatedMinutes` from `program.js`; an in-progress session takes
priority → "Continue workout"; "Block 01 complete" after 24), "Choose a
different day" in a bottom `Sheet`, stats (this month / streak / block n/24),
and the week card. There is no weigh-in card: when there's no
`body_weight_logs` entry in 7 days, the Progress nav item shows a coral dot
(`useWeighInDue` in `AppShell`, re-checked on route change and on
`BODY_WEIGHT_LOGGED_EVENT`).

**Supabase schema** (`supabase/schema.sql`, reference + idempotent; the
one-off Block 01 data migration is `supabase/block01-migration.sql`, already
run by hand): `workout_sessions` (`block`, `week_in_block`, `day_id`, `status`
in_progress/completed/partial, `started_at`, `completed_at`,
`duration_seconds`, `session_rpe` 1–10, `closed_by` user/auto, legacy
`effort`), `exercise_logs` (one row per set, unique on `(session_id,
exercise_name, set_number)`, `rpe` only on each exercise's last set),
`personal_records` (unused), and `body_weight_logs`. All live in the `momapp`
schema of a shared project (last free-tier slot — no new projects, keep writes
minimal). RLS is open to `anon` (single user, no auth). Any schema change goes
through hand-run SQL, never from the app; when adding fields to a logged set
or session, update the schema file and the write helpers in `helpers.js`.

**Exercise progress math** (`helpers.js`, Progress tab): logged sets are
grouped per session by `exercise_name` (`groupLogsBySession` — ids changed
between the pilot and Block 01, names didn't), and each session's "top set"
(heaviest weight, ties broken by reps — `getTopSet`) drives the chart and the
Epley estimate (`estimate1RM`), always labeled "estimated", never a true 1RM.
Raw per-set data stays available in each session's `sets` array.

**Styling:** Tailwind v4 via `@tailwindcss/vite`, theme tokens in
`src/index.css` under `@theme`. The `base-*` scale is intentionally
*reversed* — `base-950` is the lightest (page background), `base-100` the
darkest (primary text) — so `text-base-100`/`bg-base-950` keep meaning
"primary text"/"page background". Display font is Nunito (`font-display`),
body/UI text is Inter (`font-body`). Cards use the flat `.card` class.
`.glass` is still defined in `index.css` but no component uses it any more
(`EffortTap` was its last consumer); it can be removed in the redesign. Nav is
a floating dark pill (`App.jsx`) with the active tab as a white sub-pill. A
full visual redesign is planned and must treat the data contract as frozen.

## Before deploying

`vite.config.js`'s `base` must match the GitHub repo name, and
`src/lib/supabase.js` must point at the real Supabase project — see
`README.md` for the setup checklist. Note: the README also mentions a
`PROGRAM_START_DATE` setting from an earlier phase; progression is now
session-count-based (see above), so that setting no longer exists in source.
