import { LAST_SET_DIFFICULTY_OPTIONS, SESSION_RPE_ANCHORS } from '../data/program'

// ---- Session lifecycle rules ----------------------------------------------------
// What "counts": only status='completed' sessions in CURRENT_BLOCK advance the
// queue, block/week, deload, streak and hold rule. 'partial' sessions keep
// their sets (progression still reads them) but don't count.
export const MIN_SETS_FOR_COMPLETED = 6
export const AUTO_CLOSE_IDLE_MS = 90 * 60 * 1000 // no set logged for 90 min
export const AUTO_CLOSE_MAX_MS = 120 * 60 * 1000 // 2h since the first set
export const MAX_WORKOUT_DURATION_SECONDS = AUTO_CLOSE_MAX_MS / 1000
export const HISTORY_EDIT_WINDOW_MS = 48 * 60 * 60 * 1000
export const HOLD_RULE = { minSessions: 3, days: 7 } // fewer -> no weight increases

export function getStatusForSetCount(setCount) {
  return setCount >= MIN_SETS_FOR_COMPLETED ? 'completed' : 'partial'
}

// Finish tap. >= 6 sets is always 'completed'; under that, countAsWorkout
// (her answer to "Only N sets logged — count this as a workout?") picks
// 'completed' vs 'partial'.
export function getFinishStatus(setCount, countAsWorkout) {
  return setCount >= MIN_SETS_FOR_COMPLETED || countAsWorkout ? 'completed' : 'partial'
}

// Saved duration is always first -> last logged set, never wall clock.
// times: set timestamps in ms.
export function getSetSpanSeconds(times) {
  return Math.round((Math.max(...times) - Math.min(...times)) / 1000)
}

// ---- Auto-close decision ----------------------------------------------------
// An in_progress session is closed if no set was logged for 90 min, or 2h
// have passed since its first activity. completed_at is the last set's time
// (not "now"), duration is first -> last set. A stale session with zero
// sets is deleted. Returns { action: 'keep' | 'delete' } or
// { action: 'close', patch } where patch is the workout_sessions update.
export function getAutoCloseDecision({ startedAt, setTimes, now }) {
  const started = new Date(startedAt).getTime()
  const firstActivity = Math.min(started, ...setTimes)
  const lastActivity = setTimes.length ? Math.max(...setTimes) : started
  const idle = now - lastActivity >= AUTO_CLOSE_IDLE_MS
  const overCap = now - firstActivity >= AUTO_CLOSE_MAX_MS
  if (!idle && !overCap) return { action: 'keep' }
  if (!setTimes.length) return { action: 'delete' }
  const firstSet = Math.min(...setTimes)
  return {
    action: 'close',
    patch: {
      status: getStatusForSetCount(setTimes.length),
      completed_at: new Date(lastActivity).toISOString(),
      duration_seconds: Math.round((lastActivity - firstSet) / 1000),
      closed_by: 'auto',
    },
  }
}

// ---- History edit window ----------------------------------------------------
// Finished sessions are editable from History for 48h after completed_at,
// then read-only.
export function isWithinEditWindow(session, now = new Date()) {
  if (!['completed', 'partial'].includes(session.status) || !session.completed_at) return false
  return now.getTime() - new Date(session.completed_at).getTime() < HISTORY_EDIT_WINDOW_MS
}

// ---- Difficulty / effort mapping --------------------------------------------
export function difficultyToRpe(value) {
  return LAST_SET_DIFFICULTY_OPTIONS.find((opt) => opt.value === value)?.rpe ?? null
}

export function rpeToDifficulty(rpe) {
  if (rpe == null) return null
  return LAST_SET_DIFFICULTY_OPTIONS.find((opt) => opt.rpe === Number(rpe))?.value ?? null
}

// Anchor label ('Easy' / 'Moderate' / 'Hard' / 'Max') for a 1-10 session_rpe.
export function getSessionRpeLabel(value) {
  return SESSION_RPE_ANCHORS.find((a) => value >= a.min && value <= a.max)?.label ?? null
}

// ---- Live timer -------------------------------------------------------------
// Elapsed time since startedAt, capped at MAX_WORKOUT_DURATION_SECONDS —
// display only (the saved duration is always first -> last set).
export function getElapsedSeconds(startedAt, now = new Date()) {
  const elapsed = Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000)
  return Math.max(0, Math.min(elapsed, MAX_WORKOUT_DURATION_SECONDS))
}
