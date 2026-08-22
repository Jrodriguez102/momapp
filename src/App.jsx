import { HashRouter, Routes, Route, NavLink, useParams } from 'react-router-dom'
import { LayoutDashboard, History as HistoryIcon, LineChart } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import WorkoutSession from './pages/WorkoutSession'
import History from './pages/History'
import Progress from './pages/Progress'

// Keying on dayId guarantees a clean remount whenever the session day
// changes, so WorkoutSession can safely read its initial state straight
// from storage (no restore-then-overwrite race between effects).
function WorkoutSessionRoute() {
  const { dayId } = useParams()
  return <WorkoutSession key={dayId} />
}

const NAV_ITEMS = [
  { to: '/', end: true, icon: LayoutDashboard, label: 'Home' },
  { to: '/history', icon: HistoryIcon, label: 'History' },
  { to: '/progress', icon: LineChart, label: 'Progress' },
]

function NavBar() {
  return (
    <nav className="fixed bottom-4 left-4 right-4 z-50 md:top-4 md:bottom-auto md:left-1/2 md:right-auto md:-translate-x-1/2">
      <div className="mx-auto flex max-w-sm items-center justify-around gap-1 rounded-full bg-base-100 p-1.5 shadow-lg md:max-w-none md:justify-center md:gap-2 md:px-2">
        {NAV_ITEMS.map(({ to, end, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-1.5 rounded-full px-3.5 py-2.5 transition-all ${
                isActive ? 'bg-base-800' : 'text-base-900/50 hover:text-base-900/80'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} className={isActive ? 'text-accent-start' : ''} />
                {isActive && <span className="text-xs font-semibold text-base-100 whitespace-nowrap">{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen pb-24 md:pb-0 md:pt-24">
        <NavBar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/session/:dayId" element={<WorkoutSessionRoute />} />
          <Route path="/history" element={<History />} />
          <Route path="/progress" element={<Progress />} />
        </Routes>
      </div>
    </HashRouter>
  )
}
