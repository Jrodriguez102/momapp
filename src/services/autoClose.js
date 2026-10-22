// ---- Auto-close (forgotten sessions) ----------------------------------------
// The app can't run timers while closed, so App.jsx runs this on open and
// whenever the app returns to the foreground. See getAutoCloseDecision for
// the rules. Every write is guarded on status='in_progress', so re-running
// (or racing a Finish tap) is harmless.
import { supabase } from '../lib/supabase'
import { getAutoCloseDecision } from '../domain/sessionRules'

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
    const decision = getAutoCloseDecision({ startedAt: session.started_at, setTimes, now: now.getTime() })
    if (decision.action === 'keep') continue

    const result =
      decision.action === 'delete'
        ? await supabase.from('workout_sessions').delete().eq('id', session.id).eq('status', 'in_progress')
        : await supabase.from('workout_sessions').update(decision.patch).eq('id', session.id).eq('status', 'in_progress')
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
