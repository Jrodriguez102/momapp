import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { ChartLine, History, House } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BottomNav } from '@/ui/bottom-nav'

const NAV_ITEMS = [
  { to: '/', end: true, label: 'Home', icon: House },
  { to: '/history', label: 'History', icon: History },
  { to: '/progress', label: 'Progress', icon: ChartLine },
]

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

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      <main className={cn('min-h-dvh bg-background text-foreground', showNav && 'pb-nav-clearance')}>{children}</main>
      {showNav && <BottomNav items={NAV_ITEMS} />}
    </>
  )
}
