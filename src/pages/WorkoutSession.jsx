import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { findDayById, getCurrentBlockAndWeek, getCompletedSessionCount, getLastLoggedSet } from '../data/helpers'
import { applyDeloadToSets } from '../data/program'
import ExerciseCard from '../components/ExerciseCard'
import EffortTap from '../components/EffortTap'
import { supabase } from '../lib/supabase'

function storageKey(dayId) {
  return `session-in-progress-${dayId}`
}

// Persisted to localStorage rather than sessionStorage: sessionStorage is
// tied to the browsing session and mobile browsers (iOS Safari in
// particular) will readily discard it when the app is backgrounded and the
// OS reclaims memory — exactly the "switch tabs, lose my sets" scenario.
// localStorage survives that.
function loadStoredSession(dayId) {
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

  // Fetched fresh on entry (not cached/passed from Dashboard) so weekMeta
  // here is always correct even if she completes a session, backs out, and
  // starts another in the same visit.
  useEffect(() => {
    let cancelled = false
    async function loadWeek() {
      const count = await getCompletedSessionCount()
      if (!cancelled) setWeekMeta(getCurrentBlockAndWeek(count))
    }
    loadWeek()
    return () => { cancelled = true }
  }, [])

  // Lazy initializers read straight from storage on mount. This component
  // is remounted (via the `key={dayId}` wrapper in App.jsx) any time the
  // session day changes, so this is always correct — no separate restore
  // effect needed, which avoids a real race where a same-tick persist
  // effect would overwrite the just-loaded data with empty defaults before
  // React re-rendered with it.
  const initial = useMemo(() => loadStoredSession(dayId), [dayId])
  const [setsByExercise, setSetsByExercise] = useState(initial.setsByExercise)
  const [effort, setEffort] = useState(initial.effort)
  const [swaps, setSwaps] = useState(initial.swaps)
  const [pastLogs, setPastLogs] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Persist on every change.
  useEffect(() => {
    localStorage.setItem(storageKey(dayId), JSON.stringify({ setsByExercise, effort, swaps }))
  }, [dayId, setsByExercise, effort, swaps])

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

  if (!weekMeta) return null

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

  async function handleComplete() {
    setSaving(true)
    try {
      const { data: session, error: sessionError } = await supabase
        .from('workout_sessions')
        .insert({
          day_id: day.id,
          block: weekMeta.block,
          week_in_block: weekMeta.weekInBlock,
          completed_at: new Date().toISOString(),
          effort,
        })
        .select()
        .single()

      if (sessionError) throw sessionError

      const rows = []
      for (const ex of day.exercises) {
        const sets = setsByExercise[ex.id] || []
        const swappedTo = swaps[ex.id]?.name || null
        sets.forEach((set, i) => {
          if (!set) return
          rows.push({
            session_id: session.id,
            exercise_id: ex.id,
            exercise_name: swappedTo,
            set_number: i + 1,
            weight: set.weight ? Number(set.weight) : null,
            reps: set.reps ? Number(set.reps) : null,
            rpe: set.rpe ? Number(set.rpe) : null,
            is_cardio: !!ex.isCardio,
          })
        })
      }
      if (rows.length) {
        const { error: logsError } = await supabase.from('exercise_logs').insert(rows)
        if (logsError) throw logsError
      }

      localStorage.removeItem(storageKey(dayId))
      setSaved(true)
      setTimeout(() => navigate('/'), 1200)
    } catch (err) {
      console.error('Failed to save session:', err)
      alert('Could not save session — check Supabase is configured (src/lib/supabase.js).')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-10 space-y-4">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1 text-sm text-base-400 hover:text-base-100 transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div>
        <p className="text-base-400 text-sm">{weekMeta.label}</p>
        <h1 className="font-display text-2xl text-base-100">{day.name}</h1>
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
              activeAlt={swaps[ex.id] || null}
              onSwap={(alt) => handleSwap(ex.id, alt)}
            />
          )
        })}
      </div>

      <div className="glass rounded-2xl p-4">
        <EffortTap value={effort} onChange={setEffort} />
      </div>

      <button
        onClick={handleComplete}
        disabled={saving || saved}
        className="w-full accent-gradient text-base-950 font-semibold rounded-2xl py-3.5 flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {saved ? (
          <>
            <Check size={18} /> Saved
          </>
        ) : saving ? (
          'Saving...'
        ) : (
          'Complete Session'
        )}
      </button>
    </div>
  )
}
