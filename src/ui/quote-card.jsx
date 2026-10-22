import { Quote } from 'lucide-react'
import { cn } from '@/lib/utils'

// Soft coral-gradient card with a round gradient badge and the daily quote.
export function QuoteCard({ children, className }) {
  return (
    <figure className={cn('flex items-center gap-3.5 rounded-card border border-accent-border bg-gradient-quote p-4', className)}>
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground">
        <Quote className="size-4" fill="currentColor" strokeWidth={0} />
      </span>
      <blockquote className="font-display text-title font-extrabold text-accent-deep">{children}</blockquote>
    </figure>
  )
}
