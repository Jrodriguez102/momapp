import { useEffect } from 'react'
import { HashRouter, Routes, Route, useParams } from 'react-router-dom'
import HomePage from '@/features/home/HomePage'
import WorkoutSession from './pages/WorkoutSession'
import History from './pages/History'
import Progress from './pages/Progress'
import { runAutoClose } from './data/helpers'
import { AppShell } from '@/app/AppShell'
import { Toaster } from '@/ui/sonner'

// Keying on dayId guarantees a clean remount whenever the session day
// changes, so WorkoutSession can safely read its initial state straight
// from storage (no restore-then-overwrite race between effects).
function WorkoutSessionRoute() {
  const { dayId } = useParams()
  return <WorkoutSession key={dayId} />
}

// Closes forgotten in_progress sessions on app open and whenever the app
// returns to the foreground (it can't run a timer while closed). Pages that
// depend on session counts await afterAutoClose() before loading.
function useAutoCloseSessions() {
  useEffect(() => {
    runAutoClose()
    function handleVisibility() {
      if (document.visibilityState === 'visible') runAutoClose()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])
}

export default function App() {
  useAutoCloseSessions()
  return (
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/session/:dayId" element={<WorkoutSessionRoute />} />
          <Route path="/history" element={<History />} />
          <Route path="/progress" element={<Progress />} />
        </Routes>
      </AppShell>
      <Toaster />
    </HashRouter>
  )
}
