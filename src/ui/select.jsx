import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { Select as SelectPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

// Accessible select (shadcn Select on Radix): listbox semantics, keyboard
// and typeahead, Escape to close. Trigger and items are >= 44px tall.
function Select(props) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectValue(props) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({ className, children, ...props }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        'focus-ring flex min-h-input w-full items-center justify-between gap-2 rounded-row-lg border border-input bg-surface px-4 text-left font-display text-title font-extrabold text-foreground',
        'data-[placeholder]:font-body data-[placeholder]:font-normal data-[placeholder]:text-muted-foreground disabled:opacity-50 *:data-[slot=select-value]:line-clamp-1',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({ className, children, position = 'popper', ...props }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        sideOffset={6}
        className={cn(
          'relative z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-y-auto rounded-row-lg border border-border bg-popover text-popover-foreground shadow-popover',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1.5">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({ className, children, ...props }) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'relative flex min-h-tap w-full cursor-default items-center rounded-row py-2 pr-10 pl-3 text-body text-foreground outline-none select-none',
        'data-[highlighted]:bg-accent data-[state=checked]:font-semibold data-[state=checked]:text-accent-foreground data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="absolute right-3 flex size-5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon aria-hidden="true" className="size-5" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectLabel({ className, ...props }) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn('px-3 py-1.5 text-caption font-semibold text-muted-foreground', className)}
      {...props}
    />
  )
}

function SelectGroup(props) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

export { Select, SelectValue, SelectTrigger, SelectContent, SelectItem, SelectLabel, SelectGroup }
