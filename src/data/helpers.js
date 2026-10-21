import {
  MUSCLE_GROUPS,
  getVolumeThresholds,
  getWeekMeta,
  applyDeloadToSets,
  PROGRAM_DAYS,
  PLANNED_WEEKDAYS,
  CURRENT_BLOCK,
  SESSIONS_PER_WEEK,
  WEEKS_PER_BLOCK,
  SESSIONS_PER_BLOCK,
  LAST_SET_DIFFICULTY_OPTIONS,
  SESSION_RPE_ANCHORS,
} from './program'
import { supabase } from '../lib/supabase'

// ---- Personalization --------------------------------------------------------
export function getGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

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

// ---- Block / week math ------------------------------------------------------
// Session-count-based (not calendar-based): every 4 completed sessions is one
// training week, 24 is one block (weeks 1-5 progressive, week 6 deload).
// Describes the session she's about to do — so 0 completed is session 1,
// week 1. Once the block is done (24 completed) isBlockComplete is set and
// nothing new should start.
export function getCurrentBlockAndWeek(completedInBlock) {
  const count = Math.max(0, completedInBlock || 0)
  const isBlockComplete = count >= SESSIONS_PER_BLOCK
  const sessionNumber = Math.min(count + 1, SESSIONS_PER_BLOCK)
  const weekInBlock = Math.min(WEEKS_PER_BLOCK, Math.ceil(sessionNumber / SESSIONS_PER_WEEK))
  const sessionInWeek = ((sessionNumber - 1) % SESSIONS_PER_WEEK) + 1
  return {
    block: CURRENT_BLOCK,
    weekInBlock,
    sessionNumber,
    sessionInWeek,
    completedSessionCount: count,
    isBlockComplete,
    ...getWeekMeta(weekInBlock),
  }
}

// Completed sessions in the current block. Returns 0 if Supabase isn't
// reachable (local/dev preview).
export async function getCompletedSessionCount() {
  try {
    const { count, error } = await supabase
      .from('workout_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('block', CURRENT_BLOCK)
      .eq('status', 'completed')
    if (error) throw error
    return count || 0
  } catch {
    return 0
  }
}

// ---- Queue ------------------------------------------------------------------
// Days run in PROGRAM_DAYS order and wrap. What's next is always the day
// after the most recent *completed* session in this block — a partial
// session leaves the same day next, and a missed calendar day never skips
// content.
export function getNextQueueDay(lastCompletedDayId) {
  const index = PROGRAM_DAYS.findIndex((d) => d.id === lastCompletedDayId)
  return PROGRAM_DAYS[(index + 1) % PROGRAM_DAYS.length]
}

// Block/week + queue position in one query (at most 24 rows). Callers should
// await afterAutoClose() first so a forgotten session is counted correctly.
export async function getBlockState() {
  let sessions = []
  try {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('id, day_id, completed_at')
      .eq('block', CURRENT_BLOCK)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
    if (error) throw error
    sessions = data || []
  } catch {
    // Supabase not reachable — behave like a fresh block.
  }
  const lastCompletedDayId = sessions[0]?.day_id ?? null
  return {
    ...getCurrentBlockAndWeek(sessions.length),
    lastCompletedDayId,
    nextDay: getNextQueueDay(lastCompletedDayId),
  }
}

// ---- Auto-close (forgotten sessions) ----------------------------------------
// The app can't run timers while closed, so App.jsx runs this on open and
// whenever the app returns to the foreground. An in_progress session is
// closed if no set was logged for 90 min, or 2h have passed since its first
// set. completed_at is the last set's time (not "now"), duration is first ->
// last set, session_rpe stays null. Every write is guarded on
// status='in_progress', so re-running (or racing a Finish tap) is harmless.
// A stale session with zero sets is deleted — zero-set sessions never stay.
export const SESSIONS_AUTO_CLOSED_EVENT = 'momapp:sessions-auto-closed'

async function closeStaleSessions(now = new Date()) {
  const { data: open, error } = await supabase
    .from('workout_sessions')
    .select('id, started_at')
    .eq('status', 'in_progress')
  if (error) throw error
  if (!open?.length) return []

  const { data: logs, error: logsError } = await supabase
    .from('exercise_logs')
    .select('session_id, logged_at')
    .in('session_id', open.map((s) => s.id))
  if (logsError) throw logsError

  const closedIds = []
  for (const session of open) {
    const setTimes = logs.filter((l) => l.session_id === session.id).map((l) => new Date(l.logged_at).getTime())
    const startedAt = new Date(session.started_at).getTime()
    const firstActivity = Math.min(startedAt, ...setTimes)
    const lastActivity = setTimes.length ? Math.max(...setTimes) : startedAt
    const idle = now.getTime() - lastActivity >= AUTO_CLOSE_IDLE_MS
    const overCap = now.getTime() - firstActivity >= AUTO_CLOSE_MAX_MS
    if (!idle && !overCap) continue

    let result
    if (!setTimes.length) {
      result = await supabase.from('workout_sessions').delete().eq('id', session.id).eq('status', 'in_progress')
    } else {
      const firstSet = Math.min(...setTimes)
      result = await supabase
        .from('workout_sessions')
        .update({
          status: getStatusForSetCount(setTimes.length),
          completed_at: new Date(lastActivity).toISOString(),
          duration_seconds: Math.round((lastActivity - firstSet) / 1000),
          closed_by: 'auto',
        })
        .eq('id', session.id)
        .eq('status', 'in_progress')
    }
    if (result.error) throw result.error
    closedIds.push(session.id)
  }

  if (closedIds.length && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSIONS_AUTO_CLOSED_EVENT, { detail: { sessionIds: closedIds } }))
  }
  return closedIds
}

