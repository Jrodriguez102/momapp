import { XIcon } from 'lucide-react'
import { Dialog as SheetPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

// Bottom sheet (shadcn Sheet on Radix Dialog): focus trap, Escape and
// overlay-tap to close, scroll lock. Mobile-only, so it always slides up
// from the bottom and pads for the home indicator.
function Sheet(props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger(props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose(props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetOverlay({ className, ...props }) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-foreground/40 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
        className,
      )}
      {...props}
    />
  )
}

function SheetContent({ className, children, showCloseButton = true, ...props }) {
  return (
    <SheetPrimitive.Portal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col overflow-y-auto rounded-t-card bg-surface pb-safe text-foreground shadow-popover outline-none',
          'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=closed]:duration-200 data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:duration-300',
          className,
        )}
        {...props}
      >
        <div aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border-strong" />
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            aria-label="Close"
            className="focus-ring absolute top-3 right-3 flex size-tap items-center justify-center rounded-full text-muted-foreground hover:bg-surface-muted"
          >
            <XIcon className="size-5" />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

function SheetHeader({ className, ...props }) {
  return <div data-slot="sheet-header" className={cn('flex flex-col gap-1 px-gutter pt-3 pr-16 pb-2', className)} {...props} />
}

function SheetBody({ className, ...props }) {
  return <div data-slot="sheet-body" className={cn('px-gutter pb-gutter', className)} {...props} />
}

function SheetFooter({ className, ...props }) {
  return <div data-slot="sheet-footer" className={cn('mt-auto flex flex-col gap-2 px-gutter pb-gutter', className)} {...props} />
}

function SheetTitle({ className, ...props }) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('font-display text-heading font-black text-foreground', className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-body-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetBody, SheetFooter, SheetTitle, SheetDescription }
