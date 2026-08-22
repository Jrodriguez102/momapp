import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import {
  findDayById,
  getCurrentBlockAndWeek,
  getCompletedSessionCount,
  getLastLoggedSet,
  findInProgressSession,
  getSessionExerciseLogs,
  getElapsedSeconds,
  formatDuration,
} from '../data/helpers'
import { applyDeloadToSets } from '../data/program'
import ExerciseCard from '../components/ExerciseCard'
import EffortTap from '../components/EffortTap'
import StatTile from '../components/StatTile'
import { supabase } from '../lib/supabase'

function storageKey(dayId) {
  return `session-in-progress-${dayId}`
}

// Persisted to localStorage rather than sessionStorage: sessionStorage is
// tied to the browsing session and mobile browsers (iOS Safari in
// particular) will readily discard it when the app is backgrounded and the
// OS reclaims memory. localStorage survives that. This now only ever holds
// a *draft* — anything actually logged lives in Supabase
// (workout_sessions / exercise_logs) and wins on resume; this just carries
// not-yet-logged weight/rep entries, swap choices, and the effort pick
// between page loads.
function loadStoredDraft(dayId) {
  try {
    const raw = localStorage.getItem(storageKey(dayId))
    if (!raw) return { setsByExercise: {}, effort: null, swaps: {} }
    const parsed = JSON.parse(raw)
    return {
      setsByExercise: parsed.setsByExercise || {},
      effort: parsed.effort ?? null,
      swaps: parsed.swaps || {},
    }
  } catch {
    return { setsByExercise: {}, effort: null, swaps: {} }
  }
}

