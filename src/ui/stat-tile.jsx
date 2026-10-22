import { cn } from '@/lib/utils'

// Small stat: big Nunito number (+ optional unit) over a muted label.
// tone 'accent' is the coral-tint box used on the Progress exercise card.
export function StatTile({ value, unit, label, tone = 'default', className }) {
  return (
    <div
      className={cn(
        'flex flex-col justify-between gap-1.5 rounded-row-lg p-3.5',
        tone === 'accent' ? 'border border-accent-border bg-accent' : 'border border-border bg-surface',
        className,
      )}
    >
      <p className="flex flex-wrap items-baseline gap-x-1">
        <span className={cn('font-display text-stat font-black whitespace-nowrap tabular-nums', tone === 'accent' ? 'text-accent-deep' : 'text-foreground')}>
          {value}
        </span>
        {unit && <span className="text-caption font-semibold text-muted-foreground">{unit}</span>}
      </p>
      <p className="text-caption font-medium text-muted-foreground">{label}</p>
    </div>
  )
}
