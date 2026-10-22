import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { ChartLine, History, House } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWeighInDue } from '@/hooks/useWeighInDue'
import { BottomNav } from '@/ui/bottom-nav'

function navItems({ weighInDue }) {
  return [
    { to: '/', end: true, label: 'Home', icon: House },
    { to: '/history', label: 'History', icon: History },
    // Weekly weigh-in reminder: a dot on Progress, where "Log weight" lives.
    { to: '/progress', label: 'Progress', icon: ChartLine, dot: weighInDue, dotLabel: 'weigh-in due' },
  ]
}

// The live workout is full screen: no bottom nav (it gets its own sticky
// Finish bar instead).
function isFullScreenRoute(pathname) {
  return pathname.startsWith('/session/')
}

// Page chrome for every route: the cream background, the bottom nav (hidden
// on full-screen routes), padding so content scrolls clear of the nav, and
// scroll-to-top on route change (HashRouter doesn't restore scroll).
export function AppShell({ children }) {
  const { pathname } = useLocation()
  const showNav = !isFullScreenRoute(pathname)
  const weighInDue = useWeighInDue(pathname)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      <main className={cn('min-h-dvh bg-background text-foreground', showNav && 'pb-nav-clearance')}>{children}</main>
      {showNav && <BottomNav items={navItems({ weighInDue })} />}
    </>
  )
}
