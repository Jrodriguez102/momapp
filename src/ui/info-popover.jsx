import { Info } from 'lucide-react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

// Tap-to-open explainer (Radix Popover): 44px hit area around a small info
// icon, closes on outside tap or Escape. `label` is the trigger's name.
export function InfoPopover({ label, title, children, className }) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        aria-label={label}
        className={cn('focus-ring -m-3 inline-flex size-tap shrink-0 items-center justify-center rounded-full text-muted-foreground', className)}
      >
        <Info aria-hidden="true" className="size-4" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={16}
          className="z-50 w-72 rounded-row-lg border border-border bg-popover p-4 text-popover-foreground shadow-popover outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          {title && <p className="font-display text-title font-extrabold">{title}</p>}
          <div className="mt-1 text-body-sm text-foreground-secondary">{children}</div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