export default function WorkoutSession() {
  const { dayId } = useParams()
  const navigate = useNavigate()
  const day = useMemo(() => findDayById(dayId), [dayId])
  const [weekMeta, setWeekMeta] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function loadWeek() {
      const count = await getCompletedSessionCount()
      if (!cancelled) setWeekMeta(getCurrentBlockAndWeek(count))
    }
    loadWeek()
    return () => { cancelled = true }
  }, [])

  const draft = useMemo(() => loadStoredDraft(dayId), [dayId])
  const [setsByExercise, setSetsByExercise] = useState(draft.setsByExercise)
  const [effort, setEffort] = useState(draft.effort)
  const [swaps, setSwaps] = useState(draft.swaps)
  const [pastLogs, setPastLogs] = useState([])
  const [session, setSession] = useState(null) // Supabase row — only exists once a set has been logged
  const [resuming, setResuming] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [summary, setSummary] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Resume: look for an existing in-progress session for this day and
  // reconstruct its completed sets from Supabase (source of truth) on top
  // of the local draft, so unsaved typing/swaps for other sets aren't lost.
  useEffect(() => {
    let cancelled = false
    async function resume() {
      const existing = await findInProgressSession(dayId)
      if (cancelled) return
      if (existing) {
        setSession(existing)
        const logs = await getSessionExerciseLogs(existing.id)
        if (cancelled) return
        setSetsByExercise((prev) => {
          const next = { ...prev }
          for (const log of logs) {
            const arr = [...(next[log.exercise_id] || [])]
            arr[log.set_number - 1] = { weight: log.weight, reps: log.reps, completed: true, logId: log.id }
            next[log.exercise_id] = arr
          }
          return next
        })
      }
      setResuming(false)
    }
    resume()
    return () => { cancelled = true }
  }, [dayId])

  // Persist the draft (unsaved entries + swaps + effort) on every change.
  useEffect(() => {
    localStorage.setItem(storageKey(dayId), JSON.stringify({ setsByExercise, effort, swaps }))
  }, [dayId, setsByExercise, effort, swaps])

  // Live elapsed timer — computed from started_at on each tick rather than
  // accumulated client-side, so it self-corrects after the app is
  // backgrounded and reopened, and never needs a DB write to stay accurate.
  useEffect(() => {
    if (!session?.started_at || saved) return
    function tick() {
      setElapsedSeconds(getElapsedSeconds(session.started_at))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [session?.started_at, saved])

  // Pull past logs for "last time you lifted X" reminders.
  useEffect(() => {
    async function loadLogs() {
      try {
        const { data, error } = await supabase
          .from('exercise_logs')
          .select('*')
          .order('logged_at', { ascending: false })
          .limit(500)
        if (!error && data) setPastLogs(data)
      } catch {
        // Supabase not configured yet — fine for local/dev preview.
      }
    }
    loadLogs()
  }, [])

  if (!day) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-8">
        <p className="text-base-400">Day not found.</p>
      </div>
    )
  }

  if (!weekMeta || resuming) return null

  function handleSetChange(exerciseId, setIndex, field, value) {
    setSetsByExercise((prev) => {
      const existing = prev[exerciseId] || []
      const updated = [...existing]
      updated[setIndex] = { ...updated[setIndex], [field]: value }
      return { ...prev, [exerciseId]: updated }
    })
  }

  // alt is either an alternative { name, demoUrl } object or null (swap back
  // to the default exercise). Stored per exerciseId so it survives
  // navigation away and back, same as logged sets.
  function handleSwap(exerciseId, alt) {
    setSwaps((prev) => {
      const next = { ...prev }
      if (alt) next[exerciseId] = alt
      else delete next[exerciseId]
      return next
    })
  }

  function lastLoggedTextFor(exerciseId) {
    const last = getLastLoggedSet(pastLogs, exerciseId)
    if (!last) return null
    return `${last.weight ?? '—'}${last.weight_unit || 'lb'} x ${last.reps ?? '—'}`
  }

  // Creates the workout_sessions row lazily, on the first logged set —
  // opening this page and leaving without logging anything must never
  // create a row.
  async function ensureSession() {
    if (session) return session
    const { data, error } = await supabase
      .from('workout_sessions')
      .insert({ day_id: day.id, block: weekMeta.block, week_in_block: weekMeta.weekInBlock, status: 'in_progress' })
      .select()
      .single()
    if (error) throw error
    setSession(data)
    return data
  }

  async function handleLogSet(exercise, setIndex) {
    const current = setsByExercise[exercise.id]?.[setIndex]
    if (!current || current.weight === '' || current.reps === '' || current.weight == null || current.reps == null) return

    try {
      const activeSession = await ensureSession()
      const swappedTo = swaps[exercise.id]?.name || null

      const { data: logRow, error } = await supabase
        .from('exercise_logs')
        .insert({
          session_id: activeSession.id,
          exercise_id: exercise.id,
          exercise_name: swappedTo,
          set_number: setIndex + 1,
          weight: Number(current.weight),
          reps: Number(current.reps),
          is_cardio: !!exercise.isCardio,
        })
        .select()
        .single()
      if (error) throw error

      setSetsByExercise((prev) => {
        const arr = [...(prev[exercise.id] || [])]
        arr[setIndex] = { weight: Number(current.weight), reps: Number(current.reps), completed: true, logId: logRow.id }
        return { ...prev, [exercise.id]: arr }
      })
    } catch (err) {
      console.error('Failed to log set:', err)
      alert('Could not save that set — check Supabase is configured (src/lib/supabase.js).')
    }
  }

  async function handleComplete() {
    setSaving(true)
    try {
      const activeSession = await ensureSession()
      const durationSeconds = getElapsedSeconds(activeSession.started_at)

      const { error } = await supabase
        .from('workout_sessions')
        .update({
          completed_at: new Date().toISOString(),
          status: 'completed',
          duration_seconds: durationSeconds,
          effort,
        })
        .eq('id', activeSession.id)
      if (error) throw error

      const loggedSets = Object.values(setsByExercise).flat().filter((s) => s?.completed)
      const totalVolume = loggedSets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0)

      localStorage.removeItem(storageKey(dayId))
      setSummary({ durationSeconds, setsCompleted: loggedSets.length, totalVolume })
      setSaved(true)
    } catch (err) {
      console.error('Failed to save session:', err)
      alert('Could not save session — check Supabase is configured (src/lib/supabase.js).')
    } finally {
      setSaving(false)
    }
  }

  if (saved && summary) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-10 pb-10 space-y-5 text-center">
        <span className="mx-auto w-16 h-16 rounded-full bg-[var(--color-back)]/12 flex items-center justify-center">
          <Check size={28} className="text-[var(--color-back)]" />
        </span>
        <div>
          <h1 className="font-display font-black text-3xl text-base-100">Workout Complete</h1>
          <p className="text-sm text-base-400 mt-1">{day.name}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-left">
          <StatTile value={formatDuration(summary.durationSeconds)} label="Duration" />
          <StatTile value={summary.setsCompleted} label="Sets completed" />
          <StatTile value={summary.totalVolume.toLocaleString()} unit="lb" label="Total volume" />
        </div>
        <button
          onClick={() => navigate('/')}
          className="w-full accent-gradient text-white font-bold rounded-full py-3.5"
        >
          Back to Home
        </button>
      </div>
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
          <p className="text-base-400 text-sm">{weekMeta.label}</p>
          <h1 className="font-display font-black text-2xl text-base-100">{day.name}</h1>
        </div>
        {session && (
          <span className="card rounded-full px-3 py-1.5 text-xs font-semibold text-base-400 shrink-0">
            {formatDuration(elapsedSeconds)}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {day.exercises.map((ex) => {
          const prescribedSets = ex.isCardio ? 0 : applyDeloadToSets(ex.sets, weekMeta.weekInBlock)
          return (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              prescribedSets={prescribedSets}
              lastLoggedText={ex.isCardio ? null : lastLoggedTextFor(ex.id)}
              sets={setsByExercise[ex.id] || []}
              onSetChange={(setIndex, field, value) => handleSetChange(ex.id, setIndex, field, value)}
              onLogSet={(setIndex) => handleLogSet(ex, setIndex)}
              activeAlt={swaps[ex.id] || null}
              onSwap={(alt) => handleSwap(ex.id, alt)}
            />
          )
        })}
      </div>

      <div className="card rounded-[28px] p-4">
        <EffortTap value={effort} onChange={setEffort} />
      </div>

      <button
        onClick={handleComplete}
        disabled={saving}
        className="w-full accent-gradient text-white font-bold rounded-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {saving ? 'Saving...' : 'Complete Session'}
      </button>
    </div>
  )
}
