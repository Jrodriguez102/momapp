import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import {
  getFinishedSessions,
  getExerciseLogsForSessions,
  getSessionExerciseLogs,
  groupSessionLogsByExercise,
  getSetsVolume,
  findDayById,
  isWithinEditWindow,
  saveSet,
  removeHistorySet,
  syncExerciseRpe,
  updateSessionRpe,
  difficultyToRpe,
  getSessionRpeLabel,
  isValidReps,
  isValidWeight,
  HISTORY_EDIT_WINDOW_MS,
} from '../data/helpers'
import { EFFORT_OPTIONS, LAST_SET_DIFFICULTY_OPTIONS } from '../data/program'
import EffortTap from '../components/EffortTap'
import LastSetDifficultyTap from '../components/LastSetDifficultyTap'

const EFFORT_LABELS = Object.fromEntries(EFFORT_OPTIONS.map((opt) => [opt.value, opt.label]))
const DIFFICULTY_LABELS = Object.fromEntries(LAST_SET_DIFFICULTY_OPTIONS.map((opt) => [opt.value, opt.label]))

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
]

const INPUT_CLASS =
  'w-full min-w-0 bg-base-900 rounded-xl px-2 py-1.5 text-sm text-base-100 outline-none focus:ring-1 focus:ring-accent-start'

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

function formatSet(set) {
  return `${set.weight ?? '—'} lb × ${set.reps ?? '—'}`
}

// One logged set inside an editable session: a chip that opens an inline
// weight/reps editor with Save / Remove / Cancel.
function EditableSet({ set, busy, onSave, onRemove }) {
  const [draft, setDraft] = useState(null) // { weight, reps } while editing

  if (!draft) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => setDraft({ weight: set.weight ?? '', reps: set.reps ?? '' })}
        className="text-xs font-medium px-2.5 py-1 rounded-full bg-base-900 text-base-200 hover:bg-base-700 disabled:opacity-60"
      >
        {formatSet(set)}
      </button>
    )
  }

  const canSave = isValidWeight(draft.weight) && isValidReps(draft.reps) && !busy
  return (
    <div className="w-full space-y-1.5">
      <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 items-center">
        <span className="text-sm text-base-400">{set.set_number}</span>
        <input
          type="number"
          inputMode="decimal"
          placeholder="lb"
          value={draft.weight}
          onChange={(e) => setDraft((d) => ({ ...d, weight: e.target.value }))}
          className={INPUT_CLASS}
        />
        <input
          type="number"
          inputMode="numeric"
          placeholder="reps"
          value={draft.reps}
          onChange={(e) => setDraft((d) => ({ ...d, reps: e.target.value }))}
          className={INPUT_CLASS}
        />
        <button
          type="button"
          disabled={!canSave}
          onClick={async () => {
            if (await onSave(draft)) setDraft(null)
          }}
          className="flex items-center justify-center w-7 h-7 rounded-full accent-gradient text-white disabled:opacity-25 transition-opacity"
          aria-label={`Save set ${set.set_number}`}
        >
          <Check size={14} />
        </button>
      </div>
      <div className="flex gap-4 pl-10 text-xs">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (await onRemove()) setDraft(null)
          }}
          className="text-[var(--color-glute)] font-medium disabled:opacity-40"
        >
          Remove set
        </button>
        <button type="button" onClick={() => setDraft(null)} className="text-base-400">
          Cancel
        </button>
      </div>
    </div>
  )
}

