import { useEffect, useMemo, useRef, useState } from 'react'
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
  getSetsVolume,
  getElapsedSeconds,
  afterAutoClose,
  SESSIONS_AUTO_CLOSED_EVENT,
} from '@/data/helpers'
import {
  allLoggedRows as getAllLoggedRows,
  applyRestoredSwaps,
  getFinishAction,
  prefillWeights,
  restoreFromSessionLogs,
} from '@/domain/workoutState'
import { notifyError } from '@/ui/toast'
import { clearDraft, loadDraft, saveDraft } from './workoutDraft'

// Everything the live workout screen does, minus the UI. The screen must be
// remounted per dayId (App keys WorkoutSessionRoute on it), so the draft is
// read once, synchronously, on mount.
//
// Lifecycle (unchanged from Block 01 — see CLAUDE.md "Workout session
// lifecycle"): the workout_sessions row is created lazily on the first saved
// set; set saves are idempotent upserts; last-set difficulty lives on the
// highest logged set; swapping after logging renames that slot's rows;
// finishing under the minimum asks first; an auto-close ends logging.
export function useWorkoutSession(dayId) {
  const day = useMemo(() => findDayById(dayId), [dayId])

  const [initialDraft] = useState(() => loadDraft(dayId))
  const [entries, setEntries] = useState(initialDraft.entries)
  const [swaps, setSwaps] = useState(initialDraft.swaps)
  const [sessionRpe, setSessionRpe] = useState(initialDraft.sessionRpe)

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
        const restored = restoreFromSessionLogs(day, rows)
        setSession(existing)
        setLogs(restored.logs)
        setDifficulties(restored.difficulties)
        setSwaps((prev) => applyRestoredSwaps(prev, restored.swaps))
      }
      setLoaded({
        weekMeta: getCurrentBlockAndWeek(count),
        otherSession: !existing && anyOpen && anyOpen.day_id !== day.id ? anyOpen : null,
        progressionLogs,
        recentCompletedCount,
      })
    }
    load()
    return () => {
      cancelled = true
    }
  }, [day])

  // Persist the draft on every change (until the session is finished).
  useEffect(() => {
    if (result) return
    saveDraft(dayId, { entries, swaps, sessionRpe })
  }, [dayId, entries, swaps, sessionRpe, result])

  // If the foreground auto-close check closes this session, stop logging.
  useEffect(() => {
    function handleAutoClosed(e) {
      if (session && e.detail.sessionIds.includes(session.id)) {
        clearDraft(dayId)
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

  const loggedRows = getAllLoggedRows(logs)
  const loggedCount = loggedRows.length
  const locked = !!result || finishing

  function activeNameFor(ex) {
    return swaps[ex.id]?.name ?? ex.name
  }

  function prefillWeightsFor(ex, rowCount) {
    return prefillWeights({ logsBySet: logs[ex.id] || {}, prefillWeight: suggestions[ex.id]?.prefillWeight, rowCount })
  }

  function setEntry(exerciseId, index, value) {
    setEntries((prev) => {
      const arr = [...(prev[exerciseId] || [])]
      arr[index] = value
      return { ...prev, [exerciseId]: arr }
    })
  }

  function changeEntry(exerciseId, index, field, value) {
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
      sessionPromiseRef.current = createSession(day.id, loaded.weekMeta.weekInBlock)
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
  // Resolves true on success.
  async function logSet(ex, index, values) {
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

  // Resolves true on success.
  async function removeSet(ex, row) {
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

  async function setDifficulty(ex, value) {
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
  async function swapExercise(ex, alt) {
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

  // The Finish tap (see getFinishAction).
  function requestFinish() {
    const action = getFinishAction(loggedCount, !!session)
    if (action === 'confirm') setConfirmingFinish(true)
    else if (action === 'finish') finish(true)
  }

  async function finish(countAsWorkout) {
    setFinishing(true)
    try {
      const row = await finishSession(session.id, { sessionRpe, countAsWorkout })
      clearDraft(dayId)
      if (!row) {
        setResult({ kind: 'auto-closed' })
        return
      }
      setResult({
        kind: 'finished',
        status: row.status,
        durationSeconds: row.duration_seconds ?? 0,
        setsCompleted: loggedRows.length,
        totalVolume: getSetsVolume(loggedRows),
      })
    } catch (err) {
      console.error('Failed to finish session:', err)
      notifyError('Could not finish the workout — check your connection and try again.')
    } finally {
      setFinishing(false)
      setConfirmingFinish(false)
    }
  }

  function cancelFinish() {
    setConfirmingFinish(false)
  }

  return {
    day,
    ready: !!loaded,
    weekMeta: loaded?.weekMeta ?? null,
    otherSession: loaded?.otherSession ?? null,
    session,
    logs,
    entries,
    swaps,
    difficulties,
    savingSets,
    sessionRpe,
    suggestions,
    result,
    finishing,
    confirmingFinish,
    elapsedSeconds,
    loggedCount,
    locked,
    activeNameFor,
    prefillWeightsFor,
    changeEntry,
    logSet,
    removeSet,
    setDifficulty,
    swapExercise,
    setSessionRpe,
    requestFinish,
    finish,
    cancelFinish,
  }
}
