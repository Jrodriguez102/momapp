import { useState } from 'react'
import { Plus, Scale } from 'lucide-react'
import { isWeighInDue } from '@/domain/calendar'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Card, CardTitle } from '@/ui/card'
import { EmptyState } from '@/ui/empty-state'
import { SegmentedControl } from '@/ui/segmented-control'
import { LogWeightSheet } from './LogWeightSheet'
import { TIMEFRAMES, bodyWeightSummary, bodyWeightText, formatDelta } from './progressMath'
import { WeightChart } from './WeightChart'

const RANGE_LABEL = { '1m': 'last month', '3m': 'last 3 months', '6m': 'last 6 months', all: 'all time' }

const chartLabel = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

// Current weight, the change over the chosen timeframe (neutral — no
// good/bad color either way), the trend chart and "Log weight".
// logs: body_weight_logs oldest first; onLogged: refetch after a save.
export function BodyWeightCard({ logs, onLogged, now }) {
  const [timeframe, setTimeframe] = useState('3m')
  const [logging, setLogging] = useState(false)
  const summary = bodyWeightSummary(logs, timeframe, now)
  const { current, inRange, delta } = summary
  const due = current && isWeighInDue(current.logged_at, now)
  const daysSince = current ? Math.floor((now.getTime() - new Date(current.logged_at).getTime()) / 86_400_000) : null
  const text = bodyWeightText(summary, timeframe)

  const logButton = (
    <Button variant="outline" size="sm" onClick={() => setLogging(true)}>
      <Plus /> Log weight
    </Button>
  )

  return (
    <Card as="section" aria-labelledby="body-weight-title" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <CardTitle id="body-weight-title">Body weight</CardTitle>
        {current && logButton}
      </div>

      {!current ? (
        <EmptyState
          icon={Scale}
          title="No weigh-ins yet"
          description="Log one to start your trend."
          action={logButton}
          className="border-0 p-0 py-2"
        />
      ) : (
        <>
          <div>
            <p className="flex items-baseline gap-1.5">
              <span className="font-display text-hero font-black text-foreground tabular-nums">{current.weight}</span>
              <span className="text-body font-semibold text-muted-foreground">lb</span>
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {delta !== null && <Badge variant="accent">{formatDelta(delta)}</Badge>}
              {delta !== null && <span className="text-caption text-muted-foreground">{RANGE_LABEL[timeframe]}</span>}
            </div>
            {due && (
              <p className="mt-2 text-body-sm font-semibold text-accent-foreground">
                It’s been {daysSince} days — time for a weigh-in.
              </p>
            )}
          </div>

          <figure className="space-y-2">
            {inRange.length >= 1 && <WeightChart points={inRange.map((l) => ({ label: chartLabel(l.logged_at), weight: l.weight }))} />}
            {/* Non-breaking hyphen so "weigh-ins" never splits across lines. */}
            <figcaption className="text-body-sm text-foreground-secondary">{text.replace(/weigh-in/g, 'weigh\u2011in')}</figcaption>
          </figure>

          <SegmentedControl label="Body-weight timeframe" options={TIMEFRAMES} value={timeframe} onChange={setTimeframe} />
        </>
      )}

      <LogWeightSheet open={logging} onOpenChange={setLogging} onLogged={onLogged} />
    </Card>
  )
}