let autoCloseInFlight = null
let lastAutoCloseRun = null

// Triggers a check (or joins the one already running). Resolves to the ids
// of sessions it closed; never rejects.
export function runAutoClose() {
  if (autoCloseInFlight) return autoCloseInFlight
  autoCloseInFlight = closeStaleSessions()
    .catch((err) => {
      console.error('Auto-close check failed:', err)
      return []
    })
    .finally(() => {
      autoCloseInFlight = null
    })
  lastAutoCloseRun = autoCloseInFlight
  return autoCloseInFlight
}

// Await before computing anything that depends on session counts / queue
// position. Child effects run before App's, so this starts the first check
// itself if App hasn't yet.
export function afterAutoClose() {
  return autoCloseInFlight || lastAutoCloseRun || runAutoClose()
}

// ---- Workout session writes ---------------------------------------------------
// No workout_sessions row exists until the first set is saved. Only one
// in_progress session per day: an existing one is resumed, never duplicated.
export async function createSession(dayId, weekInBlock) {
  const existing = await findInProgressSession(dayId)
  if (existing) return existing
  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({ day_id: dayId, block: CURRENT_BLOCK, week_in_block: weekInBlock, status: 'in_progress' })
    .select()
    .single()
  if (error) throw error
  return data
}

// Idempotent set save: one row per (session_id, exercise_name, set_number).
// Re-saving the same set updates it in place. logged_at is never sent, so an
// edit keeps the original time (and doesn't count as activity for
// auto-close). exercise_name is always the name of what she actually did.
export async function saveSet({ sessionId, exerciseId, exerciseName, setNumber, weight, reps, weightUnit = 'lb' }) {
  const repsNum = Number(reps)
  if (!Number.isInteger(repsNum) || repsNum <= 0) throw new Error('Reps must be a whole number above 0')
  if (!exerciseName) throw new Error('exercise_name is required')
  const weightNum = weight === '' || weight == null ? null : Number(weight)
  if (weightNum != null && !Number.isFinite(weightNum)) throw new Error('Weight must be a number')

  const { data, error } = await supabase
    .from('exercise_logs')
    .upsert(
      {
        session_id: sessionId,
        exercise_id: exerciseId,
        exercise_name: exerciseName,
        set_number: setNumber,
        weight: weightNum,
        weight_unit: weightUnit,
        reps: repsNum,
      },
      { onConflict: 'session_id,exercise_name,set_number' },
    )
    .select()
    .single()
  if (error) throw error
  return data
}

