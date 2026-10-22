import { ArrowLeft } from 'lucide-react'
import { formatDuration } from '@/domain/format'
import { IconButton } from '@/ui/icon-button'
import { ProgressBar } from '@/ui/progress-bar'

// Sticky top of the workout: back, day + session/week, timer, and progress.
export function WorkoutTopBar({ day, weekMeta, elapsedSeconds, loggedCount, totalSets, onBack }) {
  const percent = totalSets > 0 ? Math.min(100, Math.round((loggedCount / totalSets) * 100)) : 0
  return (
    <header className="sticky top-0 z-20 -mx-gutter-tight space-y-3 bg-background/95 px-gutter-tight pt-3 pb-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <IconButton label="Back to Home" variant="ghost" className="-ml-2 text-foreground" onClick={onBack}>
          <ArrowLeft />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-heading font-black text-foreground">{day.shortLabel}</h1>
          <p className="text-caption text-muted-foreground">
            Session {weekMeta.sessionNumber} · Week {weekMeta.weekInBlock}
            {weekMeta.weekType === 'deload' && ' · Deload'}
          </p>
        </div>
        <span
          role="timer"
          aria-label="Workout time"
          className="flex min-h-9 shrink-0 items-center rounded-full bg-nav px-3.5 text-body-sm font-bold text-nav-foreground tabular-nums"
        >
          {formatDuration(elapsedSeconds)}
        </span>
      </div>
      <div className="space-y-1.5">
        <p className="flex justify-between text-caption font-semibold text-foreground-secondary">
          <span>
            {loggedCount} of {totalSets} sets
          </span>
          <span>{percent}%</span>
        </p>
        <ProgressBar value={loggedCount} max={totalSets} label="Workout progress" />
      </div>
    </header>
  )
}
