import { cn } from '@/lib/utils'

// Single-select tap chips with aria-pressed (last-set difficulty, the 1-10
// effort grid). Tapping the selected chip clears it unless allowDeselect is
// false. Each option can carry a second line (`detail`), e.g.
// "Easy" / "3+ left". Layout comes from `className` (grid columns).
// options: [{ value, label, detail? }]
export function ChoiceChips({ options, value, onChange, label, disabled, allowDeselect = true, className, chipClassName }) {
  return (
    <div role="group" aria-label={label} className={cn('grid grid-cols-3 gap-2', className)}>
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(selected && allowDeselect ? null : opt.value)}
            className={cn(
              'focus-ring flex min-h-tap flex-col items-center justify-center rounded-row px-2 py-2 text-center transition-colors disabled:opacity-50',
              selected
                ? 'bg-gradient-primary text-primary-foreground'
                : 'border border-border bg-surface text-foreground hover:bg-surface-muted',
              chipClassName,
            )}
          >
            <span className="text-body-sm font-bold">{opt.label}</span>
            {opt.detail && (
              <span className={cn('text-caption', selected ? 'text-primary-foreground' : 'text-muted-foreground')}>{opt.detail}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
