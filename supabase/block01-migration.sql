-- ============================================================================
-- Block 01 migration for momapp (Supabase SQL Editor)
-- Run STEP BY STEP, in order, one block at a time, and check each result.
-- Run Steps 1-7 BEFORE deploying the new app code.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- STEP 0: Inspect existing constraints (read-only). Look for any CHECK on
-- `status` or `block` -- they decide whether Step 4 / Step 5 need changes.
-- ---------------------------------------------------------------------------
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in ('momapp.workout_sessions'::regclass, 'momapp.exercise_logs'::regclass);


-- ---------------------------------------------------------------------------
-- STEP 1: Backup (cheap copies inside the same schema)
-- ---------------------------------------------------------------------------
create table if not exists momapp.workout_sessions_bak_20261020 as
  select * from momapp.workout_sessions;
create table if not exists momapp.exercise_logs_bak_20261020 as
  select * from momapp.exercise_logs;

-- Verify: counts should match the originals
select
  (select count(*) from momapp.workout_sessions)          as sessions,
  (select count(*) from momapp.workout_sessions_bak_20261020) as sessions_bak,
  (select count(*) from momapp.exercise_logs)             as logs,
  (select count(*) from momapp.exercise_logs_bak_20261020)    as logs_bak;


-- ---------------------------------------------------------------------------
-- STEP 2: Add new columns
-- ---------------------------------------------------------------------------
alter table momapp.workout_sessions
  add column if not exists session_rpe smallint
    check (session_rpe between 1 and 10);

alter table momapp.workout_sessions
  add column if not exists closed_by text
    check (closed_by in ('user', 'auto'));


-- ---------------------------------------------------------------------------
-- STEP 3: Relabel all existing (pilot) sessions as block 0.
-- If Step 0 showed a CHECK on `block` that forbids 0 (e.g. block >= 1),
-- drop it first:  alter table momapp.workout_sessions drop constraint <name>;
-- ---------------------------------------------------------------------------
update momapp.workout_sessions set block = 0;

-- Verify: should return a single row, block 0, 24 sessions
select block, count(*) from momapp.workout_sessions group by block;


-- ---------------------------------------------------------------------------
-- STEP 4: Allow status = 'partial'.
-- Only needed if Step 0 showed a CHECK constraint on `status`.
-- Replace <status_constraint_name> with the name from Step 0, then run:
-- ---------------------------------------------------------------------------
-- alter table momapp.workout_sessions drop constraint <status_constraint_name>;
-- alter table momapp.workout_sessions
--   add constraint workout_sessions_status_check
--   check (status in ('in_progress', 'completed', 'partial'));


-- ---------------------------------------------------------------------------
-- STEP 5: Backfill exercise_name where it is null (primary exercise of the
-- slot). Pilot rows only have a name when a swap was recorded.
-- ---------------------------------------------------------------------------
update momapp.exercise_logs el
set exercise_name = m.name
from (values
  ('db-bench-press',              'DB Bench Press'),
  ('seated-db-shoulder-press',    'Seated DB Shoulder Press'),
  ('incline-db-press',            'Incline DB Press'),
  ('cable-lateral-raise',         'Cable Lateral Raise'),
  ('tricep-rope-pushdown',        'Tricep Rope Pushdown'),
  ('barbell-hip-thrust',          'Barbell Hip Thrust'),
  ('romanian-deadlift',           'Romanian Deadlift'),
  ('reverse-lunge-smith',         'Reverse Lunge (Smith)'),
  ('seated-leg-curl',             'Seated Leg Curl'),
  ('lat-pulldown',                'Lat Pulldown'),
  ('seated-cable-row',            'Seated Cable Row'),
  ('db-single-arm-row',           'DB Single-Arm Row'),
  ('rear-delt-fly',               'Rear Delt Fly'),
  ('db-bicep-curl',               'DB Bicep Curl'),
  ('lifted-heel-squat',           'Lifted Heel Squat'),
  ('walking-lunge',               'Walking Lunge'),
  ('leg-press',                   'Leg Press'),
  ('hip-abduction-machine',       'Hip Abduction Machine'),
  ('standing-calf-raise',         'Standing Calf Raise'),
  ('cable-glute-kickback-2',      'Cable Glute Kickback'),
  ('kb-sumo-deadlift-2',          'KB Sumo Deadlift'),
  ('db-curl-overhead-tricep-ext', 'DB Curl + Overhead Tricep Ext'),
  ('hammer-curl-skull-crusher',   'Hammer Curl + Skull Crusher')
) as m(exercise_id, name)
where el.exercise_id = m.exercise_id
  and el.exercise_name is null;

-- Verify: should return 0
select count(*) as still_null from momapp.exercise_logs where exercise_name is null;


-- ---------------------------------------------------------------------------
-- STEP 6: Remove duplicate set rows (same session + exercise + set number).
-- Preview first -- expect a handful of rows (double-tapped sets):
-- ---------------------------------------------------------------------------
select session_id, exercise_name, set_number, count(*) as copies
from momapp.exercise_logs
group by session_id, exercise_name, set_number
having count(*) > 1
order by session_id, exercise_name, set_number;

-- Then delete, keeping the earliest-logged copy of each:
delete from momapp.exercise_logs a
using momapp.exercise_logs b
where a.session_id    = b.session_id
  and a.exercise_name = b.exercise_name
  and a.set_number    = b.set_number
  and (a.logged_at, a.id) > (b.logged_at, b.id);

-- Verify: the preview query above should now return 0 rows.


-- ---------------------------------------------------------------------------
-- STEP 7: Unique index so a set can never be saved twice. The app should
-- upsert with onConflict: 'session_id,exercise_name,set_number'.
-- Only run this once Steps 5 and 6 verified clean.
-- ---------------------------------------------------------------------------
create unique index if not exists exercise_logs_session_exercise_set_uq
  on momapp.exercise_logs (session_id, exercise_name, set_number);


-- ---------------------------------------------------------------------------
-- STEP 8 (optional, after deploy): drop the backups once Block 01 is running
-- and you've confirmed everything looks right.
-- ---------------------------------------------------------------------------
-- drop table momapp.workout_sessions_bak_20261020;
-- drop table momapp.exercise_logs_bak_20261020;
