import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardLabel, CardTitle } from '@/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { StatTile } from '@/ui/stat-tile'
import { bestTopSet, exerciseSessions, sessionDateLabel, topSetText } from './progressMath'
import { TopSetChart } from './TopSetChart'

// One exercise's history: best top set, latest estimated 1RM, the top-set
// chart, and session chips to drill into a session. Keyed by name by the
// parent so the selected session resets when the exercise changes.
function ExerciseHistory({ logs, name }) {
  const sessions = useMemo(
    () => exerciseSessions(logs, name).map((s) => ({ ...s, label: sessionDateLabel(s) })),
    [logs, name],
  )
  const [selectedId, setSelectedId] = useState(null)
  const latest = sessions.at(-1)
  const selected = sessions.find((s) => s.sessionId === selectedId) ?? latest
  const best = bestTopSet(sessions)

  if (!latest) return <p className="text-body-sm text-muted-foreground">No sets logged for this exercise yet.</p>

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <StatTile tone="accent" value={`${best.top.weight} × ${best.top.reps}`} unit="lb" label="Best top set" />
        <StatTile tone="accent" value={latest.estimated1RM} unit="lb" label="Est. 1-rep max" />
      </div>

      <figure className="space-y-2">
        <TopSetChart sessions={sessions} selectedId={selected.sessionId} onSelect={setSelectedId} />
        <figcaption className="text-body-sm text-foreground-secondary">{topSetText(sessions)}</figcaption>
      </figure>

      <div className="space-y-2">
        <CardLabel id="session-chips-label">Sessions</CardLabel>
        <div role="group" aria-labelledby="session-chips-label" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {sessions.map((s) => {
            const isSelected = s.sessionId === selected.sessionId
            return (
              <button
                key={s.sessionId}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedId(s.sessionId)}
                className={cn(
                  'focus-ring min-h-tap shrink-0 rounded-full px-4 text-body-sm font-semibold whitespace-nowrap transition-colors',
                  isSelected ? 'bg-nav text-nav-foreground' : 'bg-surface-muted text-foreground-secondary',
                )}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      <section aria-label={`${name}, ${selected.label}`} className="rounded-row-lg border border-border p-4">
        <div className="flex items-baseline justify-between">
          <p className="font-display text-title font-extrabold text-foreground">{selected.label}</p>
          <p className="text-caption text-muted-foreground">
            {selected.sessionId === latest.sessionId ? 'Most recent' : 'Selected'}
          </p>
        </div>
        <ul className="mt-2 space-y-1">
          {selected.sets.map((set) => (
            <li key={set.id ?? set.set_number} className="flex justify-between text-body-sm">
              <span className="text-muted-foreground">Set {set.set_number}</span>
              <span className="font-semibold text-foreground tabular-nums">
                {set.weight} lb × {set.reps}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-border pt-3 text-body-sm">
          <span className="text-muted-foreground">
            Est. 1-rep max <span className="font-semibold text-foreground">{selected.estimated1RM} lb</span>
          </span>
          <span className="text-muted-foreground">
            Volume <span className="font-semibold text-foreground">{selected.volume.toLocaleString()} lb</span>
          </span>
        </div>
      </section>
    </>
  )
}

// names: progressExerciseNames() (most recent first, pilot-only hidden).
export function ExerciseProgressCard({ logs, names }) {
  const [name, setName] = useState(names[0])
  const current = names.includes(name) ? name : names[0]
  return (
    <Card as="section" aria-labelledby="exercise-progress-title" className="space-y-4">
      <CardTitle id="exercise-progress-title">Lifts</CardTitle>
      <Select value={current} onValueChange={setName}>
        <SelectTrigger aria-label="Exercise">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {names.map((n) => (
            <SelectItem key={n} value={n}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ExerciseHistory key={current} logs={logs} name={current} />
    </Card>
  )
}
