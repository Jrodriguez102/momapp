import { cn } from '@/lib/utils'

// Centered "nothing here yet" / error message inside a card, with an
// optional icon and action (e.g. a Try again button).
export function EmptyState({ icon: Icon, title, description, action, className, role }) {
  return (
    <div role={role} className={cn('flex flex-col items-center gap-3 rounded-card border border-border bg-surface px-6 py-8 text-center', className)}>
      {Icon && (
        <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icon className="size-6" />
        </span>
      )}
      <div className="space-y-1">
        <p className="font-display text-title font-extrabold text-foreground">{title}</p>
        {description && <p className="text-body-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
