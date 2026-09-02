import { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  getCompletedSessions,
  getExerciseLogsForSessions,
  groupSessionLogsByExercise,
  getSetsVolume,
  findDayById,
} from '../data/helpers'
import { EFFORT_OPTIONS } from '../data/program'

const EFFORT_LABELS = Object.fromEntries(EFFORT_OPTIONS.map((opt) => [opt.value, opt.label]))

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
]

// Monday-start week containing `date`, at local midnight.
function startOfWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function formatSessionDate(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatMinutes(seconds) {
  return `${Math.round(seconds / 60)} min`
}

// One completed session: collapsed to date/day/summary, expands in place to
// the full logged workout (exercises, sets, swaps, duration, volume, effort).
function SessionRow({ session, logs }) {
  const [expanded, setExpanded] = useState(false)
  const day = findDayById(session.day_id)
  const exerciseGroups = useMemo(() => groupSessionLogsByExercise(logs), [logs])
  const volume = useMemo(() => getSetsVolume(logs), [logs])

  return (
    <button type="button" onClick={() => setExpanded((e) => !e)} className="w-full card rounded-[24px] p-4 text-left">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-base-400">{formatSessionDate(session.completed_at)}</p>
          <p className="text-sm font-semibold text-base-100 mt-0.5">{day?.name ?? session.day_id}</p>
          <p className="text-xs text-base-400 mt-1">
            {session.duration_seconds != null && `${formatMinutes(session.duration_seconds)} · `}
            {logs.length} {logs.length === 1 ? 'set' : 'sets'} · {volume.toLocaleString()} lb
          </p>
        </div>
        <ChevronDown
          size={16}
          className={`text-base-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-base-700 space-y-3">
          {exerciseGroups.length === 0 ? (
            <p className="text-xs text-base-400">No sets logged for this session.</p>
          ) : (
            exerciseGroups.map((group) => (
              <div key={group.exerciseId}>
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-base-100 font-medium">{group.displayName}</span>
                  <span className="text-base-200 text-right shrink-0">
                    {group.sets.map((set) => `${set.weight} lb × ${set.reps}`).join(', ')}
                  </span>
                </div>
                {group.originalName && (
                  <p className="text-[11px] text-accent-end mt-0.5">Swapped from {group.originalName}</p>
                )}
              </div>
            ))
          )}

          {session.effort && (
            <div className="pt-2 border-t border-base-700">
              <p className="text-[11px] text-base-400">How did today's workout feel?</p>
              <p className="text-sm font-medium text-base-100 mt-0.5">{EFFORT_LABELS[session.effort] ?? session.effort}</p>
            </div>
          )}
        </div>
      )}
    </button>
  )
}

export default function History() {
  const [sessions, setSessions] = useState(null)
  const [logsBySession, setLogsBySession] = useState(new Map())
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const completed = await getCompletedSessions()
      const logs = await getExerciseLogsForSessions(completed.map((s) => s.id))
      if (cancelled) return
      const grouped = new Map()
      for (const log of logs) {
        if (!grouped.has(log.session_id)) grouped.set(log.session_id, [])
        grouped.get(log.session_id).push(log)
      }
      setSessions(completed)
      setLogsBySession(grouped)
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (!sessions) return null

  const now = new Date()
  const cutoff = filter === 'week' ? startOfWeek(now) : filter === 'month' ? startOfMonth(now) : null
  const filtered = cutoff ? sessions.filter((s) => new Date(s.completed_at) >= cutoff) : sessions

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-4 space-y-5">
      <h1 className="font-display font-black text-3xl text-base-100">History</h1>

      <div className="flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
              filter === f.value ? 'bg-base-100 text-base-800' : 'bg-base-900 text-base-400'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card rounded-[28px] p-6 text-center text-sm text-base-400">
          {sessions.length === 0 ? 'No workouts completed yet — finished sessions will show up here.' : 'No workouts in this range.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((session) => (
            <SessionRow key={session.id} session={session} logs={logsBySession.get(session.id) || []} />
          ))}
        </div>
      )}
    </div>
  )
}
