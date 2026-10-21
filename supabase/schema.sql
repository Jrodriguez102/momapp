-- ============================================================================
-- Mom Workout App — Supabase schema (reference)
-- Single-user app. RLS enabled on all tables per template practice, scoped
-- to the anon role since there's no auth layer (single user, private link).
-- Tables live in the `momapp` schema of a shared project (see
-- src/lib/supabase.js).
--
-- Block 01 changes were applied with supabase/block01-migration.sql (run by
-- hand, step by step, on 2026-10-20). That file also did the one-off data
-- work — relabeling pilot sessions as block 0, backfilling exercise_name,
-- removing duplicate set rows — which is deliberately NOT repeated here.
-- This file only describes the resulting structure and is safe to re-run.
-- ============================================================================

-- One row per workout session — created the moment the first set is saved
-- (never when the session screen is merely opened), and updated in place as
-- the workout continues and closes. Only status='completed' rows in the
-- current block count toward the queue, week, deload and streak.
create table if not exists workout_sessions (
  id uuid primary key default gen_random_uuid(),
  day_id text not null,              -- 'day-1'..'day-4' (pilot rows: 'day-1'..'day-6')
  block int not null,                -- 0 = pilot, 1 = Block 01
  week_in_block int not null,        -- 1-6 (week 6 = deload); pilot rows 1-4
  started_at timestamptz not null default now(), -- = when the first set was saved
  completed_at timestamptz,          -- Finish tap, or the last set's time when auto-closed
  status text not null default 'in_progress', -- 'in_progress' | 'completed' | 'partial'
  duration_seconds int,              -- first -> last logged set (never wall clock)
  effort text,                       -- LEGACY pilot tap ('easy'...'very_hard'); no longer written
  session_rpe smallint check (session_rpe between 1 and 10), -- end-of-session effort, 1-10
  closed_by text check (closed_by in ('user', 'auto')),       -- Finish tap vs auto-close
  created_at timestamptz not null default now()
);

-- Existing deployments: add columns introduced after initial launch.
alter table workout_sessions add column if not exists status text not null default 'in_progress';
alter table workout_sessions add column if not exists duration_seconds int;
alter table workout_sessions add column if not exists session_rpe smallint check (session_rpe between 1 and 10);
alter table workout_sessions add column if not exists closed_by text check (closed_by in ('user', 'auto'));
-- Backfill: any pre-existing row with a completed_at predates the status
-- column and must not be misread as still in progress.
update workout_sessions set status = 'completed' where completed_at is not null and status = 'in_progress';

-- One row per logged set. Saved with an upsert on
-- (session_id, exercise_name, set_number), so re-saving a set updates it.
create table if not exists exercise_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references workout_sessions(id) on delete cascade,
  exercise_id text not null,         -- the program slot id in src/data/program.js (pilot ids differ)
  exercise_name text,                -- what she actually did (base or swapped-in alternative); always written by the app — NOT NULL constraint pending
  set_number int not null,
  weight numeric,                    -- null for bodyweight
  weight_unit text default 'lb',
  reps int,                          -- explicit entry, > 0
  rpe numeric,                       -- last-set difficulty (7 / 8.5 / 10), only on the exercise's highest set; else null
  is_cardio boolean not null default false, -- LEGACY; always false since Block 01 (no cardio)
  logged_at timestamptz not null default now() -- first save time; edits don't change it
);

-- One row per (session, exercise name, set number) — makes set saves idempotent.
create unique index if not exists exercise_logs_session_exercise_set_uq
  on exercise_logs (session_id, exercise_name, set_number);

-- Tracks PRs per exercise (kept for completeness — not surfaced prominently
-- in the UI per this app's focus on toning over strength).
create table if not exists personal_records (
  id uuid primary key default gen_random_uuid(),
  exercise_id text not null unique,
  best_weight numeric,
  best_reps int,
  achieved_at timestamptz,
  updated_at timestamptz not null default now()
);

-- One row per logged body-weight check-in (Progress tab). Independent of
-- workout_sessions — she can log weight on rest days too.
create table if not exists body_weight_logs (
  id uuid primary key default gen_random_uuid(),
  weight numeric not null,
  weight_unit text default 'lb',
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---- RLS --------------------------------------------------------------------
alter table workout_sessions enable row level security;
alter table exercise_logs enable row level security;
alter table personal_records enable row level security;
alter table body_weight_logs enable row level security;

-- Single-user app: anon key is private to her via an unlisted deployment URL.
-- Policies scoped to anon role explicitly rather than left open.
create policy "anon full access - workout_sessions"
  on workout_sessions for all
  to anon
  using (true)
  with check (true);

create policy "anon full access - exercise_logs"
  on exercise_logs for all
  to anon
  using (true)
  with check (true);

create policy "anon full access - personal_records"
  on personal_records for all
  to anon
  using (true)
  with check (true);

create policy "anon full access - body_weight_logs"
  on body_weight_logs for all
  to anon
  using (true)
  with check (true);

-- Helpful indexes for the "last time you lifted X" and volume-tracking queries.
create index if not exists idx_exercise_logs_exercise_id on exercise_logs(exercise_id);
create index if not exists idx_exercise_logs_session_id on exercise_logs(session_id);
create index if not exists idx_workout_sessions_started_at on workout_sessions(started_at);
create index if not exists idx_body_weight_logs_logged_at on body_weight_logs(logged_at);

-- Supports the deload/week calculation, which counts completed sessions.
create index if not exists idx_workout_sessions_completed_at on workout_sessions(completed_at);

-- Supports the "resume an in-progress workout" and "Continue Workout" lookups.
create index if not exists idx_workout_sessions_status on workout_sessions(status);
