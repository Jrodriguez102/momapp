import { useEffect } from 'react'
import { HashRouter, Routes, Route, useParams } from 'react-router-dom'
import HomePage from '@/features/home/HomePage'
import WorkoutPage from '@/features/workout/WorkoutPage'
import HistoryPage from '@/features/history/HistoryPage'
import ProgressPage from '@/features/progress/ProgressPage'
import { runAutoClose } from '@/services/autoClose'
import { AppShell } from '@/app/AppShell'
import { Toaster } from '@/ui/sonner'

// Keying on dayId guarantees a clean remount whenever the session day
// changes, so WorkoutPage (useWorkoutSession) can read its draft straight
// from storage (no restore-then-overwrite race between effects).
function WorkoutSessionRoute() {
  const { dayId } = useParams()
  return <WorkoutPage key={dayId} />
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
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/progress" element={<ProgressPage />} />
        </Routes>
      </AppShell>
      <Toaster />
    </HashRouter>
  )
}
