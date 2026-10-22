import { AlertDialog as AlertDialogPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'

// Confirmation dialog (shadcn AlertDialog on Radix): focus trap, no
// dismiss-on-overlay-tap, Escape cancels. Buttons stack full-width — this
// app is mobile-only.
function AlertDialog(props) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger(props) {
  return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
}

function AlertDialogOverlay({ className, ...props }) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-foreground/40 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogContent({ className, ...props }) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          'fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2*var(--spacing-gutter))] max-w-sm -translate-x-1/2 -translate-y-1/2 gap-5 rounded-card bg-surface p-6 text-foreground shadow-popover outline-none',
          'duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  )
}

function AlertDialogHeader({ className, ...props }) {
  return <div data-slot="alert-dialog-header" className={cn('grid gap-2 text-center', className)} {...props} />
}

function AlertDialogFooter({ className, ...props }) {
  return <div data-slot="alert-dialog-footer" className={cn('grid gap-2', className)} {...props} />
}

function AlertDialogTitle({ className, ...props }) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn('font-display text-heading font-black text-foreground', className)}
      {...props}
    />
  )
}

function AlertDialogDescription({ className, ...props }) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn('text-body-sm text-foreground-secondary', className)}
      {...props}
    />
  )
}

function AlertDialogAction({ className, variant = 'primary', size = 'md', ...props }) {
  return (
    <Button variant={variant} size={size} block asChild>
      <AlertDialogPrimitive.Action data-slot="alert-dialog-action" className={className} {...props} />
    </Button>
  )
}

function AlertDialogCancel({ className, variant = 'ghost', size = 'md', ...props }) {
  return (
    <Button variant={variant} size={size} block asChild>
      <AlertDialogPrimitive.Cancel data-slot="alert-dialog-cancel" className={className} {...props} />
    </Button>
  )
}

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
