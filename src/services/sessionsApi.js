// workout_sessions reads and writes. The only Supabase access for sessions —
// reads throw on error (callers decide the fallback); writes are the frozen
// Block 01 data contract.
import { supabase } from '../lib/supabase'
import { CURRENT_BLOCK } from '../data/program'
import { buildBlockState } from '../domain/block'
import { buildTrainingWeek, countWeeklyStreak, getMonthRange, getStreakRange, getWeekRange } from '../domain/calendar'
import { HOLD_RULE, getFinishStatus, getSetSpanSeconds } from '../domain/sessionRules'

// ---- Reads ------------------------------------------------------------------
// Completed sessions in the current block.
export async function fetchCompletedSessionCount() {
  const { count, error } = await supabase
    .from('workout_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('block', CURRENT_BLOCK)
    .eq('status', 'completed')
  if (error) throw error
  return count || 0
}

// Block/week + queue position in one query (at most 24 rows). Callers should
// await afterAutoClose() first so a forgotten session is counted correctly.
export async function fetchBlockState() {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, day_id, completed_at')
    .eq('block', CURRENT_BLOCK)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
  if (error) throw error
  return buildBlockState(data || [])
}

// Completed sessions (any block) in the last HOLD_RULE.days days.
export async function fetchRecentCompletedSessionCount(now = new Date()) {
  const since = new Date(now.getTime() - HOLD_RULE.days * 24 * 60 * 60 * 1000)
  const { count, error } = await supabase
    .from('workout_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed')
    .gte('completed_at', since.toISOString())
  if (error) throw error
  return count || 0
}

// Completed sessions (any block) with completed_at in [start, end).
// Partial sessions never show as trained days.
export async function fetchCompletedSessionsInRange(start, end) {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('day_id, completed_at')
    .eq('status', 'completed')
    .gte('completed_at', start.toISOString())
    .lt('completed_at', end.toISOString())
  if (error) throw error
  return data || []
}

export async function fetchTrainingWeek(referenceDate = new Date()) {
  const { start, end } = getWeekRange(referenceDate)
  return buildTrainingWeek(await fetchCompletedSessionsInRange(start, end), referenceDate)
}

export async function fetchWeeklyStreak(referenceDate = new Date()) {
  const { start, end } = getStreakRange(referenceDate)
  return countWeeklyStreak(await fetchCompletedSessionsInRange(start, end), referenceDate)
}

export async function fetchWorkoutsThisMonth(referenceDate = new Date()) {
  const { start, end } = getMonthRange(referenceDate)
  const { count, error } = await supabase
    .from('workout_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed')
    .gte('completed_at', start.toISOString())
    .lt('completed_at', end.toISOString())
  if (error) throw error
  return count || 0
}

// Every finished (completed or partial) session, most recent first — a flat
// chronological record. Includes pilot (block 0) sessions.
export async function fetchFinishedSessions() {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, day_id, block, status, completed_at, duration_seconds, effort, session_rpe, closed_by')
    .in('status', ['completed', 'partial'])
    .order('completed_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Most recent in-progress session for this specific day, if any — used on
// WorkoutSession mount to resume instead of starting a second session.
export async function fetchInProgressSession(dayId) {
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
}

// Any in-progress session, regardless of day — drives the Home tab's
// "Continue Workout" card (only one workout happens at a time).
export async function fetchAnyInProgressSession() {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data || null
}

// ---- Writes -------------------------------------------------------------------
// No workout_sessions row exists until the first set is saved. Only one
// in_progress session per day: an existing one is resumed, never duplicated.
// (A failed lookup falls through to the insert, as it always has.)
export async function createSession(dayId, weekInBlock) {
  const existing = await fetchInProgressSession(dayId).catch(() => null)
  if (existing) return existing
  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({ day_id: dayId, block: CURRENT_BLOCK, week_in_block: weekInBlock, status: 'in_progress' })
    .select()
    .single()
  if (error) throw error
  return data
}

// Finish tap. Status per getFinishStatus; duration is first -> last set,
// never wall clock. Returns the updated row, or null if the session was no
// longer in progress (e.g. auto-closed in the background) — nothing is
// written in that case.
export async function finishSession(sessionId, { sessionRpe = null, countAsWorkout = false } = {}) {
  const { data: logs, error: logsError } = await supabase
    .from('exercise_logs')
    .select('logged_at')
    .eq('session_id', sessionId)
  if (logsError) throw logsError
  if (!logs?.length) throw new Error('Cannot finish a session with no sets')

  const times = logs.map((l) => new Date(l.logged_at).getTime())
  const { data, error } = await supabase
    .from('workout_sessions')
    .update({
      status: getFinishStatus(logs.length, countAsWorkout),
      completed_at: new Date().toISOString(),
      duration_seconds: getSetSpanSeconds(times),
      closed_by: 'user',
      session_rpe: sessionRpe,
    })
    .eq('id', sessionId)
    .eq('status', 'in_progress')
    .select()
  if (error) throw error
  return data?.[0] ?? null
}

// Session effort edit (History, and after Finish). Only ever touches session_rpe.
export async function updateSessionRpe(sessionId, sessionRpe) {
  const { error } = await supabase.from('workout_sessions').update({ session_rpe: sessionRpe }).eq('id', sessionId)
  if (error) throw error
}
