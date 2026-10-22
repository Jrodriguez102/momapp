import { cn } from '@/lib/utils'

// 8px coral-gradient progress bar on a muted track. value/max are numbers;
// `label` names it for screen readers (the visible text sits beside it).
export function ProgressBar({ value, max, label, className }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-muted', className)}
    >
      <div className="h-full rounded-full bg-gradient-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
    </div>
  )
}
