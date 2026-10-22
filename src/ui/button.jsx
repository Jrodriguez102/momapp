import { cva } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from '@/lib/utils'

// Fully rounded, 44px minimum. Variants:
//   primary     coral gradient, white text (main actions)
//   outline     coral outline on white (secondary actions: Swap, Log weight)
//   dark        nav-dark pill (Edit sets, dark chips)
//   light       white pill with coral text (CTA inside a HeroCard)
//   ghost       text-only, muted (tertiary: Cancel, Keep going)
//   destructive coral-red text on a tint (Remove set)
const buttonVariants = cva(
  'focus-ring inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-full font-body font-bold whitespace-nowrap transition-[background-color,opacity,transform] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-gradient-primary text-primary-foreground',
        outline: 'border border-accent-border bg-surface text-accent-foreground hover:bg-accent',
        dark: 'bg-nav text-nav-foreground',
        light: 'bg-surface text-accent-foreground',
        ghost: 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
        destructive: 'bg-accent text-destructive hover:bg-accent-border',
      },
      size: {
        sm: 'min-h-tap px-4 text-body-sm [&_svg:not([class*=size-])]:size-4',
        md: 'min-h-input px-6 text-body [&_svg:not([class*=size-])]:size-5',
        lg: 'min-h-14 px-6 text-title [&_svg:not([class*=size-])]:size-5',
        icon: 'size-tap [&_svg:not([class*=size-])]:size-5',
        'icon-lg': 'size-input [&_svg:not([class*=size-])]:size-6',
      },
      block: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

function Button({ className, variant, size, block, asChild = false, type, ...props }) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      data-slot="button"
      // A bare <button> defaults to type="submit" inside forms; be explicit.
      type={asChild ? type : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  )
}

export { Button }
