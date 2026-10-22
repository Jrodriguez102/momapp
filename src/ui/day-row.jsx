import { Fragment } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/ui/badge'

// One day in a week list: weekday + date on the left, a title and a muted
// detail line in the middle, a status marker on the right.
//   completed — green tint, green check circle
//   today     — coral tint, 1.5px coral border, "Today" badge (or todayLabel)
//   upcoming  — white, dashed circle
//   missed    — muted, "Missed"
// Status is also spelled out for screen readers.
const ROW_STYLES = {
  completed: 'border border-success-border bg-success-tint',
  today: 'border-[1.5px] border-primary bg-accent',
  upcoming: 'border border-border bg-surface',
  missed: 'border border-transparent bg-surface-muted',
}

// detail: a string, or a list of parts joined with " · " that each stay on
// one line. It wraps to at most two lines rather than cutting names mid-word.
export function DayRow({ weekday, dateNumber, title, detail, status, todayLabel = 'Today', className }) {
  const muted = status === 'missed'
  return (
    <div className={cn('flex min-h-input items-center gap-3 rounded-row-lg px-3 py-2.5', ROW_STYLES[status], className)}>
      <div className="flex w-10 shrink-0 flex-col items-center">
        <span className="text-caption font-semibold text-muted-foreground uppercase">{weekday}</span>
        <span className={cn('font-display text-title font-black', muted ? 'text-muted-foreground' : 'text-foreground')}>{dateNumber}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate font-display text-title font-extrabold', muted ? 'text-muted-foreground' : 'text-foreground')}>{title}</p>
        {detail && (
          <p className="line-clamp-2 text-caption text-muted-foreground">
            {Array.isArray(detail)
              ? detail.map((part, i) => (
                  <Fragment key={part}>
                    {i > 0 && ' · '}
                    <span className="whitespace-nowrap">{part}</span>
                  </Fragment>
                ))
              : detail}
          </p>
        )}
      </div>
      <DayStatus status={status} todayLabel={todayLabel} />
    </div>
  )
}

function DayStatus({ status, todayLabel }) {
  if (status === 'completed') {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success text-primary-foreground">
        <Check aria-hidden="true" className="size-4" strokeWidth={3} />
        <span className="sr-only">Completed</span>
      </span>
    )
  }
  if (status === 'today') return <Badge variant="today">{todayLabel}</Badge>
  if (status === 'missed') return <span className="shrink-0 text-caption font-semibold text-muted-foreground">Missed</span>
  return (
    <span className="size-8 shrink-0 rounded-full border-2 border-dashed border-border-strong">
      <span className="sr-only">Upcoming</span>
    </span>
  )
}
