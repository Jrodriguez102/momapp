// Fixture data for `npm run dev:fixture` and the History tests: a realistic
// Block 01 timeline relative to `now`, built from the real program.
// Dev/test only — nothing in the app imports this.
//
// Default timeline (block 1, completed unless noted; 9 completed -> session
// 10, week 3; 3 completed in the last 7 days so no weight hold):
//   22d Upper A · 20d Lower A · 18d Upper B · 16d Lower B
//   12d Upper A
//    9d Lower A  — Hack Squat Machine swapped to Goblet Squat
//    6d Upper B  — auto-closed (closed_by 'auto', no effort)
//    4d Lower B  — PARTIAL, 3 sets
//    3d Lower B  — completed, outside the 48h edit window
//   20h Upper A  — completed, inside the edit window (28h left)
//   40d pilot (block 0, day-6) with a legacy effort label
//   today: Lower A in progress (Hack Squat 4/4 done, Step-Up 1/3)
// Scenarios: 'default' | 'empty' (no data at all) | 'blockDone' (24 done).
import { PROGRAM_DAYS } from '@/data/program'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const SET_GAP = 3 * MINUTE

const dayById = (id) => PROGRAM_DAYS.find((d) => d.id === id)

function repsFor(exercise, offset = 0) {
  const [min, max] = exercise.repRange.match(/\d+/g).map(Number)
  return Math.max(min, max - 1 - offset)
}

// Logged sets for a session: every exercise's prescribed sets (or `limit`
// sets in total), 3 minutes apart, ending at `endAt`; the last set of each
// exercise carries the "1-2 left" difficulty (rpe 8.5).
function sessionLogs({ sessionId, dayId, endAt, weightBump = 0, limit = Infinity, swaps = {} }) {
  const plan = dayById(dayId).exercises.flatMap((ex) =>
    Array.from({ length: ex.sets }, (_, i) => ({ ex, setNumber: i + 1, last: i === ex.sets - 1 })),
  ).slice(0, limit)
  const start = endAt - (plan.length - 1) * SET_GAP
  return plan.map(({ ex, setNumber, last }, i) => ({
    id: `${sessionId}-${ex.id}-${setNumber}`,
    session_id: sessionId,
    exercise_id: ex.id,
    exercise_name: swaps[ex.id] ?? ex.name,
    set_number: setNumber,
    weight: ex.weight.startWeight + weightBump,
    weight_unit: ex.weight.unit,
    reps: repsFor(ex, setNumber - 1 > 1 ? 1 : 0),
    rpe: last || (limit !== Infinity && i === plan.length - 1) ? 8.5 : null,
    is_cardio: false,
    logged_at: new Date(start + i * SET_GAP).toISOString(),
  }))
}

function finishedSession({ id, dayId, block = 1, week, status = 'completed', closedBy = 'user', sessionRpe = null, effort = null, logs }) {
  const times = logs.map((l) => new Date(l.logged_at).getTime())
  const first = Math.min(...times)
  const last = Math.max(...times)
  return {
    id,
    day_id: dayId,
    block,
    week_in_block: week,
    status,
    started_at: new Date(first - 2 * MINUTE).toISOString(),
    completed_at: new Date(closedBy === 'auto' ? last : last + 2 * MINUTE).toISOString(),
    duration_seconds: Math.round((last - first) / 1000),
    session_rpe: sessionRpe,
    closed_by: closedBy,
    effort,
    created_at: new Date(first - 2 * MINUTE).toISOString(),
  }
}

