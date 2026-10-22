import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

// Weight / reps / body-weight entry. 52px tall with 20px text so iOS
// Safari never zooms on focus (it zooms below 16px). `active` gives the
// 2px coral border used on the set being entered. `label` is required —
// set rows have a visual column header, not a <label>, so it becomes the
// accessible name.
export const NumberInput = forwardRef(function NumberInput(
  { label, active = false, decimal = true, className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type="number"
      inputMode={decimal ? 'decimal' : 'numeric'}
      step={decimal ? 'any' : 1}
      aria-label={label}
      className={cn(
        'h-input w-full min-w-0 rounded-row border-2 bg-surface px-3 text-center font-body text-input font-semibold text-foreground tabular-nums outline-none transition-colors',
        'placeholder:text-body placeholder:font-normal placeholder:text-muted-foreground focus:border-primary disabled:bg-surface-muted disabled:opacity-60',
        '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        active ? 'border-primary' : 'border-border-strong',
        className,
      )}
      {...props}
    />
  )
})
