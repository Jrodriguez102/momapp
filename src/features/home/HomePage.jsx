import { useNavigate } from 'react-router-dom'
import { getDailyQuote } from '@/data/quotes'
import {
  fetchAnyInProgressSession,
  fetchBlockState,
  fetchTrainingWeek,
  fetchWeeklyStreak,
  fetchWorkoutsThisMonth,
} from '@/services/sessionsApi'
import { useAsyncData } from '@/hooks/useAsyncData'
import { ErrorState } from '@/ui/error-state'
import { Page } from '@/ui/page'
import { LoadingState } from '@/ui/skeleton'
import { HomeView } from './HomeView'

async function loadHome() {
  const [blockState, trainingWeek, monthCount, streak, inProgressSession] = await Promise.all([
    fetchBlockState(),
    fetchTrainingWeek(),
    fetchWorkoutsThisMonth(),
    fetchWeeklyStreak(),
    fetchAnyInProgressSession(),
  ])
  return { blockState, trainingWeek, monthCount, streak, inProgressSession }
}

export default function HomePage() {
  const navigate = useNavigate()
  // Always after the auto-close check, so a forgotten session is closed and
  // counted before the queue / block / week are computed; a foreground
  // auto-close changes the queue/stats, so reload when it happens.
  const { status, data, reload } = useAsyncData(loadHome, { waitForAutoClose: true, reloadOnAutoClose: true })

  if (!data) {
    return <Page>{status === 'loading' ? <LoadingState label="Loading your week…" /> : <ErrorState onRetry={reload} />}</Page>
  }
  return <HomeView {...data} now={new Date()} quote={getDailyQuote()} onStart={(dayId) => navigate(`/session/${dayId}`)} />
}
