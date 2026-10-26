import { MUSCLE_GROUPS, PROGRAM_DAYS } from '../data/program'
import { rpeToDifficulty } from './sessionRules'

// ---- Lookups ------------------------------------------------------------------
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

// Exercise count + ordered muscle groups covered, for the Today card.
export function getDaySummary(programDay) {
  const musclesPresent = new Set(programDay.exercises.flatMap((ex) => ex.muscleGroups))
  return {
    exerciseCount: programDay.exercises.length,
    muscles: MUSCLE_GROUPS.filter((mg) => musclesPresent.has(mg)),
  }
}

// ---- Set input validation ------------------------------------------------------
// Same rules saveSet enforces, for enabling/disabling save buttons.
export function isValidReps(value) {
  const n = Number(value)
  return value !== '' && value != null && Number.isInteger(n) && n > 0
}

export function isValidWeight(value) {
  const n = Number(value)
  return value !== '' && value != null && Number.isFinite(n) && n >= 0
}

// ---- History grouping ---------------------------------------------------------
// One session's logged sets, grouped by exercise slot (in first-logged
// order), each sorted by set_number. `originalName` is set only when the
// logged exercise_name differs from the slot's prescribed exercise (a swap).
// `difficulty` is the last-set tap, read from whichever row carries rpe.
export function groupSessionLogsByExercise(logs) {
  const order = []
  const byExercise = new Map()
  for (const log of logs) {
    if (!byExercise.has(log.exercise_id)) {
      byExercise.set(log.exercise_id, [])
      order.push(log.exercise_id)
    }
    byExercise.get(log.exercise_id).push(log)
  }
  return order.map((exerciseId) => {
    const sets = [...byExercise.get(exerciseId)].sort((a, b) => a.set_number - b.set_number)
    const prescribedName = findExerciseById(exerciseId)?.name ?? null
    const loggedName = sets[0].exercise_name || prescribedName || exerciseId
    return {
      exerciseId,
      displayName: loggedName,
      originalName: prescribedName && loggedName !== prescribedName ? prescribedName : null,
      difficulty: rpeToDifficulty(sets.find((s) => s.rpe != null)?.rpe),
      sets,
    }
  })
}

// ---- Exercise progress (Progress tab) ------------------------------------------
// Groups an exercise's logged sets (by exercise_name — ids changed between
// the pilot and Block 01, names didn't) into one entry per workout session,
// sorted oldest-first. Each session keeps its full set list for drill-down.
export function groupLogsBySession(exerciseLogs, exerciseName) {
  const matches = exerciseLogs.filter((log) => log.exercise_name === exerciseName && log.weight != null && log.reps != null)
  const bySession = new Map()
  for (const log of matches) {
    if (!bySession.has(log.session_id)) bySession.set(log.session_id, [])
    bySession.get(log.session_id).push(log)
  }
  return [...bySession.values()]
    .map((sets) => ({
      sessionId: sets[0].session_id,
      date: sets[0].logged_at,
      sets: [...sets].sort((a, b) => a.set_number - b.set_number),
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
}

// The set that best represents a session's performance: heaviest weight,
// ties broken by more reps. Drives both the progression chart and the
// estimated-strength calculation.
export function getTopSet(sets) {
  return sets.reduce((best, set) => {
    if (!best) return set
    if (set.weight > best.weight) return set
    if (set.weight === best.weight && set.reps > best.reps) return set
    return best
  }, null)
}

// Epley formula — a standard, widely-used estimate that doesn't require an
// actual 1RM attempt. Intentionally approximate; always label it "estimated"
// in the UI, never "actual strength".
export function estimate1RM(weight, reps) {
  if (!weight || !reps) return null
  if (reps === 1) return Math.round(weight)
  return Math.round(weight * (1 + reps / 30))
}

export function getSetsVolume(sets) {
  return sets.reduce((sum, set) => sum + (set.weight || 0) * (set.reps || 0), 0)
}
