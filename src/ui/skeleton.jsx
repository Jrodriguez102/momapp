import { cn } from '@/lib/utils'

// Loading placeholder block. Decorative — pair a group of these with one
// visually hidden "Loading…" status (see LoadingState).
export function Skeleton({ className }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-row bg-surface-muted', className)} />
}

// A page-level loading placeholder: a few card-shaped skeletons plus a
// polite status message for screen readers.
export function LoadingState({ label = 'Loading…', className }) {
  return (
    <div className={cn('space-y-4', className)}>
      <p role="status" className="sr-only">{label}</p>
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-44 rounded-card" />
      <Skeleton className="h-28 rounded-card" />
    </div>
  )
}
