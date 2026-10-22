import { useMemo } from 'react'
import { Dumbbell } from 'lucide-react'
import { getBodyWeightLogs } from '@/data/helpers'
import { fetchBodyWeightLogs } from '@/services/bodyWeightApi'
import { fetchAllStrengthLogs } from '@/services/setsApi'
import { useAsyncData } from '@/hooks/useAsyncData'
import { EmptyState } from '@/ui/empty-state'
import { ErrorState } from '@/ui/error-state'
import { Page } from '@/ui/page'
import { PageHeader } from '@/ui/page-header'
import { LoadingState } from '@/ui/skeleton'
import { BodyWeightCard } from './BodyWeightCard'
import { ExerciseProgressCard } from './ExerciseProgressCard'
import { progressExerciseNames } from './progressMath'

async function loadProgress() {
  const [exerciseLogs, bodyWeightLogs] = await Promise.all([fetchAllStrengthLogs(), fetchBodyWeightLogs()])
  return { exerciseLogs, bodyWeightLogs }
}

const NO_LOGS = []

export default function ProgressPage() {
  // After the auto-close check, so a just-closed session's sets are counted.
  const { status, data, reload, setData } = useAsyncData(loadProgress, { waitForAutoClose: true })
  const exerciseLogs = data?.exerciseLogs ?? NO_LOGS
  const names = useMemo(() => progressExerciseNames(exerciseLogs), [exerciseLogs])
  const now = new Date()

  async function refreshBodyWeight() {
    const bodyWeightLogs = await getBodyWeightLogs()
    setData((prev) => ({ ...prev, bodyWeightLogs }))
  }

  return (
    <Page>
      <PageHeader title="Progress" />
      {!data ? (
        status === 'loading' ? <LoadingState label="Loading your progress…" /> : <ErrorState onRetry={reload} />
      ) : (
        <>
          <BodyWeightCard logs={data.bodyWeightLogs} onLogged={refreshBodyWeight} now={now} />
          {names.length ? (
            <ExerciseProgressCard logs={exerciseLogs} names={names} />
          ) : (
            <EmptyState icon={Dumbbell} title="No lifts logged yet" description="Your top sets and trends show up here after your first workout." />
          )}
        </>
      )}
    </Page>
  )
}
