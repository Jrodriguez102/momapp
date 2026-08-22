import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { findExerciseById, getBodyWeightLogs } from '../data/helpers'
import BodyWeightPanel from '../components/BodyWeightPanel'
import ExerciseProgressPanel from '../components/ExerciseProgressPanel'

export default function Progress() {
  const [exerciseLogs, setExerciseLogs] = useState([])
  const [bodyWeightLogs, setBodyWeightLogs] = useState([])
  const [selectedExerciseId, setSelectedExerciseId] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('exercise_logs')
          .select('*')
          .eq('is_cardio', false)
          .order('logged_at', { ascending: true })
        if (!error && data) setExerciseLogs(data)
      } catch {
        // Supabase not configured yet.
      }
      setBodyWeightLogs(await getBodyWeightLogs())
    }
    load()
  }, [])

  // Any exercise that's actually been logged — never a fixed "key lifts"
  // list, so this stays accurate as program.js changes.
  const loggedExercises = useMemo(() => {
    const ids = [...new Set(exerciseLogs.map((log) => log.exercise_id))]
    return ids.map((id) => ({ id, name: findExerciseById(id)?.name || id }))
  }, [exerciseLogs])

  useEffect(() => {
    if (!selectedExerciseId && loggedExercises.length) {
      setSelectedExerciseId(loggedExercises[0].id)
    }
  }, [loggedExercises, selectedExerciseId])

  async function refreshBodyWeight() {
    setBodyWeightLogs(await getBodyWeightLogs())
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-4 space-y-6">
      <h1 className="font-display font-black text-3xl text-base-100">Progress</h1>

      <div>
        <p className="text-xs font-semibold text-base-400 mb-2 uppercase tracking-wide">Body Weight</p>
        <BodyWeightPanel logs={bodyWeightLogs} onLogged={refreshBodyWeight} />
      </div>

      <div>
        <p className="text-xs font-semibold text-base-400 mb-2 uppercase tracking-wide">Exercise Progress</p>
        {loggedExercises.length === 0 ? (
          <div className="card rounded-[28px] p-6 text-center text-sm text-base-400">
            No sessions logged yet — trends will show up here once workouts are completed.
          </div>
        ) : (
          <ExerciseProgressPanel
            exercises={loggedExercises}
            exerciseLogs={exerciseLogs}
            selectedExerciseId={selectedExerciseId}
            onSelectExercise={setSelectedExerciseId}
          />
        )}
      </div>
    </div>
  )
}
