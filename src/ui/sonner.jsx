import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react'
import { Toaster as Sonner } from 'sonner'

// App-wide toast host (shadcn Sonner). Light theme only. Toasts sit at the
// top: the bottom belongs to the nav and the workout's sticky Finish bar.
function Toaster(props) {
  return (
    <Sonner
      theme="light"
      position="top-center"
      offset={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
      mobileOffset={{ top: 'calc(env(safe-area-inset-top) + 12px)', left: 'var(--spacing-gutter-tight)', right: 'var(--spacing-gutter-tight)' }}
      icons={{
        success: <CircleCheckIcon className="size-5 text-success" />,
        info: <InfoIcon className="size-5 text-muted-foreground" />,
        warning: <TriangleAlertIcon className="size-5 text-warning-foreground" />,
        error: <OctagonXIcon className="size-5 text-destructive" />,
        loading: <Loader2Icon className="size-5 animate-spin text-muted-foreground" />,
      }}
      toastOptions={{
        classNames: {
          toast: 'font-body gap-3! rounded-row-lg! border-border! shadow-popover!',
          title: 'text-body-sm! font-semibold! text-foreground!',
          description: 'text-caption! text-foreground-secondary!',
          actionButton: 'min-h-9! rounded-full! bg-nav! px-4! text-body-sm! font-bold! text-nav-foreground!',
          cancelButton: 'min-h-9! rounded-full! bg-surface-muted! px-4! text-body-sm! font-semibold! text-foreground!',
        },
      }}
      style={{
        '--normal-bg': 'var(--color-surface)',
        '--normal-text': 'var(--color-foreground)',
        '--normal-border': 'var(--color-border)',
        '--border-radius': 'var(--radius-row-lg)',
      }}
      {...props}
    />
  )
}

export { Toaster }
