import { Check, Clock } from 'lucide-react'
import { SESSIONS_PER_BLOCK } from '@/data/program'
import { getNextQueueDay } from '@/domain/block'
import { formatBlockLabel, formatDuration } from '@/domain/format'
import { fetchBlockState } from '@/services/sessionsApi'
import { useAsyncData } from '@/hooks/useAsyncData'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { ProgressBar } from '@/ui/progress-bar'
import { StatTile } from '@/ui/stat-tile'
import { EffortPicker } from './EffortPicker'
import { ResultLayout } from './ResultLayout'
import { useSessionEffort } from './useSessionEffort'

const EFFORT_STATUS = {
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Not saved — tap Retry above',
}

// Where the block stands after this workout. Counted locally from what the
// screen already knows; "Next up" comes from a fresh block-state read when
// it's available (a partial session leaves the queue where it was), else
// from the queue after this day for a completed one.
function BlockProgressCard({ day, weekMeta, result }) {
  const counted = result.status === 'completed'
  const { data: blockState } = useAsyncData(fetchBlockState)
  const completed = blockState?.completedSessionCount ?? weekMeta.completedSessionCount + (counted ? 1 : 0)
  const nextDay = blockState ? blockState.nextDay : counted ? getNextQueueDay(day.id) : null
  const blockDone = completed >= SESSIONS_PER_BLOCK

  return (
    <section aria-label="Block progress" className="space-y-3 rounded-card border border-accent-border bg-accent p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-title font-extrabold text-accent-deep">{formatBlockLabel(weekMeta.block)}</p>
        <p className="text-body-sm font-semibold text-accent-foreground">
          {completed} of {SESSIONS_PER_BLOCK} sessions
        </p>
      </div>
      <ProgressBar value={completed} max={SESSIONS_PER_BLOCK} label="Block progress" />
      {blockDone ? (
        <p className="text-body-sm font-semibold text-accent-deep">Block complete — every session done.</p>
      ) : (
        nextDay && (
          <p className="text-body-sm text-accent-deep">
            Next up: <span className="font-semibold">{nextDay.shortLabel}</span>
          </p>
        )
      )}
    </section>
  )
}

// result: { sessionId, status, durationSeconds, setsCompleted, totalVolume, sessionRpe }
export function WorkoutCompleteScreen({ day, weekMeta, result, onDone }) {
  const effort = useSessionEffort(result.sessionId, result.sessionRpe ?? null)
  const isPartial = result.status === 'partial'

  return (
    <ResultLayout
      icon={Check}
      title={isPartial ? 'Saved as partial' : 'Workout complete'}
      subtitle={`${day.shortLabel} · Session ${weekMeta.sessionNumber} of ${SESSIONS_PER_BLOCK}`}
    >
      {isPartial && (
        <p className="text-center text-body-sm text-foreground-secondary">
          Your sets are saved, but this won’t count toward the block — {day.shortLabel} stays next.
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <StatTile value={formatDuration(result.durationSeconds)} label="Duration" />
        <StatTile value={result.setsCompleted} label="Sets logged" />
        <StatTile value={result.totalVolume.toLocaleString()} unit="lb" label="Volume" />
      </div>

      <Card className="p-4">
        <EffortPicker value={effort.value} onChange={effort.choose} statusText={EFFORT_STATUS[effort.status]} />
      </Card>

      <BlockProgressCard day={day} weekMeta={weekMeta} result={result} />

      <Button block size="lg" onClick={onDone}>
        Done
      </Button>
    </ResultLayout>
  )
}

export function WorkoutClosedScreen({ onDone }) {
  return (
    <ResultLayout
      icon={Clock}
      tone="muted"
      title="Workout closed"
      subtitle="It was closed automatically after a long break."
    >
      <p className="text-center text-body-sm text-foreground-secondary">Every set you logged is saved in History.</p>
      <Button block size="lg" onClick={onDone}>
        Back to Home
      </Button>
    </ResultLayout>
  )
}

export function BlockCompleteScreen({ block, onDone }) {
  return (
    <ResultLayout icon={Check} title={`${formatBlockLabel(block)} complete`} subtitle={`All ${SESSIONS_PER_BLOCK} sessions are done.`}>
      <p className="text-center text-body-sm text-foreground-secondary">The next block will be built from this data.</p>
      <Button block size="lg" onClick={onDone}>
        Back to Home
      </Button>
    </ResultLayout>
  )
}
