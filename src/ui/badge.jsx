import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Status pill: Completed (success), Partial (warning), Today (accent), and
// neutral/accent-soft for counts and deltas.
const badgeVariants = cva('inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-caption font-bold whitespace-nowrap', {
  variants: {
    variant: {
      success: 'border border-success-border bg-success-tint text-success-foreground',
      warning: 'bg-warning text-warning-foreground',
      today: 'bg-gradient-primary text-primary-foreground',
      accent: 'border border-accent-border bg-accent text-accent-foreground',
      neutral: 'bg-surface-muted text-foreground-secondary',
      dark: 'bg-nav text-nav-foreground',
    },
  },
  defaultVariants: { variant: 'neutral' },
})

export function Badge({ variant, className, ...props }) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

