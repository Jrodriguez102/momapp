import { cn } from '@/lib/utils'

// Screen title: Nunito 900 at 30px, with an optional small muted line above
// (e.g. today's date) and optional trailing content (chips, actions).
export function PageHeader({ title, eyebrow, className, children }) {
  return (
    <header className={cn('space-y-2', className)}>
      {eyebrow && <p className="text-caption font-medium text-muted-foreground">{eyebrow}</p>}
      <h1 className="font-display text-page font-black text-foreground">{title}</h1>
      {children}
    </header>
  )
}
