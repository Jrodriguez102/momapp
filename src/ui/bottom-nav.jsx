import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

// Floating dark pill nav, 66px tall, 16px from the sides and above the home
// indicator. Every item shows its icon and label; the active one is a cream
// pill with coral icon + label and gets aria-current="page" (NavLink).
// items: [{ to, end?, label, icon, dot?, dotLabel? }] — `dot` shows a small
// coral marker (e.g. weigh-in due) and adds `dotLabel` to the link's name.
export function BottomNav({ items, label = 'Main' }) {
  return (
    <nav aria-label={label} className="fixed inset-x-gutter-tight bottom-nav-offset z-40 mx-auto max-w-md">
      <ul className="flex h-nav items-stretch gap-1 rounded-full bg-nav p-1.5 shadow-nav">
        {items.map(({ to, end, label: itemLabel, icon: Icon, dot, dotLabel }) => (
          <li key={to} className="flex flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-body-sm font-semibold transition-colors',
                  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nav-foreground',
                  isActive ? 'bg-nav-foreground text-accent-foreground' : 'text-nav-foreground/75 hover:text-nav-foreground',
                )
              }
            >
              <span className="relative flex">
                <Icon aria-hidden="true" className="size-5" />
                {dot && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary ring-2 ring-nav-foreground"
                  />
                )}
              </span>
              <span>{itemLabel}</span>
              {dot && dotLabel && <span className="sr-only">, {dotLabel}</span>}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
