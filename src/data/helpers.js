import { MUSCLE_GROUPS, VOLUME_THRESHOLDS, getWeekMeta, applyDeloadToSets, PROGRAM_DAYS } from './program'
import { supabase } from '../lib/supabase'

// ---- Block / week math ------------------------------------------------------
// Session-count-based (not calendar-based): every 5 completed sessions is
// one training week (5-day split), 4 training weeks is one block, and week 4
// of each block is the deload. Missed weeks or uneven pacing don't shift
// anything — only actual completed sessions move the program forward.
const SESSIONS_PER_WEEK = 5
const WEEKS_PER_BLOCK = 4

export function getCurrentBlockAndWeek(completedSessionCount) {
  const count = Math.max(0, completedSessionCount || 0)
  const totalWeekNumber = Math.floor(count / SESSIONS_PER_WEEK) + 1
  const block = Math.ceil(totalWeekNumber / WEEKS_PER_BLOCK)
  const weekInBlock = ((totalWeekNumber - 1) % WEEKS_PER_BLOCK) + 1
  const sessionInWeek = (count % SESSIONS_PER_WEEK) + 1 // 1-indexed, which session of this week she's on
  return { block, weekInBlock, totalWeekNumber, sessionInWeek, completedSessionCount: count, ...getWeekMeta(weekInBlock) }
}

// Counts completed sessions (completed_at is set — an abandoned/in-progress
// session never got this far, so it can't accidentally trigger deload early).
// Returns 0 if Supabase isn't configured yet (local/dev preview).
export async function getCompletedSessionCount() {
  try {
    const { count, error } = await supabase
      .from('workout_sessions')
      .select('*', { count: 'exact', head: true })
      .not('completed_at', 'is', null)
    if (error) throw error
    return count || 0
  } catch {
    return 0
  }
}

// ---- Weekly volume tally -----------------------------------------------------
// Given the static program (sets prescribed per exercise) and the current
// week's deload status, tally prescribed weekly sets per muscle group.
// This is the "planned" volume the body diagram shows by default.
export function getPlannedWeeklyVolume(weekInBlock) {
  const tally = Object.fromEntries(MUSCLE_GROUPS.map((mg) => [mg, 0]))

  for (const day of PROGRAM_DAYS) {
    for (const ex of day.exercises) {
      if (ex.isCardio) continue
      const sets = applyDeloadToSets(ex.sets, weekInBlock)
      for (const mg of ex.muscleGroups) {
        if (tally[mg] !== undefined) tally[mg] += sets
      }
    }
  }
  return tally
}

// Given actual logged sets (from Supabase exercise_logs, joined to the
// exercise's muscle groups), tally real weekly volume. Use this once real
// session data exists; falls back to planned volume otherwise.
export function getActualWeeklyVolume(loggedSets) {
  // loggedSets: [{ exerciseId, muscleGroups: [...] }]
  const tally = Object.fromEntries(MUSCLE_GROUPS.map((mg) => [mg, 0]))
  for (const log of loggedSets) {
    for (const mg of log.muscleGroups) {
      if (tally[mg] !== undefined) tally[mg] += 1
    }
  }
  return tally
}

// ---- Volume -> status/color mapping ------------------------------------------
export function getVolumeStatus(setCount) {
  if (setCount < VOLUME_THRESHOLDS.low) return 'low'
  if (setCount > VOLUME_THRESHOLDS.high) return 'high'
  return 'optimal'
}

export const VOLUME_STATUS_COLORS = {
  low: 'var(--color-quad)',      // yellow-ish
  optimal: 'var(--color-back)',  // green-ish
  high: 'var(--color-glute)',    // red/accent
}

// ---- Exercise lookups ---------------------------------------------------------
export function findExerciseById(exerciseId) {
  for (const day of PROGRAM_DAYS) {
    const match = day.exercises.find((ex) => ex.id === exerciseId)
    if (match) return match
  }
  return null
}

export function findDayById(dayId) {
  return PROGRAM_DAYS.find((d) => d.id === dayId) || null
}

// "Last time you lifted X" — looks up the most recent logged set for an
// exercise from Supabase exercise_logs. Returns null for never-logged
// exercises (Week 1 self-calibration), which the UI simply leaves blank —
// no visible "calibration" flag, per design decision.
export function getLastLoggedSet(exerciseLogs, exerciseId) {
  const matches = exerciseLogs
    .filter((log) => log.exercise_id === exerciseId)
    .sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at))
  return matches[0] || null
}
