import { cn } from '@/lib/utils'

// Coral gradient callout card with white text (Today's workout). Decorative
// rings are aria-hidden; content sits above them.
export function HeroCard({ as: Comp = 'section', className, children, ...props }) {
  return (
    <Comp
      data-slot="hero-card"
      className={cn('relative isolate overflow-hidden rounded-card bg-gradient-primary p-6 text-primary-foreground shadow-hero', className)}
      {...props}
    >
      <span aria-hidden="true" className="absolute -top-14 -right-12 -z-10 size-48 rounded-full border border-primary-foreground/15" />
      <span aria-hidden="true" className="absolute -top-4 -right-4 -z-10 size-28 rounded-full border border-primary-foreground/15" />
      {children}
    </Comp>
  )
}

// Uppercase label at the top of a HeroCard ("TODAY'S WORKOUT").
export function HeroEyebrow({ className, ...props }) {
  return <p className={cn('text-caption font-bold tracking-wider text-primary-foreground uppercase', className)} {...props} />
}

// Semi-transparent white chip inside a HeroCard (exercise names, "+N more").
export function HeroChip({ className, ...props }) {
  return (
    <span
      className={cn('inline-flex min-h-8 items-center rounded-full bg-primary-foreground/18 px-3 text-caption font-semibold text-primary-foreground', className)}
      {...props}
    />
  )
}
