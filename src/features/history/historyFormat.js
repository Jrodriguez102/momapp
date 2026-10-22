import { EFFORT_OPTIONS } from '@/data/program'
import { getMonthRange, getWeekStart } from '@/domain/calendar'
import { getSetsVolume } from '@/domain/metrics'
import { HISTORY_EDIT_WINDOW_MS, getSessionRpeLabel } from '@/domain/sessionRules'

// Display helpers for the History tab (pure).

export const HISTORY_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
]

// Finished sessions in the chosen range, by completed_at.
export function filterSessions(sessions, filter, now = new Date()) {
  const cutoff = filter === 'week' ? getWeekStart(now) : filter === 'month' ? getMonthRange(now).start : null
  return cutoff ? sessions.filter((s) => new Date(s.completed_at) >= cutoff) : sessions
}

// "Tue, Oct 20 · 45 min · 19 sets · 12,340 lb" (+ "· auto-closed").
export function sessionSummaryParts(session, logs) {
  const parts = [new Date(session.completed_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })]
  if (session.duration_seconds != null) parts.push(`${Math.round(session.duration_seconds / 60)} min`)
  parts.push(`${logs.length} ${logs.length === 1 ? 'set' : 'sets'}`)
  parts.push(`${getSetsVolume(logs).toLocaleString()} lb`)
  if (session.closed_by === 'auto') parts.push('auto-closed')
  return parts
}

// Whole hours left in the 48h edit window (at least 1 while it's open).
export function editHoursLeft(session, now = new Date()) {
  const msLeft = new Date(session.completed_at).getTime() + HISTORY_EDIT_WINDOW_MS - now.getTime()
  return Math.max(1, Math.ceil(msLeft / (60 * 60 * 1000)))
}

const LEGACY_EFFORT = Object.fromEntries(EFFORT_OPTIONS.map((opt) => [opt.value, opt.label]))

// "Effort 7 of 10" (1-10 session_rpe), "Effort: Hard" for a pilot session's
// legacy label, or null when nothing was recorded.
export function effortText(session) {
  if (session.session_rpe != null) return `Effort ${session.session_rpe} of 10 · ${getSessionRpeLabel(session.session_rpe)}`
  if (session.effort) return `Effort: ${LEGACY_EFFORT[session.effort] ?? session.effort}`
  return null
}
