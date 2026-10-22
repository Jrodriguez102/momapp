import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame } from 'lucide-react'
import { USER_NAME, CURRENT_BLOCK, SESSIONS_PER_BLOCK } from '../data/program'
import { getGreeting } from '../data/helpers'
import { getDailyQuote } from '../data/quotes'
import {
  fetchBlockState,
  fetchTrainingWeek,
  fetchWorkoutsThisMonth,
  fetchWeeklyStreak,
  fetchAnyInProgressSession,
} from '@/services/sessionsApi'
import { fetchWeighInDue } from '@/services/bodyWeightApi'
import { useAsyncData } from '@/hooks/useAsyncData'
import { LoadingState } from '@/ui/skeleton'
import { ErrorState } from '@/ui/error-state'
import TodayWorkoutCard from '../components/TodayWorkoutCard'
import StatTile from '../components/StatTile'
import WeekStrip from '../components/WeekStrip'
import WeighInCard from '../components/WeighInCard'

// "Not now" on the weigh-in card hides it for the rest of the day
// (per-device convenience only).
const WEIGH_IN_DISMISS_KEY = `block${CURRENT_BLOCK}:weigh-in-dismissed`

function isWeighInDismissedToday() {
  try {
    return localStorage.getItem(WEIGH_IN_DISMISS_KEY) === new Date().toDateString()
  } catch {
    return false
  }
}

async function loadHome() {
  const [blockState, trainingWeek, monthCount, streak, inProgressSession, weighInDue] = await Promise.all([
    fetchBlockState(),
    fetchTrainingWeek(),
    fetchWorkoutsThisMonth(),
    fetchWeeklyStreak(),
    fetchAnyInProgressSession(),
    // A failed weigh-in check shouldn't block Home (or nag).
    fetchWeighInDue().catch(() => false),
  ])
  return { blockState, trainingWeek, monthCount, streak, inProgressSession, weighInDue }
}

export default function Dashboard() {
  const navigate = useNavigate()
  // Always after the auto-close check, so a forgotten session is closed and
  // counted before the queue / block / week are computed; a foreground
  // auto-close changes the queue/stats, so reload when it happens.
  const { status, data, reload } = useAsyncData(loadHome, { waitForAutoClose: true, reloadOnAutoClose: true })
  const [weighInHidden, setWeighInHidden] = useState(isWeighInDismissedToday)

  if (status === 'loading' || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-4">
        {status === 'loading' ? <LoadingState label="Loading your week…" /> : <ErrorState onRetry={reload} />}
      </div>
    )
  }
  const { blockState, trainingWeek, monthCount, streak, inProgressSession } = data
  const showWeighIn = data.weighInDue && !weighInHidden
  const today = new Date()
  const trainedToday = trainingWeek.days.some((d) => d.isToday && d.status === 'completed')

  function dismissWeighIn() {
    try {
      localStorage.setItem(WEIGH_IN_DISMISS_KEY, new Date().toDateString())
    } catch {
      // storage unavailable — just hide it for this visit
    }
    setWeighInHidden(true)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-4 space-y-5">
      <div>
        <h1 className="font-display font-black text-4xl leading-[1.05] text-base-100">
          {getGreeting()}, {USER_NAME}
        </h1>
        <p className="text-xs text-base-400 mt-2">
          {today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <p className="text-xs text-base-400 italic mt-1">{getDailyQuote()}</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-base-400 card rounded-full px-3 py-1.5">
          Block {blockState.block} · {blockState.label}
          {!blockState.isBlockComplete && ` · Session ${blockState.sessionNumber}/${SESSIONS_PER_BLOCK}`}
        </span>
        {blockState.weekType === 'deload' && !blockState.isBlockComplete && (
          <span className="flex items-center gap-1 text-xs font-medium text-accent-end card rounded-full px-3 py-1.5">
            <Flame size={12} /> Deload week
          </span>
        )}
      </div>

      <TodayWorkoutCard
        blockState={blockState}
        inProgressSession={inProgressSession}
        trainedToday={trainedToday}
        onStart={(dayId) => navigate(`/session/${dayId}`)}
      />

      {showWeighIn && <WeighInCard onSaved={() => setWeighInHidden(true)} onDismiss={dismissWeighIn} />}

      <div className="grid grid-cols-3 gap-2">
        <StatTile value={monthCount} label="Workouts this month" dotColor="var(--color-base-400)" />
        <StatTile
          value={streak}
          unit={streak === 1 ? 'week' : 'weeks'}
          label="Current streak"
          dotColor="var(--color-back)"
        />
        <StatTile
          value={`${trainingWeek.completedCount}/${trainingWeek.plannedCount}`}
          label="Training days this week"
          dotColor="var(--color-accent-start)"
        />
      </div>

      <div>
        <p className="text-xs font-medium text-base-400 mb-2">This week</p>
        <WeekStrip days={trainingWeek.days} />
      </div>
    </div>
  )
}