// Last-set difficulty: exactly one row per exercise (per session) carries
// rpe — the one with the highest logged set_number. Pass rpe to set it (null
// clears it); pass undefined to keep the current value and just move it onto
// the highest set (call after logging a higher set). Returns the rpe now in
// effect.
export async function syncExerciseRpe(sessionId, exerciseId, rpe) {
  const { data: rows, error } = await supabase
    .from('exercise_logs')
    .select('id, set_number, rpe')
    .eq('session_id', sessionId)
    .eq('exercise_id', exerciseId)
  if (error) throw error
  if (!rows?.length) return null

  const value = rpe === undefined ? (rows.find((r) => r.rpe != null)?.rpe ?? null) : rpe
  const target = rows.reduce((best, r) => (r.set_number > best.set_number ? r : best))
  const staleIds = rows.filter((r) => r.id !== target.id && r.rpe != null).map((r) => r.id)

  if (staleIds.length) {
    const { error: clearError } = await supabase.from('exercise_logs').update({ rpe: null }).in('id', staleIds)
    if (clearError) throw clearError
  }
  if (target.rpe !== value) {
    const { error: setError } = await supabase.from('exercise_logs').update({ rpe: value }).eq('id', target.id)
    if (setError) throw setError
  }
  return value
}

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

// Swapping an exercise after some of its sets are logged renames those rows
// too, so a slot's sets always carry one name. (No two slots in a day share
// a name, so this can't collide on the unique index.)
export async function renameExerciseInSession(sessionId, exerciseId, exerciseName) {
  const { error } = await supabase
    .from('exercise_logs')
    .update({ exercise_name: exerciseName })
    .eq('session_id', sessionId)
    .eq('exercise_id', exerciseId)
  if (error) throw error
}

// Deletes one logged set and, if it carried the last-set difficulty, moves
// that onto the exercise's new highest set. Returns how many sets the
// session has left.
async function deleteSet(logRow) {
  const { error } = await supabase.from('exercise_logs').delete().eq('id', logRow.id)
  if (error) throw error
  if (logRow.rpe != null) await syncExerciseRpe(logRow.session_id, logRow.exercise_id, logRow.rpe)
  const { count, error: countError } = await supabase
    .from('exercise_logs')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', logRow.session_id)
  if (countError) throw countError
  return count || 0
}

// Mid-workout removal: removing the session's last set deletes the session
// row too (no zero-set sessions).
export async function removeLiveSet(logRow) {
  const remaining = await deleteSet(logRow)
  if (remaining === 0) {
    const { error } = await supabase
      .from('workout_sessions')
      .delete()
      .eq('id', logRow.session_id)
      .eq('status', 'in_progress')
    if (error) throw error
  }
  return { remaining, sessionDeleted: remaining === 0 }
}

// History removal (within the 48h window): removing every set marks the
// session partial — the one case a History edit touches status.
export async function removeHistorySet(logRow) {
  const remaining = await deleteSet(logRow)
  if (remaining === 0) {
    const { error } = await supabase.from('workout_sessions').update({ status: 'partial' }).eq('id', logRow.session_id)
    if (error) throw error
  }
  return { remaining }
}

// Finish tap. >= 6 sets is always 'completed'; under that, countAsWorkout
// (her answer to "Only N sets logged — count this as a workout?") picks
// 'completed' vs 'partial'. Duration is first -> last set, never wall clock.
// Returns the updated row, or null if the session was no longer in progress
// (e.g. auto-closed in the background) — nothing is written in that case.
export async function finishSession(sessionId, { sessionRpe = null, countAsWorkout = false } = {}) {
  const { data: logs, error: logsError } = await supabase
    .from('exercise_logs')
    .select('logged_at')
    .eq('session_id', sessionId)
  if (logsError) throw logsError
  if (!logs?.length) throw new Error('Cannot finish a session with no sets')

  const times = logs.map((l) => new Date(l.logged_at).getTime())
  const status = logs.length >= MIN_SETS_FOR_COMPLETED || countAsWorkout ? 'completed' : 'partial'
  const { data, error } = await supabase
    .from('workout_sessions')
    .update({
      status,
      completed_at: new Date().toISOString(),
      duration_seconds: Math.round((Math.max(...times) - Math.min(...times)) / 1000),
      closed_by: 'user',
      session_rpe: sessionRpe,
    })
    .eq('id', sessionId)
    .eq('status', 'in_progress')
    .select()
  if (error) throw error
  return data?.[0] ?? null
}

