import { cn } from '@/lib/utils'

// Sticky bottom bar for a full-screen flow's main action (white, top
// border, above the home indicator). Pair the page with pb-action-bar-clearance.
export function ActionBar({ className, children }) {
  return (
    <div className={cn('fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-action-bar', className)}>
      <div className="mx-auto max-w-md px-gutter-tight pt-3">{children}</div>
    </div>
  )
}
