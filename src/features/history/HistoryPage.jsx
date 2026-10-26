import { useState } from 'react'
import { History as HistoryIcon } from 'lucide-react'
import { fetchFinishedSessions } from '@/services/sessionsApi'
import { fetchExerciseLogsForSessions, fetchSessionExerciseLogs } from '@/services/setsApi'
import { useAsyncData } from '@/hooks/useAsyncData'
import { EmptyState } from '@/ui/empty-state'
import { ErrorState } from '@/ui/error-state'
import { Page } from '@/ui/page'
import { PageHeader } from '@/ui/page-header'
import { SegmentedControl } from '@/ui/segmented-control'
import { LoadingState } from '@/ui/skeleton'
import { HISTORY_FILTERS, filterSessions } from './historyFormat'
import { SessionCard } from './SessionCard'

async function loadHistory() {
  const sessions = await fetchFinishedSessions()
  const logs = await fetchExerciseLogsForSessions(sessions.map((s) => s.id))
  const logsBySession = new Map()
  for (const log of logs) {
    if (!logsBySession.has(log.session_id)) logsBySession.set(log.session_id, [])
    logsBySession.get(log.session_id).push(log)
  }
  return { sessions, logsBySession }
}

// Every finished (completed + partial) session, newest first, filterable by
// this week / this month. Sessions finished in the last 48h are editable.
export default function HistoryPage() {
  // After the auto-close check, so a just-closed session is listed.
  const { status, data, reload, setData } = useAsyncData(loadHistory, { waitForAutoClose: true })
  const [filter, setFilter] = useState('all')
  const now = new Date()

  // After an edit: refetch that session's sets, and apply any session-field
  // change (session_rpe, or status -> partial when every set was removed).
  async function refreshSession(sessionId, patch) {
    // Never rejects (an empty list on failure), as before.
    const fresh = await fetchSessionExerciseLogs(sessionId).catch(() => [])
    setData((prev) => ({
      sessions: patch ? prev.sessions.map((s) => (s.id === sessionId ? { ...s, ...patch } : s)) : prev.sessions,
      logsBySession: new Map(prev.logsBySession).set(sessionId, fresh),
    }))
  }

  let content
  if (!data) {
    content = status === 'loading' ? <LoadingState label="Loading your workouts…" /> : <ErrorState onRetry={reload} />
  } else {
    const visible = filterSessions(data.sessions, filter, now)
    content = visible.length ? (
      <ol className="space-y-2">
        {visible.map((session) => (
          <li key={session.id}>
            <SessionCard session={session} logs={data.logsBySession.get(session.id) || []} onChanged={refreshSession} now={now} />
          </li>
        ))}
      </ol>
    ) : (
      <EmptyState
        icon={HistoryIcon}
        title={data.sessions.length ? 'No workouts in this range' : 'No workouts yet'}
        description={data.sessions.length ? 'Try All to see every workout.' : 'Finished workouts show up here.'}
      />
    )
  }

  return (
    <Page>
      <PageHeader title="History" />
      <SegmentedControl label="Show workouts from" options={HISTORY_FILTERS} value={filter} onChange={setFilter} />
      {content}
    </Page>
  )
}
