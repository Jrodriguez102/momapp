import { useEffect, useMemo, useState } from 'react'
import { getBodyWeightLogs } from '../data/helpers'
import { fetchAllStrengthLogs } from '@/services/setsApi'
import { fetchBodyWeightLogs } from '@/services/bodyWeightApi'
import { useAsyncData } from '@/hooks/useAsyncData'
import { LoadingState } from '@/ui/skeleton'
import { ErrorState } from '@/ui/error-state'
import BodyWeightPanel from '../components/BodyWeightPanel'
import ExerciseProgressPanel from '../components/ExerciseProgressPanel'

const NO_LOGS = []

async function loadProgress() {
  const [exerciseLogs, bodyWeightLogs] = await Promise.all([fetchAllStrengthLogs(), fetchBodyWeightLogs()])
  return { exerciseLogs, bodyWeightLogs }
}

export default function Progress() {
  // After the auto-close check, so a just-closed session's sets are counted.
  const { status, data, reload, setData } = useAsyncData(loadProgress, { waitForAutoClose: true })
  const exerciseLogs = data?.exerciseLogs ?? NO_LOGS
  const [selectedExerciseId, setSelectedExerciseId] = useState(null)

  // Any exercise that's actually been logged — never a fixed "key lifts"
  // list, so this stays accurate as program.js changes.
  const loggedExercises = useMemo(() => {
    // Keyed by exercise_name: ids changed between the pilot and Block 01,
    // names didn't, so this keeps one history per movement.
    const names = [...new Set(exerciseLogs.map((log) => log.exercise_name).filter(Boolean))]
    return names.map((name) => ({ id: name, name }))
  }, [exerciseLogs])

  useEffect(() => {
    if (!selectedExerciseId && loggedExercises.length) {
      setSelectedExerciseId(loggedExercises[0].id)
    }
  }, [loggedExercises, selectedExerciseId])

  async function refreshBodyWeight() {
    const bodyWeightLogs = await getBodyWeightLogs()
    setData((prev) => ({ ...prev, bodyWeightLogs }))
  }

  if (status === 'loading' || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-4">
        {status === 'loading' ? <LoadingState label="Loading your progress…" /> : <ErrorState onRetry={reload} />}
      </div>
    )
  }
  const { bodyWeightLogs } = data

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
