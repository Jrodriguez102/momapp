// exercise_logs reads and writes (one row per logged set). Reads throw on
// error; writes are the frozen Block 01 data contract.
import { supabase } from '../lib/supabase'

// ---- Reads ------------------------------------------------------------------
// Progression input: block >= 1 sets only (pilot block 0 reps were pre-filled
// and can't be trusted), completed + partial sessions, by exercise name.
export async function fetchProgressionLogs(exerciseNames) {
  if (!exerciseNames.length) return []
  const { data, error } = await supabase
    .from('exercise_logs')
    .select('session_id, exercise_id, exercise_name, set_number, weight, reps, rpe, logged_at, workout_sessions!inner(block, status)')
    .in('exercise_name', exerciseNames)
    .gt('workout_sessions.block', 0)
    .in('workout_sessions.status', ['completed', 'partial'])
  if (error) throw error
  return data || []
}

export async function fetchSessionExerciseLogs(sessionId) {
  const { data, error } = await supabase
    .from('exercise_logs')
    .select('*')
    .eq('session_id', sessionId)
  if (error) throw error
  return data || []
}

// All logged sets across a batch of sessions in one query — used to compute
// each History row's sets/volume summary up front, instead of an N+1 fetch
// per session.
export async function fetchExerciseLogsForSessions(sessionIds) {
  if (!sessionIds.length) return []
  const { data, error } = await supabase
    .from('exercise_logs')
    .select('*')
    .in('session_id', sessionIds)
  if (error) throw error
  return data || []
}

// Every strength set ever logged, oldest first, with its session's block
// (Progress tab — block 0 = pilot).
export async function fetchAllStrengthLogs() {
  const { data, error } = await supabase
    .from('exercise_logs')
    .select('*, workout_sessions!inner(block)')
    .eq('is_cardio', false)
    .order('logged_at', { ascending: true })
  if (error) throw error
  return data || []
}

// ---- Writes -------------------------------------------------------------------
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
