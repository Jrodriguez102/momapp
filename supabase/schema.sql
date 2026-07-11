-- ============================================================================
-- Mom Workout App — Supabase schema
-- Single-user app. RLS enabled on all tables per template practice, scoped
-- to the anon role since there's no auth layer (single user, private link).
-- ============================================================================

-- One row per completed workout session.
create table if not exists workout_sessions (
  id uuid primary key default gen_random_uuid(),
  day_id text not null,              -- e.g. 'day-1'
  block int not null,                -- which 4-week block
  week_in_block int not null,        -- 1-4
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  effort text,                       -- 'easy' | 'moderate' | 'hard' | 'very_hard'
  created_at timestamptz not null default now()
);

-- One row per exercise performed within a session.
create table if not exists exercise_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references workout_sessions(id) on delete cascade,
  exercise_id text not null,         -- matches id in src/data/program.js
  set_number int not null,
  weight numeric,                    -- null for cardio / bodyweight
  weight_unit text default 'lb',
  reps int,
  rpe numeric,                       -- null for cardio
  is_cardio boolean not null default false,
  logged_at timestamptz not null default now()
);

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

-- ---- RLS --------------------------------------------------------------------
alter table workout_sessions enable row level security;
alter table exercise_logs enable row level security;
alter table personal_records enable row level security;

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

-- Helpful indexes for the "last time you lifted X" and volume-tracking queries.
create index if not exists idx_exercise_logs_exercise_id on exercise_logs(exercise_id);
create index if not exists idx_exercise_logs_session_id on exercise_logs(session_id);
create index if not exists idx_workout_sessions_started_at on workout_sessions(started_at);

-- Supports the deload/week calculation, which counts completed sessions.
create index if not exists idx_workout_sessions_completed_at on workout_sessions(completed_at);
