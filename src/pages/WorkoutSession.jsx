import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Clock } from 'lucide-react'
import {
  findDayById,
  getCurrentBlockAndWeek,
  getCompletedSessionCount,
  findInProgressSession,
  getAnyInProgressSession,
  getSessionExerciseLogs,
  getProgressionLogs,
  getRecentCompletedSessionCount,
  getExerciseSuggestion,
  createSession,
  saveSet,
  removeLiveSet,
  syncExerciseRpe,
  renameExerciseInSession,
  finishSession,
  difficultyToRpe,
  rpeToDifficulty,
  getSetsVolume,
  getElapsedSeconds,
  formatDuration,
  afterAutoClose,
  MIN_SETS_FOR_COMPLETED,
  SESSIONS_AUTO_CLOSED_EVENT,
} from '../data/helpers'
import { applyDeloadToSets, CURRENT_BLOCK, SESSIONS_PER_BLOCK } from '../data/program'
import { notifyError } from '@/ui/toast'
import ExerciseCard from '../components/ExerciseCard'
import EffortTap from '../components/EffortTap'
import StatTile from '../components/StatTile'

// Namespaced by block so pilot-era drafts can never resume into Block 01.
function storageKey(dayId) {
  return `block${CURRENT_BLOCK}:session-in-progress-${dayId}`
}

// localStorage (not sessionStorage — iOS Safari reclaims that readily when
// backgrounded) holds only a *draft*: unsaved weight/rep entries, swap
// choices, and the session effort pick. Anything logged lives in Supabase
// and wins on resume.
const EMPTY_DRAFT = { entries: {}, swaps: {}, sessionRpe: null }

function loadStoredDraft(dayId) {
  try {
    const raw = localStorage.getItem(storageKey(dayId))
    if (!raw) return EMPTY_DRAFT
    const parsed = JSON.parse(raw)
    return {
      entries: parsed.entries || {},
      swaps: parsed.swaps || {},
      sessionRpe: parsed.sessionRpe ?? null,
    }
  } catch {
    return EMPTY_DRAFT
  }
}

function clearStoredDraft(dayId) {
  try {
    localStorage.removeItem(storageKey(dayId))
  } catch {
    // storage unavailable — nothing to clear
  }
}

// Rebuilds per-slot state from a session's saved rows: logs by set number,
// the last-set difficulty (from whichever row carries rpe), and the active
// swap (any logged name that isn't the base exercise).
function stateFromSessionLogs(day, rows) {
  const logs = {}
  const difficulties = {}
  const swaps = {}
  for (const row of rows) {
    logs[row.exercise_id] = { ...logs[row.exercise_id], [row.set_number]: row }
    if (row.rpe != null) difficulties[row.exercise_id] = rpeToDifficulty(row.rpe)
  }
  for (const ex of day.exercises) {
    const loggedName = Object.values(logs[ex.id] || {})[0]?.exercise_name
    if (!loggedName) continue
    const alt = ex.alternatives.find((a) => a.name === loggedName)
    swaps[ex.id] = alt || null
  }
  return { logs, difficulties, swaps }
}

function Screen({ children }) {
  return <div className="max-w-2xl mx-auto px-4 pt-10 pb-10 space-y-5 text-center">{children}</div>
}