// One finished session: collapsed to date/day/summary, expands in place to
// the full logged workout. Within 48h of completed_at, sets, last-set
// difficulty and session effort are editable; after that it's read-only.
// Edits only touch exercise_logs / session_rpe — never status, completed_at
// or closed_by (except: removing every set marks it partial).
function SessionRow({ session, logs, onChanged }) {
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const day = findDayById(session.day_id)
  const exerciseGroups = useMemo(() => groupSessionLogsByExercise(logs), [logs])
  const volume = useMemo(() => getSetsVolume(logs), [logs])
  const editable = isWithinEditWindow(session)
  const editableUntil = new Date(new Date(session.completed_at).getTime() + HISTORY_EDIT_WINDOW_MS)

  async function run(action, patch) {
    setBusy(true)
    try {
      const result = await action()
      await onChanged(session.id, typeof patch === 'function' ? patch(result) : patch)
      return true
    } catch (err) {
      console.error('Failed to save History edit:', err)
      alert('Could not save that change — check your connection and try again.')
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card rounded-[24px] p-4">
      <button type="button" onClick={() => setExpanded((e) => !e)} className="w-full text-left flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-base-400">{formatSessionDate(session.completed_at)}</p>
          <p className="text-sm font-semibold text-base-100 mt-0.5 flex items-center gap-2 flex-wrap">
            {day?.name ?? session.day_id}
            {session.status === 'partial' && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-accent-end bg-accent-start/10 rounded-full px-2 py-0.5">
                Partial
              </span>
            )}
          </p>
          <p className="text-xs text-base-400 mt-1">
            {session.duration_seconds != null && `${formatMinutes(session.duration_seconds)} · `}
            {logs.length} {logs.length === 1 ? 'set' : 'sets'} · {volume.toLocaleString()} lb
            {session.closed_by === 'auto' && ' · auto-closed'}
          </p>
        </div>
        <ChevronDown size={16} className={`text-base-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-base-700 space-y-3">
          {editable && (
            <p className="text-[11px] text-base-400">
              Tap a set to fix it — editable until{' '}
              {editableUntil.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.
            </p>
          )}

          {exerciseGroups.length === 0 ? (
            <p className="text-xs text-base-400">No sets logged for this session.</p>
          ) : (
            exerciseGroups.map((group) => (
              <div key={group.exerciseId}>
                {editable ? (
                  <>
                    <p className="text-sm text-base-100 font-medium">{group.displayName}</p>
                    {group.originalName && <p className="text-[11px] text-accent-end mt-0.5">Swapped from {group.originalName}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {group.sets.map((set) => (
                        <EditableSet
                          key={set.id}
                          set={set}
                          busy={busy}
                          onSave={(draft) =>
                            run(() =>
                              saveSet({
                                sessionId: session.id,
                                exerciseId: set.exercise_id,
                                exerciseName: set.exercise_name,
                                setNumber: set.set_number,
                                weight: draft.weight,
                                reps: draft.reps,
                                weightUnit: set.weight_unit || 'lb',
                              }),
                            )
                          }
                          onRemove={() =>
                            run(
                              () => removeHistorySet(set),
                              ({ remaining }) => (remaining === 0 ? { status: 'partial' } : null),
                            )
                          }
                        />
                      ))}
                    </div>
                    <div className="mt-2">
                      <p className="text-[11px] text-base-400 mb-1">Last set — reps left</p>
                      <LastSetDifficultyTap
                        value={group.difficulty}
                        disabled={busy}
                        onChange={(value) => run(() => syncExerciseRpe(session.id, group.exerciseId, difficultyToRpe(value)))}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3 text-sm">
                      <span className="text-base-100 font-medium">{group.displayName}</span>
                      <span className="text-base-200 text-right shrink-0">{group.sets.map(formatSet).join(', ')}</span>
                    </div>
                    {group.originalName && <p className="text-[11px] text-accent-end mt-0.5">Swapped from {group.originalName}</p>}
                    {group.difficulty && (
                      <p className="text-[11px] text-base-400 mt-0.5">Last set: {DIFFICULTY_LABELS[group.difficulty]}</p>
                    )}
                  </>
                )}
              </div>
            ))
          )}

          {editable ? (
            <div className="pt-2 border-t border-base-700">
              <EffortTap
                value={session.session_rpe ?? null}
                disabled={busy}
                onChange={(value) => run(() => updateSessionRpe(session.id, value), { session_rpe: value })}
              />
            </div>
          ) : (
            (session.session_rpe != null || session.effort) && (
              <div className="pt-2 border-t border-base-700">
                <p className="text-[11px] text-base-400">How hard was the workout?</p>
                <p className="text-sm font-medium text-base-100 mt-0.5">
                  {session.session_rpe != null
                    ? `${session.session_rpe}/10 · ${getSessionRpeLabel(session.session_rpe)}`
                    : EFFORT_LABELS[session.effort] ?? session.effort}
                </p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

export default function History() {
  const [sessions, setSessions] = useState(null)
  const [logsBySession, setLogsBySession] = useState(new Map())
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const finished = await getFinishedSessions()
      const logs = await getExerciseLogsForSessions(finished.map((s) => s.id))
      if (cancelled) return
      const grouped = new Map()
      for (const log of logs) {
        if (!grouped.has(log.session_id)) grouped.set(log.session_id, [])
        grouped.get(log.session_id).push(log)
      }
      setSessions(finished)
      setLogsBySession(grouped)
    }
    load()
    return () => { cancelled = true }
  }, [])

  // After an edit: refetch that session's sets, and apply any session-field
  // change (session_rpe, or status -> partial when every set was removed).
  async function refreshSession(sessionId, patch) {
    const fresh = await getSessionExerciseLogs(sessionId)
    setLogsBySession((prev) => new Map(prev).set(sessionId, fresh))
    if (patch) setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, ...patch } : s)))
  }

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
          {sessions.length === 0 ? 'No workouts finished yet — they will show up here.' : 'No workouts in this range.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              logs={logsBySession.get(session.id) || []}
              onChanged={refreshSession}
            />
          ))}
        </div>
      )}
    </div>
  )
}
