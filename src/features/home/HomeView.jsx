import { USER_NAME, SESSIONS_PER_BLOCK, WEEKS_PER_BLOCK } from '@/data/program'
import { formatBlockLabel, getGreeting } from '@/domain/format'
import { Badge } from '@/ui/badge'
import { Page } from '@/ui/page'
import { PageHeader } from '@/ui/page-header'
import { QuoteCard } from '@/ui/quote-card'
import { StatTile } from '@/ui/stat-tile'
import { TodayHero } from './TodayHero'
import { ChooseDaySheet } from './ChooseDaySheet'
import { WeekCard } from './WeekCard'

function blockChipLabel(blockState) {
  const block = formatBlockLabel(blockState.block)
  if (blockState.isBlockComplete) return `${block} · Complete`
  const week = `Week ${blockState.weekInBlock} of ${WEEKS_PER_BLOCK}`
  return blockState.weekType === 'deload' ? `${block} · ${week} · Deload` : `${block} · ${week}`
}

// Home, rendered from already-loaded data (see HomePage for loading).
// now: the current time (injected so fixtures render a fixed day).
export function HomeView({ blockState, trainingWeek, monthCount, streak, inProgressSession, now, quote, onStart }) {
  const trainedToday = trainingWeek.days.some((d) => d.isToday && d.status === 'completed')
  const showChooseDay = !inProgressSession && !blockState.isBlockComplete

  return (
    <Page>
      <PageHeader
        eyebrow={now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        title={`${getGreeting(now)}, ${USER_NAME}`}
      >
        <Badge variant="accent">{blockChipLabel(blockState)}</Badge>
      </PageHeader>

      <QuoteCard>{quote}</QuoteCard>

      <div className="space-y-2">
        <TodayHero blockState={blockState} inProgressSession={inProgressSession} trainedToday={trainedToday} onStart={onStart} />
        {showChooseDay && <ChooseDaySheet nextDay={blockState.nextDay} onStart={onStart} />}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile value={monthCount} unit={monthCount === 1 ? 'workout' : 'workouts'} label="This month" />
        <StatTile value={streak} unit={streak === 1 ? 'week' : 'weeks'} label="Streak" />
        <StatTile value={`${blockState.completedSessionCount}/${SESSIONS_PER_BLOCK}`} label="Block" />
      </div>

      <WeekCard trainingWeek={trainingWeek} blockState={blockState} inProgressDayId={inProgressSession?.day_id ?? null} />
    </Page>
  )
}