// History edit of session effort. Only ever touches session_rpe.
export async function updateSessionRpe(sessionId, sessionRpe) {
  const { error } = await supabase.from('workout_sessions').update({ session_rpe: sessionRpe }).eq('id', sessionId)
  if (error) throw error
}

// Finished sessions are editable from History for 48h after completed_at,
// then read-only.
export function isWithinEditWindow(session, now = new Date()) {
  if (!['completed', 'partial'].includes(session.status) || !session.completed_at) return false
  return now.getTime() - new Date(session.completed_at).getTime() < HISTORY_EDIT_WINDOW_MS
}

// ---- Progression suggestions ---------------------------------------------------
// Suggestions only — she can always override. Reads block >= 1 sets only
// (pilot block 0 reps were pre-filled and can't be trusted), from both
// completed and partial sessions, tracked per exercise_name.
export function parseRepRange(repRange) {
  const match = /(\d+)\s*-\s*(\d+)/.exec(repRange || '')
  return match ? { min: Number(match[1]), max: Number(match[2]) } : null
}

export async function getProgressionLogs(exerciseNames) {
  if (!exerciseNames.length) return []
  try {
    const { data, error } = await supabase
      .from('exercise_logs')
      .select('session_id, exercise_id, exercise_name, set_number, weight, reps, rpe, logged_at, workout_sessions!inner(block, status)')
      .in('exercise_name', exerciseNames)
      .gt('workout_sessions.block', 0)
      .in('workout_sessions.status', ['completed', 'partial'])
    if (error) throw error
    return data || []
  } catch {
    return []
  }
}

// Completed sessions (any block) in the last HOLD_RULE.days days.
export async function getRecentCompletedSessionCount(now = new Date()) {
  const since = new Date(now.getTime() - HOLD_RULE.days * 24 * 60 * 60 * 1000)
  try {
    const { count, error } = await supabase
      .from('workout_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', since.toISOString())
    if (error) throw error
    return count || 0
  } catch {
    return 0
  }
}

