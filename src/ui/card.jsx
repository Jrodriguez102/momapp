import { cn } from '@/lib/utils'

// White surface card. `raised` adds the coral-tinted shadow — reserved for
// the active exercise card (the HeroCard has its own).
export function Card({ as: Comp = 'div', raised = false, className, ...props }) {
  return (
    <Comp
      data-slot="card"
      className={cn('rounded-card border border-border bg-surface p-5 text-foreground', raised && 'shadow-raised', className)}
      {...props}
    />
  )
}

// Small muted section label above or inside a card.
export function CardLabel({ as: Comp = 'p', className, ...props }) {
  return <Comp className={cn('text-caption font-semibold text-muted-foreground', className)} {...props} />
}

export function CardTitle({ as: Comp = 'h2', className, ...props }) {
  return <Comp className={cn('font-display text-title font-extrabold text-foreground', className)} {...props} />
}
