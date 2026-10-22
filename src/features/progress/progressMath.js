import { filterByTimeframe } from '@/domain/calendar'
import { estimate1RM, getSetsVolume, getTopSet, groupLogsBySession } from '@/domain/metrics'

// Pure helpers for the Progress tab.

export const TIMEFRAMES = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: 'all', label: 'All' },
]

const RANGE_TEXT = { '1m': 'the last month', '3m': 'the last 3 months', '6m': 'the last 6 months' }

const round1 = (n) => Math.round(n * 10) / 10
const shortDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

// ---- Body weight ------------------------------------------------------------
// logs: body_weight_logs, oldest first. `current` is the latest entry ever;
// `delta` is latest minus earliest *within the timeframe* (null with fewer
// than two weigh-ins in it).
export function bodyWeightSummary(logs, timeframe, now = new Date()) {
  const inRange = filterByTimeframe(logs, timeframe, 'logged_at', now)
  const delta = inRange.length >= 2 ? round1(inRange.at(-1).weight - inRange[0].weight) : null
  return { current: logs.at(-1) ?? null, inRange, delta }
}

// Neutral wording and sign only — no judgment of direction.
export function formatDelta(delta) {
  if (delta === 0) return 'No change'
  return `${delta > 0 ? '+' : '−'}${Math.abs(delta)} lb`
}

// The one-line text under the body-weight chart.
export function bodyWeightText({ inRange, delta }, timeframe) {
  const range = timeframe === 'all' ? (inRange.length ? `since ${shortDate(inRange[0].logged_at)}` : 'so far') : `over ${RANGE_TEXT[timeframe]}`
  if (inRange.length === 0) return `No weigh-ins ${timeframe === 'all' ? 'yet' : `in ${RANGE_TEXT[timeframe]}`}.`
  if (inRange.length === 1) return `1 weigh-in ${range} — log another to see a trend.`
  const count = `${inRange.length} weigh-ins`
  if (delta === 0) return `No change ${range} · ${count}`
  return `${delta > 0 ? 'Up' : 'Down'} ${Math.abs(delta)} lb ${range} · ${count}`
}

// ---- Lifts ------------------------------------------------------------------
// Exercise names for the picker: anything logged in Block 01 or later
// (names only ever logged in the pilot, block 0, are hidden). Most recently
// logged first. logs carry workout_sessions.block (fetchAllStrengthLogs).
export function progressExerciseNames(logs) {
  const lastSeen = new Map()
  for (const log of logs) {
    if (!log.exercise_name || (log.workout_sessions?.block ?? 0) < 1) continue
    if (!lastSeen.has(log.exercise_name) || log.logged_at > lastSeen.get(log.exercise_name)) lastSeen.set(log.exercise_name, log.logged_at)
  }
  return [...lastSeen.entries()].sort((a, b) => (a[1] < b[1] ? 1 : -1)).map(([name]) => name)
}

// One entry per session for a name, oldest first, with its top set, the
// estimated 1RM of that top set, and volume.
export function exerciseSessions(logs, name) {
  return groupLogsBySession(logs, name).map((session) => {
    const top = getTopSet(session.sets)
    return { ...session, top, estimated1RM: estimate1RM(top.weight, top.reps), volume: getSetsVolume(session.sets) }
  })
}

// Heaviest top set across sessions (ties: more reps, then the later one).
export function bestTopSet(sessions) {
  return sessions.reduce((best, s) => {
    if (!best) return s
    if (s.top.weight > best.top.weight || (s.top.weight === best.top.weight && s.top.reps >= best.top.reps)) return s
    return best
  }, null)
}

// The one-line text under the top-set chart.
export function topSetText(sessions) {
  if (sessions.length === 0) return 'No sets logged for this exercise yet.'
  if (sessions.length === 1) return '1 session so far — log it again to see a trend.'
  const change = round1(sessions.at(-1).top.weight - sessions[0].top.weight)
  const across = `across ${sessions.length} sessions`
  if (change === 0) return `Same top weight ${across}`
  return `${change > 0 ? 'Up' : 'Down'} ${Math.abs(change)} lb ${across}`
}

export function sessionDateLabel(session) {
  return shortDate(session.date)
}