// One entry per session for this exercise name, newest first:
// { sessionId, date, sets (by set_number), workingWeight, rpe }.
function groupProgressionSessions(logs, exerciseName) {
  const bySession = new Map()
  for (const log of logs) {
    if (log.exercise_name !== exerciseName || log.reps == null) continue
    if (!bySession.has(log.session_id)) bySession.set(log.session_id, [])
    bySession.get(log.session_id).push(log)
  }
  return [...bySession.values()]
    .map((sets) => {
      const sorted = [...sets].sort((a, b) => a.set_number - b.set_number)
      return {
        sessionId: sorted[0].session_id,
        date: sorted.reduce((latest, s) => (s.logged_at > latest ? s.logged_at : latest), sorted[0].logged_at),
        sets: sorted,
        workingWeight: Math.max(...sorted.map((s) => Number(s.weight) || 0)) || null,
        rpe: sorted.find((s) => s.rpe != null)?.rpe ?? null,
      }
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
}

function roundWeight(w) {
  return Math.round(w * 100) / 100
}

// Double progression for one exercise slot, given the name she's doing today
// (the base exercise or a swapped-in alternative). Returns:
//   prefillWeight — the weight input's starting value: the suggested target
//                   on increase/decrease days, otherwise the last logged
//                   block >= 1 weight for this name, else the base
//                   exercise's startWeight (alternatives: blank)
//   lastWeight    — last logged block >= 1 working weight for this name
//   targetWeight  — today's suggested weight, or null for none
//   targetReps    — rep number to aim for, or null
//   action        — 'start' | 'calibrate' | 'deload' | 'increase' | 'hold' |
//                   'repeat-once' | 'decrease' | 'more-reps'
//   goalWeight    — block goal (base exercise only)
// Rules, against her last session of this name:
//   all sets at top of range, last set not "0 left" -> +increment, reps back to bottom
//   all sets at top, "0 left"                       -> repeat once (if the previous
//                                                      session was already that repeat, increase)
//   > half the sets below bottom in each of the last
//   2 sessions at the same weight                   -> -increment
//   otherwise                                       -> same weight, more reps
// Hold rule: < 3 completed sessions in 7 days -> no increases.
// Calibration: confidence 'low' with < 2 sessions logged -> no target.
// Deload week: target = last working weight, no suggestions.
export function getExerciseSuggestion(args) {
  const suggestion = getRawSuggestion(args)
  const changesWeight = suggestion.action === 'increase' || suggestion.action === 'decrease'
  return changesWeight ? { ...suggestion, prefillWeight: suggestion.targetWeight } : suggestion
}

function getRawSuggestion({ exercise, activeName, logs, weekMeta, recentCompletedCount }) {
  const isBase = activeName === exercise.name
  const range = parseRepRange(exercise.repRange)
  const { startWeight, goalWeight, increment, confidence, unit } = exercise.weight
  const sessions = groupProgressionSessions(logs, activeName)
  const last = sessions[0]
  const lastWeight = last?.workingWeight ?? null

  const base = {
    prefillWeight: lastWeight ?? (isBase ? startWeight : null),
    lastWeight,
    goalWeight: isBase ? goalWeight : null,
    unit,
    repMin: range?.min ?? null,
    repMax: range?.max ?? null,
  }

  if (weekMeta.weekType === 'deload') return { ...base, action: 'deload', targetWeight: lastWeight, targetReps: null }
  if (confidence === 'low' && sessions.length < 2) return { ...base, action: 'calibrate', targetWeight: null, targetReps: null }
  if (!last || lastWeight == null || !range) {
    return { ...base, action: 'start', targetWeight: isBase ? startWeight : null, targetReps: range?.min ?? null }
  }

  const allAtTop = (s) => s.sets.every((set) => set.reps >= range.max)
  const missedBottom = (s) => s.sets.filter((set) => set.reps < range.min).length > s.sets.length / 2
  const holdIncreases = recentCompletedCount < HOLD_RULE.minSessions
  const increase = () =>
    holdIncreases
      ? { ...base, action: 'hold', targetWeight: lastWeight, targetReps: range.max }
      : { ...base, action: 'increase', targetWeight: roundWeight(lastWeight + increment), targetReps: range.min }

  if (allAtTop(last)) {
    if (Number(last.rpe) !== 10) return increase()
    const prev = sessions[1]
    const alreadyRepeated = prev && prev.workingWeight === lastWeight && allAtTop(prev) && Number(prev.rpe) === 10
    if (alreadyRepeated) return increase()
    return { ...base, action: 'repeat-once', targetWeight: lastWeight, targetReps: range.max }
  }

  const prev = sessions[1]
  if (prev && prev.workingWeight === lastWeight && missedBottom(last) && missedBottom(prev)) {
    return { ...base, action: 'decrease', targetWeight: roundWeight(Math.max(increment, lastWeight - increment)), targetReps: range.min }
  }

  const bestReps = Math.max(...last.sets.map((s) => s.reps))
  return { ...base, action: 'more-reps', targetWeight: lastWeight, targetReps: Math.min(range.max, Math.max(range.min, bestReps + 1)) }
}

// ---- Weekly volume tally -----------------------------------------------------
// Prescribed weekly sets per muscle group for the given week (deload-aware).
export function getPlannedWeeklyVolume(weekInBlock) {
  const tally = Object.fromEntries(MUSCLE_GROUPS.map((mg) => [mg, 0]))
  for (const day of PROGRAM_DAYS) {
    for (const ex of day.exercises) {
      const sets = applyDeloadToSets(ex.sets, weekInBlock)
      for (const mg of ex.muscleGroups) {
        if (tally[mg] !== undefined) tally[mg] += sets
      }
    }
  }
  return tally
}

// Given actual logged sets (joined to the exercise's muscle groups), tally
// real weekly volume.
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
export function getVolumeStatus(setCount, muscleGroup) {
  const { low, high } = getVolumeThresholds(muscleGroup)
  if (setCount < low) return 'low'
  if (setCount > high) return 'high'
  return 'optimal'
}

export const VOLUME_STATUS_COLORS = {
  low: 'var(--color-quad)',      // yellow-ish
  optimal: 'var(--color-back)',  // green-ish
  high: 'var(--color-glute)',    // red/accent
}

// ---- History tab --------------------------------------------------------------
// Every finished (completed or partial) session, most recent first — a flat
// chronological record. Includes pilot (block 0) sessions.
export async function getFinishedSessions() {
  try {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('id, day_id, block, status, completed_at, duration_seconds, effort, session_rpe, closed_by')
      .in('status', ['completed', 'partial'])
      .order('completed_at', { ascending: false })
    if (error) throw error
    return data || []
  } catch {
    return []
  }
}

// All logged sets across a batch of sessions in one query — used to compute
// each History row's sets/volume summary up front, instead of an N+1 fetch
// per session.
export async function getExerciseLogsForSessions(sessionIds) {
  if (!sessionIds.length) return []
  try {
    const { data, error } = await supabase
      .from('exercise_logs')
      .select('*')
      .in('session_id', sessionIds)
    if (error) throw error
    return data || []
  } catch {
    return []
  }
}

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

// ---- Calendar helpers -----------------------------------------------------------
// Monday-start week containing referenceDate, as 7 local-midnight Date objects.
function getWeekDates(referenceDate) {
  const start = getWeekStart(referenceDate)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function getWeekStart(date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const day = start.getDay()
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day))
  return start
}

function sameDay(a, b) {
  return a.toDateString() === b.toDateString()
}

// Completed sessions (any block) with completed_at in [startDate, endDate).
// Partial sessions never show as trained days.
async function getSessionsInRange(startDate, endDate) {
  try {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('day_id, completed_at')
      .eq('status', 'completed')
      .gte('completed_at', startDate.toISOString())
      .lt('completed_at', endDate.toISOString())
    if (error) throw error
    return data || []
  } catch {
    return []
  }
}

// ---- Home tab: week strip / stats -------------------------------------------------
// Mon-Sun week containing referenceDate. Each day:
// { date, isToday, isPlanned, completedDayIds, status } where status is
// 'completed' (trained that day — planned weekday or not), 'missed' (past
// planned weekday, nothing completed), 'planned' (today or later planned
// weekday) or 'rest'. Display only — the queue decides what's next.
export async function getTrainingWeek(referenceDate = new Date()) {
  const weekDates = getWeekDates(referenceDate)
  const rangeEnd = new Date(weekDates[6])
  rangeEnd.setDate(rangeEnd.getDate() + 1)
  const sessions = await getSessionsInRange(weekDates[0], rangeEnd)

  const days = weekDates.map((date) => {
    const isToday = sameDay(date, referenceDate)
    const isPlanned = PLANNED_WEEKDAYS.includes(date.getDay())
    const completedDayIds = sessions.filter((s) => sameDay(new Date(s.completed_at), date)).map((s) => s.day_id)
    let status
    if (completedDayIds.length) status = 'completed'
    else if (!isPlanned) status = 'rest'
    else if (date < referenceDate && !isToday) status = 'missed'
    else status = 'planned'
    return { date, isToday, isPlanned, completedDayIds, status }
  })
  return { days, completedCount: sessions.length, plannedCount: PLANNED_WEEKDAYS.length }
}

// Consecutive Mon-Sun weeks with >= 3 completed sessions, counting back from
// last week. The current week adds 1 once it reaches 3, but an unfinished
// current week never breaks the streak.
export async function getWeeklyStreak(referenceDate = new Date()) {
  const lookback = getWeekStart(referenceDate)
  lookback.setDate(lookback.getDate() - 52 * 7)
  const rangeEnd = new Date(referenceDate)
  rangeEnd.setDate(rangeEnd.getDate() + 1)
  const sessions = await getSessionsInRange(lookback, rangeEnd)

  const perWeek = new Map()
  for (const s of sessions) {
    const key = getWeekStart(new Date(s.completed_at)).getTime()
    perWeek.set(key, (perWeek.get(key) || 0) + 1)
  }

  const cursor = getWeekStart(referenceDate)
  let streak = (perWeek.get(cursor.getTime()) || 0) >= HOLD_RULE.minSessions ? 1 : 0
  cursor.setDate(cursor.getDate() - 7)
  while (cursor >= lookback && (perWeek.get(cursor.getTime()) || 0) >= HOLD_RULE.minSessions) {
    streak++
    cursor.setDate(cursor.getDate() - 7)
  }
  return streak
}

export async function getWorkoutsThisMonth(referenceDate = new Date()) {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1)
  try {
    const { count, error } = await supabase
      .from('workout_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', start.toISOString())
      .lt('completed_at', end.toISOString())
    if (error) throw error
    return count || 0
  } catch {
    return 0
  }
}

