import { cn } from '@/lib/utils'
import { Page } from '@/ui/page'

// Centered end-of-workout layout: an 84px status circle, a big title, a
// subtitle, then the screen's content and actions.
// tone: 'success' (coral gradient check) | 'muted' (neutral circle)
export function ResultLayout({ icon: Icon, tone = 'success', title, subtitle, children }) {
  return (
    <Page tight className="space-y-6 pt-12 pb-8">
      <div className="flex flex-col items-center text-center">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-21 items-center justify-center rounded-full',
            tone === 'success' ? 'bg-gradient-primary text-primary-foreground shadow-hero' : 'bg-surface-muted text-muted-foreground',
          )}
        >
          <Icon className="size-10" strokeWidth={tone === 'success' ? 3 : 2} />
        </span>
        <h1 className="mt-5 font-display text-display font-black text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-body text-foreground-secondary">{subtitle}</p>}
      </div>
      {children}
    </Page>
  )
}
