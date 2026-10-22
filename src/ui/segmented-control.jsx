import { cn } from '@/lib/utils'

// Single-choice filter (All / This week / This month, 1M / 3M / 6M / All).
// Muted track, selected option is the dark pill. Buttons with aria-pressed
// inside a labelled group; `label` names the group for screen readers.
// options: [{ value, label }]
export function SegmentedControl({ options, value, onChange, label, className }) {
  return (
    <div role="group" aria-label={label} className={cn('flex gap-1 rounded-full bg-surface-muted p-1', className)}>
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              'focus-ring min-h-tap flex-1 rounded-full px-3 text-body-sm font-semibold transition-colors',
              selected ? 'bg-nav text-nav-foreground' : 'text-foreground-secondary hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
