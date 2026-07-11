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

  const [setsByExercise, setSetsByExercise] = useState({})
  const [effort, setEffort] = useState(null)
  const [pastLogs, setPastLogs] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Restore in-progress state from sessionStorage (survives tab switches).
  useEffect(() => {
    const raw = sessionStorage.getItem(storageKey(dayId))
    if (raw) {
      const parsed = JSON.parse(raw)
      setSetsByExercise(parsed.setsByExercise || {})
      setEffort(parsed.effort || null)
    }
  }, [dayId])

  // Persist to sessionStorage on every change.
  useEffect(() => {
    sessionStorage.setItem(storageKey(dayId), JSON.stringify({ setsByExercise, effort }))
  }, [dayId, setsByExercise, effort])

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

  function lastLoggedTextFor(exerciseId) {
    const last = getLastLoggedSet(pastLogs, exerciseId)
    if (!last) return null
    return `${last.weight ?? '—'}${last.weight_unit || 'lb'} x ${last.reps ?? '—'} @ RPE ${last.rpe ?? '—'}`
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
        sets.forEach((set, i) => {
          if (!set) return
          rows.push({
            session_id: session.id,
            exercise_id: ex.id,
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

      sessionStorage.removeItem(storageKey(dayId))
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