export default function WorkoutSession() {
  const { dayId } = useParams()
  const navigate = useNavigate()
  const day = useMemo(() => findDayById(dayId), [dayId])

  const draft = useMemo(() => loadStoredDraft(dayId), [dayId])
  const [entries, setEntries] = useState(draft.entries)
  const [swaps, setSwaps] = useState(draft.swaps)
  const [sessionRpe, setSessionRpe] = useState(draft.sessionRpe)

  const [loaded, setLoaded] = useState(null) // { weekMeta, otherSession, progressionLogs, recentCompletedCount }
  const [session, setSession] = useState(null) // Supabase row — only exists once a set has been saved
  const [logs, setLogs] = useState({}) // { [exerciseId]: { [setNumber]: row } }
  const [difficulties, setDifficulties] = useState({}) // { [exerciseId]: '3+' | '1-2' | '0' }
  const [savingSets, setSavingSets] = useState({}) // { [exerciseId]: { [setNumber]: true } }
  const [confirmingFinish, setConfirmingFinish] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [result, setResult] = useState(null) // { kind: 'finished', ... } | { kind: 'auto-closed' }
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const sessionPromiseRef = useRef(null)

  // Load everything after the auto-close check, so a forgotten session is
  // closed (and counted) before week/queue math and resume happen.
  useEffect(() => {
    if (!day) return
    let cancelled = false
    async function load() {
      await afterAutoClose()
      const names = day.exercises.flatMap((ex) => [ex.name, ...ex.alternatives.map((a) => a.name)])
      const [count, existing, anyOpen, progressionLogs, recentCompletedCount] = await Promise.all([
        getCompletedSessionCount(),
        findInProgressSession(day.id),
        getAnyInProgressSession(),
        getProgressionLogs(names),
        getRecentCompletedSessionCount(),
      ])
      const rows = existing ? await getSessionExerciseLogs(existing.id) : []
      if (cancelled) return

      if (existing) {
        const restored = stateFromSessionLogs(day, rows)
        setSession(existing)
        setLogs(restored.logs)
        setDifficulties(restored.difficulties)
        setSwaps((prev) => {
          const next = { ...prev }
          for (const [exId, alt] of Object.entries(restored.swaps)) {
            if (alt) next[exId] = alt
            else delete next[exId]
          }
          return next
        })
      }
      setLoaded({
        weekMeta: getCurrentBlockAndWeek(count),
        otherSession: !existing && anyOpen && anyOpen.day_id !== day.id ? anyOpen : null,
        progressionLogs,
        recentCompletedCount,
      })
    }
    load()
    return () => { cancelled = true }
  }, [day])

  // Persist the draft on every change (until the session is finished).
  useEffect(() => {
    if (result) return
    try {
      localStorage.setItem(storageKey(dayId), JSON.stringify({ entries, swaps, sessionRpe }))
    } catch {
      // storage unavailable — the draft just won't survive a reload
    }
  }, [dayId, entries, swaps, sessionRpe, result])

  // If the foreground auto-close check closes this session, stop logging.
  useEffect(() => {
    function handleAutoClosed(e) {
      if (session && e.detail.sessionIds.includes(session.id)) {
        clearStoredDraft(dayId)
        setResult({ kind: 'auto-closed' })
      }
    }
    window.addEventListener(SESSIONS_AUTO_CLOSED_EVENT, handleAutoClosed)
    return () => window.removeEventListener(SESSIONS_AUTO_CLOSED_EVENT, handleAutoClosed)
  }, [session, dayId])

  // Live elapsed timer — display only, computed from started_at on each tick.
  useEffect(() => {
    if (!session?.started_at || result) return
    function tick() {
      setElapsedSeconds(getElapsedSeconds(session.started_at))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [session?.started_at, result])

  const suggestions = useMemo(() => {
    if (!day || !loaded) return {}
    return Object.fromEntries(
      day.exercises.map((ex) => [
        ex.id,
        getExerciseSuggestion({
          exercise: ex,
          activeName: swaps[ex.id]?.name ?? ex.name,
          logs: loaded.progressionLogs,
          weekMeta: loaded.weekMeta,
          recentCompletedCount: loaded.recentCompletedCount,
        }),
      ]),
    )
  }, [day, loaded, swaps])

  if (!day) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-8">
        <p className="text-base-400">Day not found.</p>
      </div>
    )
  }

  if (!loaded) return null
  const { weekMeta, otherSession } = loaded

  const allLoggedRows = Object.values(logs).flatMap((bySet) => Object.values(bySet))
  const loggedCount = allLoggedRows.length
  const locked = !!result || finishing

  function activeNameFor(ex) {
    return swaps[ex.id]?.name ?? ex.name
  }

  // Starting weight for each set row: the previous logged set's weight in
  // this session if there is one, else the suggestion's prefill.
  function prefillWeightsFor(ex, rowCount) {
    const bySet = logs[ex.id] || {}
    let carry = suggestions[ex.id]?.prefillWeight ?? ''
    return Array.from({ length: rowCount }, (_, i) => {
      const value = carry
      if (bySet[i + 1]?.weight != null) carry = bySet[i + 1].weight
      return value
    })
  }

  function setEntry(exerciseId, index, value) {
    setEntries((prev) => {
      const arr = [...(prev[exerciseId] || [])]
      arr[index] = value
      return { ...prev, [exerciseId]: arr }
    })
  }

  function handleEntryChange(exerciseId, index, field, value) {
    setEntries((prev) => {
      const arr = [...(prev[exerciseId] || [])]
      arr[index] = { ...arr[index], [field]: value }
      return { ...prev, [exerciseId]: arr }
    })
  }

  function setSaving(exerciseId, setNumber, on) {
    setSavingSets((prev) => {
      const bySet = { ...prev[exerciseId] }
      if (on) bySet[setNumber] = true
      else delete bySet[setNumber]
      return { ...prev, [exerciseId]: bySet }
    })
  }

  // The workout_sessions row is created lazily on the first saved set, and
  // only once even if two sets are tapped at the same moment.
  function ensureSession() {
    if (session) return Promise.resolve(session)
    if (!sessionPromiseRef.current) {
      sessionPromiseRef.current = createSession(day.id, weekMeta.weekInBlock)
        .then((row) => {
          setSession(row)
          return row
        })
        .catch((err) => {
          sessionPromiseRef.current = null
          throw err
        })
    }
    return sessionPromiseRef.current
  }

  // Saves a new set or edits a logged one — same idempotent upsert either way.
  async function handleSaveSet(ex, index, values) {
    const setNumber = index + 1
    if (savingSets[ex.id]?.[setNumber]) return false
    setSaving(ex.id, setNumber, true)
    try {
      const active = await ensureSession()
      const row = await saveSet({
        sessionId: active.id,
        exerciseId: ex.id,
        exerciseName: activeNameFor(ex),
        setNumber,
        weight: values.weight,
        reps: values.reps,
        weightUnit: ex.weight.unit,
      })
      setLogs((prev) => ({ ...prev, [ex.id]: { ...prev[ex.id], [setNumber]: row } }))
      setEntry(ex.id, index, undefined)
      // Keep the last-set difficulty on the highest logged set.
      const difficulty = difficulties[ex.id]
      if (difficulty) await syncExerciseRpe(active.id, ex.id, difficultyToRpe(difficulty))
      return true
    } catch (err) {
      console.error('Failed to save set:', err)
      notifyError('Could not save that set — check your connection and try again.')
      return false
    } finally {
      setSaving(ex.id, setNumber, false)
    }
  }

  async function handleRemoveSet(ex, row) {
    try {
      const { sessionDeleted } = await removeLiveSet(row)
      const remainingForExercise = Object.keys(logs[ex.id] || {}).length - 1
      setLogs((prev) => {
        const bySet = { ...prev[ex.id] }
        delete bySet[row.set_number]
        return { ...prev, [ex.id]: bySet }
      })
      if (remainingForExercise === 0) {
        setDifficulties((prev) => {
          const next = { ...prev }
          delete next[ex.id]
          return next
        })
      }
      if (sessionDeleted) {
        setSession(null)
        sessionPromiseRef.current = null
        setElapsedSeconds(0)
      }
      return true
    } catch (err) {
      console.error('Failed to remove set:', err)
      notifyError('Could not remove that set — check your connection and try again.')
      return false
    }
  }

  async function handleDifficulty(ex, value) {
    if (!session) return
    const previous = difficulties[ex.id] ?? null
    setDifficulties((prev) => ({ ...prev, [ex.id]: value }))
    try {
      await syncExerciseRpe(session.id, ex.id, difficultyToRpe(value))
    } catch (err) {
      console.error('Failed to save difficulty:', err)
      setDifficulties((prev) => ({ ...prev, [ex.id]: previous }))
      notifyError('Could not save that — check your connection and try again.')
    }
  }

  // alt: an alternative { name, demoUrl }, or null for the base exercise.
  // Already-logged sets of this slot are renamed so the slot keeps one name;
  // unsaved entries are cleared so a weight never carries across movements.
  async function handleSwap(ex, alt) {
    const nextName = alt?.name ?? ex.name
    if (nextName === activeNameFor(ex)) return
    const loggedForExercise = Object.keys(logs[ex.id] || {}).length > 0
    try {
      if (session && loggedForExercise) {
        await renameExerciseInSession(session.id, ex.id, nextName)
        setLogs((prev) => ({
          ...prev,
          [ex.id]: Object.fromEntries(Object.entries(prev[ex.id]).map(([n, row]) => [n, { ...row, exercise_name: nextName }])),
        }))
      }
      setSwaps((prev) => {
        const next = { ...prev }
        if (alt) next[ex.id] = alt
        else delete next[ex.id]
        return next
      })
      setEntries((prev) => ({ ...prev, [ex.id]: [] }))
    } catch (err) {
      console.error('Failed to swap exercise:', err)
      notifyError('Could not switch exercises — check your connection and try again.')
    }
  }

  function handleFinishClick() {
    if (loggedCount === 0 || !session) return
    if (loggedCount < MIN_SETS_FOR_COMPLETED) setConfirmingFinish(true)
    else finish(true)
  }

  async function finish(countAsWorkout) {
    setFinishing(true)
    try {
      const row = await finishSession(session.id, { sessionRpe, countAsWorkout })
      clearStoredDraft(dayId)
      if (!row) {
        setResult({ kind: 'auto-closed' })
        return
      }
      setResult({
        kind: 'finished',
        status: row.status,
        durationSeconds: row.duration_seconds ?? 0,
        setsCompleted: allLoggedRows.length,
        totalVolume: getSetsVolume(allLoggedRows),
      })
    } catch (err) {
      console.error('Failed to finish session:', err)
      notifyError('Could not finish the workout — check your connection and try again.')
    } finally {
      setFinishing(false)
      setConfirmingFinish(false)
    }
  }

  if (result?.kind === 'finished') {
    const isPartial = result.status === 'partial'
    return (
      <Screen>
        <span className="mx-auto w-16 h-16 rounded-full bg-[var(--color-back)]/12 flex items-center justify-center">
          <Check size={28} className="text-[var(--color-back)]" />
        </span>
        <div>
          <h1 className="font-display font-black text-3xl text-base-100">{isPartial ? 'Saved as Partial' : 'Workout Complete'}</h1>
          <p className="text-sm text-base-400 mt-1">{day.name}</p>
          {isPartial && (
            <p className="text-xs text-base-400 mt-2">
              Your sets are saved, but this won't count toward the block — {day.shortLabel} stays next.
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 text-left">
          <StatTile value={formatDuration(result.durationSeconds)} label="Duration" />
          <StatTile value={result.setsCompleted} label="Sets completed" />
          <StatTile value={result.totalVolume.toLocaleString()} unit="lb" label="Total volume" />
        </div>
        <button onClick={() => navigate('/')} className="w-full accent-gradient text-white font-bold rounded-full py-3.5">
          Back to Home
        </button>
      </Screen>
    )
  }

  if (result?.kind === 'auto-closed') {
    return (
      <Screen>
        <span className="mx-auto w-16 h-16 rounded-full bg-base-900 flex items-center justify-center">
          <Clock size={28} className="text-base-400" />
        </span>
        <div>
          <h1 className="font-display font-black text-3xl text-base-100">Workout Closed</h1>
          <p className="text-sm text-base-400 mt-2">
            This workout was closed automatically after a long break. Every set you logged is saved in History.
          </p>
        </div>
        <button onClick={() => navigate('/')} className="w-full accent-gradient text-white font-bold rounded-full py-3.5">
          Back to Home
        </button>
      </Screen>
    )
  }

  if (otherSession) {
    const otherDay = findDayById(otherSession.day_id)
    return (
      <Screen>
        <div>
          <h1 className="font-display font-black text-2xl text-base-100">Another workout is in progress</h1>
          <p className="text-sm text-base-400 mt-2">
            Finish {otherDay?.name ?? 'that workout'} before starting {day.name}.
          </p>
        </div>
        <button
          onClick={() => navigate(`/session/${otherSession.day_id}`)}
          className="w-full accent-gradient text-white font-bold rounded-full py-3.5 flex items-center justify-center gap-2"
        >
          Continue {otherDay?.shortLabel ?? 'workout'} <ArrowRight size={16} />
        </button>
      </Screen>
    )
  }

  if (weekMeta.isBlockComplete && !session) {
    return (
      <Screen>
        <span className="mx-auto w-16 h-16 rounded-full bg-[var(--color-back)]/12 flex items-center justify-center">
          <Check size={28} className="text-[var(--color-back)]" />
        </span>
        <div>
          <h1 className="font-display font-black text-3xl text-base-100">Block 01 complete</h1>
          <p className="text-sm text-base-400 mt-2">All {SESSIONS_PER_BLOCK} sessions are done. The next block will be built from this data.</p>
        </div>
        <button onClick={() => navigate('/')} className="w-full accent-gradient text-white font-bold rounded-full py-3.5">
          Back to Home
        </button>
      </Screen>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-10 space-y-4">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1 text-sm text-base-400 hover:text-base-100 transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base-400 text-sm">{weekMeta.label} · Session {weekMeta.sessionNumber} of {SESSIONS_PER_BLOCK}</p>
          <h1 className="font-display font-black text-2xl text-base-100">{day.name}</h1>
          {weekMeta.note && <p className="text-xs text-base-400 mt-1">{weekMeta.note}</p>}
        </div>
        {session && (
          <span className="card rounded-full px-3 py-1.5 text-xs font-semibold text-base-400 shrink-0">
            {formatDuration(elapsedSeconds)}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {day.exercises.map((ex) => {
          const prescribedSets = applyDeloadToSets(ex.sets, weekMeta.weekInBlock)
          const exLogs = logs[ex.id] || {}
          const rowCount = Math.max(prescribedSets, ...Object.keys(exLogs).map(Number), 0)
          return (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              prescribedSets={prescribedSets}
              suggestion={suggestions[ex.id]}
              activeAlt={swaps[ex.id] || null}
              onSwap={(alt) => handleSwap(ex, alt)}
              entries={entries[ex.id] || []}
              logs={exLogs}
              prefillWeights={prefillWeightsFor(ex, rowCount)}
              onEntryChange={(index, field, value) => handleEntryChange(ex.id, index, field, value)}
              onSaveSet={(index, values) => handleSaveSet(ex, index, values)}
              onRemoveSet={(row) => handleRemoveSet(ex, row)}
              savingSets={savingSets[ex.id] || {}}
              difficulty={difficulties[ex.id] ?? null}
              onDifficulty={(value) => handleDifficulty(ex, value)}
              locked={locked}
            />
          )
        })}
      </div>

      <div className="card rounded-[28px] p-4">
        <EffortTap value={sessionRpe} onChange={setSessionRpe} disabled={locked} />
      </div>

      {confirmingFinish ? (
        <div className="card rounded-[28px] p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-base-100">
              Only {loggedCount} {loggedCount === 1 ? 'set' : 'sets'} logged — count this as a workout?
            </p>
            <p className="text-xs text-base-400 mt-1">
              If not, it's saved as partial: your sets are kept, but it won't count toward the block and {day.shortLabel} stays next.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={finishing}
              onClick={() => finish(true)}
              className="accent-gradient text-white font-semibold text-sm rounded-full py-3 disabled:opacity-60"
            >
              Yes, count it
            </button>
            <button
              type="button"
              disabled={finishing}
              onClick={() => finish(false)}
              className="bg-base-900 text-base-200 font-semibold text-sm rounded-full py-3 disabled:opacity-60"
            >
              No, save as partial
            </button>
          </div>
          <button
            type="button"
            disabled={finishing}
            onClick={() => setConfirmingFinish(false)}
            className="w-full text-xs text-base-400 py-1"
          >
            Keep going
          </button>
        </div>
      ) : (
        <button
          onClick={handleFinishClick}
          disabled={loggedCount === 0 || finishing}
          className="w-full accent-gradient text-white font-bold rounded-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {finishing ? 'Saving...' : loggedCount === 0 ? 'Finish (log a set first)' : 'Finish Workout'}
        </button>
      )}
    </div>
  )
}