export function buildFixtureDb({ now = Date.now(), scenario = 'default' } = {}) {
  if (scenario === 'empty') return { workout_sessions: [], exercise_logs: [], body_weight_logs: [] }

  const plan = [
    { id: 'fx-22d', dayId: 'day-1', at: 22 * DAY, week: 1, sessionRpe: 6 },
    { id: 'fx-20d', dayId: 'day-2', at: 20 * DAY, week: 1, sessionRpe: 7 },
    { id: 'fx-18d', dayId: 'day-3', at: 18 * DAY, week: 1, sessionRpe: 6 },
    { id: 'fx-16d', dayId: 'day-4', at: 16 * DAY, week: 1, sessionRpe: 7 },
    { id: 'fx-12d', dayId: 'day-1', at: 12 * DAY, week: 2, sessionRpe: 7, bump: 0 },
    { id: 'fx-swap', dayId: 'day-2', at: 9 * DAY, week: 2, sessionRpe: 6, swaps: { 'hack-squat-machine': 'Goblet Squat' } },
    { id: 'fx-auto', dayId: 'day-3', at: 6 * DAY, week: 2, closedBy: 'auto', limit: 6 },
    { id: 'fx-partial', dayId: 'day-4', at: 4 * DAY, week: 3, status: 'partial', limit: 3 },
    { id: 'fx-old', dayId: 'day-4', at: 3 * DAY, week: 3, sessionRpe: 8, bump: 5 },
    { id: 'fx-recent', dayId: 'day-1', at: 20 * HOUR, week: 3, sessionRpe: 7, bump: 5 },
  ]

  const sessions = []
  const logs = []
  for (const p of plan) {
    const sessionLogsList = sessionLogs({ sessionId: p.id, dayId: p.dayId, endAt: now - p.at, weightBump: p.bump ?? 0, limit: p.limit, swaps: p.swaps })
    logs.push(...sessionLogsList)
    sessions.push(
      finishedSession({ id: p.id, dayId: p.dayId, week: p.week, status: p.status, closedBy: p.closedBy, sessionRpe: p.sessionRpe ?? null, logs: sessionLogsList }),
    )
  }

  // Pilot-era session (block 0, old 5-day program id, legacy effort label).
  const pilotLogs = [
    { id: 'fx-pilot-1', session_id: 'fx-pilot', exercise_id: 'kb-sumo-deadlift-2', exercise_name: 'KB Sumo Deadlift', set_number: 1, weight: 35, weight_unit: 'lb', reps: 12, rpe: null, is_cardio: false, logged_at: new Date(now - 40 * DAY - 6 * MINUTE).toISOString() },
    { id: 'fx-pilot-2', session_id: 'fx-pilot', exercise_id: 'kb-sumo-deadlift-2', exercise_name: 'KB Sumo Deadlift', set_number: 2, weight: 35, weight_unit: 'lb', reps: 12, rpe: null, is_cardio: false, logged_at: new Date(now - 40 * DAY - 3 * MINUTE).toISOString() },
  ]
  logs.push(...pilotLogs)
  sessions.push(finishedSession({ id: 'fx-pilot', dayId: 'day-6', block: 0, week: 2, effort: 'hard', logs: pilotLogs }))

  if (scenario === 'blockDone') {
    // 15 more completed Block 01 sessions -> 24, and nothing in progress.
    for (let i = 0; i < 15; i++) {
      const dayId = PROGRAM_DAYS[(i + 1) % 4].id
      const sessionLogsList = sessionLogs({ sessionId: `fx-more-${i}`, dayId, endAt: now - (i + 1) * HOUR * 2, limit: 6 })
      logs.push(...sessionLogsList)
      sessions.push(finishedSession({ id: `fx-more-${i}`, dayId, week: 6, logs: sessionLogsList }))
    }
  } else {
    // Today: Lower A in progress, started 24 minutes ago.
    const live = sessionLogs({ sessionId: 'fx-live', dayId: 'day-2', endAt: now - 3 * MINUTE, weightBump: 10, limit: 5 })
    logs.push(...live)
    sessions.push({
      id: 'fx-live',
      day_id: 'day-2',
      block: 1,
      week_in_block: 3,
      status: 'in_progress',
      started_at: new Date(now - 24 * MINUTE).toISOString(),
      completed_at: null,
      duration_seconds: null,
      session_rpe: null,
      closed_by: null,
      effort: null,
      created_at: new Date(now - 24 * MINUTE).toISOString(),
    })
  }

  return {
    workout_sessions: sessions,
    exercise_logs: logs,
    body_weight_logs: [
      { id: 'fx-bw-1', weight: 154.2, weight_unit: 'lb', logged_at: new Date(now - 30 * DAY).toISOString() },
      { id: 'fx-bw-2', weight: 153.6, weight_unit: 'lb', logged_at: new Date(now - 16 * DAY).toISOString() },
      { id: 'fx-bw-3', weight: 152.4, weight_unit: 'lb', logged_at: new Date(now - 9 * DAY).toISOString() },
    ],
  }
}
