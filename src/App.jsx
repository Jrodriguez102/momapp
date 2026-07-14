import { HashRouter, Routes, Route, NavLink, useParams } from 'react-router-dom'
import { LayoutDashboard, PersonStanding, History as HistoryIcon, LineChart } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import WorkoutSession from './pages/WorkoutSession'
import VolumeTracker from './pages/VolumeTracker'
import History from './pages/History'
import Progress from './pages/Progress'

// Keying on dayId guarantees a clean remount whenever the session day
// changes, so WorkoutSession can safely read its initial state straight
// from storage (no restore-then-overwrite race between effects).
function WorkoutSessionRoute() {
  const { dayId } = useParams()
  return <WorkoutSession key={dayId} />
}

function NavBar() {
  const linkClass = ({ isActive }) =>
    `flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
      isActive ? 'accent-text-gradient' : 'text-base-400'
    }`

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass flex justify-around py-2 z-50 md:top-0 md:bottom-auto md:justify-start md:gap-4 md:px-8">
      <NavLink to="/" end className={linkClass}>
        <LayoutDashboard size={20} />
        <span className="text-xs">Home</span>
      </NavLink>
      <NavLink to="/volume" className={linkClass}>
        <PersonStanding size={20} />
        <span className="text-xs">Volume</span>
      </NavLink>
      <NavLink to="/history" className={linkClass}>
        <HistoryIcon size={20} />
        <span className="text-xs">History</span>
      </NavLink>
      <NavLink to="/progress" className={linkClass}>
        <LineChart size={20} />
        <span className="text-xs">Progress</span>
      </NavLink>
    </nav>
  )
}

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen pb-20 md:pb-0 md:pt-20">
        <NavBar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/session/:dayId" element={<WorkoutSessionRoute />} />
          <Route path="/volume" element={<VolumeTracker />} />
          <Route path="/history" element={<History />} />
          <Route path="/progress" element={<Progress />} />
        </Routes>
      </div>
    </HashRouter>
  )
}
