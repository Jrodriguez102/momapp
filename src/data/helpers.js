import { MUSCLE_GROUPS, VOLUME_THRESHOLDS, getWeekMeta, applyDeloadToSets, PROGRAM_DAYS, getProgramDayForWeekday } from './program'
import { supabase } from '../lib/supabase'

// ---- Personalization --------------------------------------------------------
export function getGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

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

// Day ids that count toward the 5-sessions-per-week block/deload
// progression. The optional day (Saturday active recovery) is deliberately
// excluded — it's a bonus, not part of the training week.
const REQUIRED_DAY_IDS = PROGRAM_DAYS.filter((d) => !d.optional).map((d) => d.id)

// Counts completed sessions (completed_at is set — an abandoned/in-progress
// session never got this far, so it can't accidentally trigger deload early).
// Only counts required days — completing the optional day never advances
// the block/week. Returns 0 if Supabase isn't configured yet (local/dev
// preview).
export async function getCompletedSessionCount() {
  try {
    const { count, error } = await supabase
      .from('workout_sessions')
      .select('*', { count: 'exact', head: true })
      .not('completed_at', 'is', null)
      .in('day_id', REQUIRED_DAY_IDS)
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

// ---- History tab --------------------------------------------------------------
// Every completed session, most recent first — a flat chronological record
// (no block/week grouping; that context already lives on the Home tab).
export async function getCompletedSessions() {
  try {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('id, day_id, completed_at, duration_seconds, effort')
      .eq('status', 'completed')
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

// One session's logged sets, grouped by exercise (in first-logged order),
// each sorted by set_number — feeds the History tab's expand-to-drill-down
// detail, mirroring groupLogsBySession's per-exercise sort but scoped to a
// single session instead of across all of them. `originalName` is set only
// when the logged exercise_name differs from the prescribed exercise (i.e.
// an alternative was swapped in), so the UI can call that out explicitly.
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
    const swappedName = sets[0].exercise_name
    const originalName = findExerciseById(exerciseId)?.name || exerciseId
    return {
      exerciseId,
      displayName: swappedName || originalName,
      originalName: swappedName ? originalName : null,
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

// ---- Weekly schedule (Home tab) ----------------------------------------------
// Monday-start week containing referenceDate, as 7 local-midnight Date objects.
function getWeekDates(referenceDate) {
  const start = new Date(referenceDate)
  start.setHours(0, 0, 0, 0)
  const day = start.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diffToMonday)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

// Completed sessions with a completed_at in [startDate, endDate). Returns []
// if Supabase isn't configured yet, same fallback pattern as the rest of
// this file.
async function getSessionsInRange(startDate, endDate) {
  try {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('day_id, completed_at')
      .not('completed_at', 'is', null)
      .gte('completed_at', startDate.toISOString())
      .lt('completed_at', endDate.toISOString())
    if (error) throw error
    return data || []
  } catch {
    return []
  }
}

function sameDay(a, b) {
  return a.toDateString() === b.toDateString()
}

// One entry per calendar day in the Mon-Sun week containing referenceDate:
// { date, programDay, status }. status is 'rest' (weekend, no programDay),
// 'completed', 'today', 'missed' (past scheduled day, nothing logged), or
// 'upcoming'. A programDay marked `optional` (Saturday active recovery)
// never shows as 'missed' — skipping it is expected, not a failure, so a
// past uncompleted optional day just reads 'upcoming' instead. Feeds both
// the Today card and the week strip so they always agree on what happened
// when.
export async function getWeekSchedule(referenceDate = new Date()) {
  const weekDates = getWeekDates(referenceDate)
  const rangeEnd = new Date(weekDates[6])
  rangeEnd.setDate(rangeEnd.getDate() + 1)
  const sessions = await getSessionsInRange(weekDates[0], rangeEnd)

  return weekDates.map((date) => {
    const programDay = getProgramDayForWeekday(date.getDay())
    const isToday = sameDay(date, referenceDate)
    const isPast = date < referenceDate && !isToday

    let status
    if (!programDay) status = 'rest'
    else if (sessions.some((s) => s.day_id === programDay.id && sameDay(new Date(s.completed_at), date))) status = 'completed'
    else if (isToday) status = 'today'
    else if (isPast) status = programDay.optional ? 'upcoming' : 'missed'
    else status = 'upcoming'

    return { date, programDay, status }
  })
}

// Next scheduled (non-rest) day strictly after referenceDate within the given
// schedule; wraps to next Monday/Day 1 if the week has nothing left (e.g.
// referenceDate is Friday or a weekend).
export function getNextScheduledDay(schedule, referenceDate = new Date()) {
  const todayIndex = schedule.findIndex((entry) => sameDay(entry.date, referenceDate))
  const rest = todayIndex === -1 ? schedule : schedule.slice(todayIndex + 1)
  const next = rest.find((entry) => entry.programDay)
  if (next) return next

  const nextMonday = new Date(referenceDate)
  nextMonday.setHours(0, 0, 0, 0)
  const daysUntilMonday = (8 - nextMonday.getDay()) % 7 || 7
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday)
  return { date: nextMonday, programDay: PROGRAM_DAYS[0], status: 'upcoming' }
}

// Non-cardio exercise count + ordered muscle groups covered, for the Today
// card's one-line summary. cardioDuration is set when the day is cardio-only
// (e.g. the optional Saturday day) so the card has something to show instead
// of "0 exercises".
export function getDaySummary(programDay) {
  const nonCardio = programDay.exercises.filter((ex) => !ex.isCardio)
  const musclesPresent = new Set(nonCardio.flatMap((ex) => ex.muscleGroups))
  const cardioExercise = programDay.exercises.find((ex) => ex.isCardio)
  return {
    exerciseCount: nonCardio.length,
    muscles: MUSCLE_GROUPS.filter((mg) => musclesPresent.has(mg)),
    hasCardio: !!cardioExercise,
    cardioDuration: nonCardio.length === 0 ? cardioExercise?.duration ?? null : null,
  }
}

// ---- Home tab stats -----------------------------------------------------------
export async function getWorkoutsThisMonth(referenceDate = new Date()) {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1)
  try {
    const { count, error } = await supabase
      .from('workout_sessions')
      .select('*', { count: 'exact', head: true })
      .not('completed_at', 'is', null)
      .gte('completed_at', start.toISOString())
      .lt('completed_at', end.toISOString())
    if (error) throw error
    return count || 0
  } catch {
    return 0
  }
}

// Consecutive scheduled training days hit, counting back from referenceDate.
// Rest days (weekends) don't break it; a scheduled day with nothing logged
// does, unless that day is referenceDate itself (still in progress, not a
// miss yet). The optional day (Saturday active recovery) is skipped
// entirely here — it neither extends the streak when done nor breaks it
// when skipped, same as a rest day. Returned as a workout count, not a day
// count.
export async function getCurrentStreak(referenceDate = new Date()) {
  const lookback = new Date(referenceDate)
  lookback.setDate(lookback.getDate() - 60)
  const rangeEnd = new Date(referenceDate)
  rangeEnd.setDate(rangeEnd.getDate() + 1)
  const sessions = await getSessionsInRange(lookback, rangeEnd)

  let streak = 0
  const cursor = new Date(referenceDate)
  cursor.setHours(0, 0, 0, 0)

  while (cursor >= lookback) {
    const programDay = getProgramDayForWeekday(cursor.getDay())
    if (programDay && !programDay.optional) {
      const hit = sessions.some((s) => s.day_id === programDay.id && sameDay(new Date(s.completed_at), cursor))
      if (hit) streak++
      else if (!sameDay(cursor, referenceDate)) break
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
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
// Groups an exercise's logged sets into one entry per workout session
// (session_id), sorted oldest-first. Each session keeps its full set list —
// the raw data stays available for drill-down even after deriving a
// headline number from it.
export function groupLogsBySession(exerciseLogs, exerciseId) {
  const matches = exerciseLogs.filter((log) => log.exercise_id === exerciseId && log.weight != null && log.reps != null)
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

// ---- Workout session lifecycle (resume / continue) -----------------------------
export const MAX_WORKOUT_DURATION_SECONDS = 2 * 60 * 60

// Most recent in-progress session for this specific day, if any — used on
// WorkoutSession mount to resume instead of silently starting a second
// session for the same day.
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
// min(now - started_at, 2h), computed from timestamps rather than a
// client-accumulated counter so it self-corrects after backgrounding.
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