// Exercise count + ordered muscle groups covered, for the Today card.
export function getDaySummary(programDay) {
  const musclesPresent = new Set(programDay.exercises.flatMap((ex) => ex.muscleGroups))
  return {
    exerciseCount: programDay.exercises.length,
    muscles: MUSCLE_GROUPS.filter((mg) => musclesPresent.has(mg)),
  }
}

// ---- Weekly weigh-in ------------------------------------------------------------
// True when there's no body_weight_logs entry in the last 7 days. False if
// Supabase isn't reachable (don't nag on a failed read).
export async function needsWeighIn(now = new Date()) {
  try {
    const { data, error } = await supabase
      .from('body_weight_logs')
      .select('logged_at')
      .order('logged_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (!data) return true
    return now.getTime() - new Date(data.logged_at).getTime() >= 7 * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

// ---- Body weight (Progress tab) -----------------------------------------------
export async function getBodyWeightLogs() {
  try {
    const { data, error } = await supabase
      .from('body_weight_logs')
      .select('*')
      .order('logged_at', { ascending: true })
    if (error) throw error
    return data || []
  } catch {
    return []
  }
}

export async function logBodyWeight(weight, loggedAt = new Date()) {
  const { error } = await supabase
    .from('body_weight_logs')
    .insert({ weight, logged_at: loggedAt.toISOString() })
  if (error) throw error
}

const TIMEFRAME_MONTHS = { '1m': 1, '3m': 3, '6m': 6 }

// timeframe: '1m' | '3m' | '6m' | 'all'. Filters by `logged_at` unless a
// different field name is passed.
export function filterByTimeframe(entries, timeframe, dateKey = 'logged_at') {
  const months = TIMEFRAME_MONTHS[timeframe]
  if (!months) return entries
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - months)
  return entries.filter((entry) => new Date(entry[dateKey]) >= cutoff)
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

// ---- Workout session lookups (resume / continue) --------------------------------
// Most recent in-progress session for this specific day, if any — used on
// WorkoutSession mount to resume instead of starting a second session.
export async function findInProgressSession(dayId) {
  try {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('day_id', dayId)
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data || null
  } catch {
    return null
  }
}

// Any in-progress session, regardless of day — drives the Home tab's
// "Continue Workout" card (only one workout happens at a time).
export async function getAnyInProgressSession() {
  try {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data || null
  } catch {
    return null
  }
}

export async function getSessionExerciseLogs(sessionId) {
  try {
    const { data, error } = await supabase
      .from('exercise_logs')
      .select('*')
      .eq('session_id', sessionId)
    if (error) throw error
    return data || []
  } catch {
    return []
  }
}

// Elapsed time since startedAt, capped at MAX_WORKOUT_DURATION_SECONDS —
// display only (the saved duration is always first -> last set).
export function getElapsedSeconds(startedAt, now = new Date()) {
  const elapsed = Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000)
  return Math.max(0, Math.min(elapsed, MAX_WORKOUT_DURATION_SECONDS))
}

export function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}
