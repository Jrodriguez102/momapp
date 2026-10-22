import { PLANNED_WEEKDAYS } from '../data/program'
import { HOLD_RULE } from './sessionRules'

// ---- Calendar helpers -----------------------------------------------------------
// Monday-start week containing `date`, at local midnight.
export function getWeekStart(date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const day = start.getDay()
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day))
  return start
}

// Monday-start week containing referenceDate, as 7 local-midnight Date objects.
export function getWeekDates(referenceDate) {
  const start = getWeekStart(referenceDate)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export function sameDay(a, b) {
  return a.toDateString() === b.toDateString()
}

// [start, end) of the Mon-Sun week containing referenceDate.
export function getWeekRange(referenceDate) {
  const weekDates = getWeekDates(referenceDate)
  const end = new Date(weekDates[6])
  end.setDate(end.getDate() + 1)
  return { start: weekDates[0], end }
}

// [start, end) of the calendar month containing referenceDate.
export function getMonthRange(referenceDate) {
  return {
    start: new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1),
    end: new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1),
  }
}

// ---- Home tab: week strip ---------------------------------------------------------
// Mon-Sun week containing referenceDate, from that week's completed
// sessions ({ day_id, completed_at }). Each day:
// { date, isToday, isPlanned, completedDayIds, status } where status is
// 'completed' (trained that day — planned weekday or not), 'missed' (past
// planned weekday, nothing completed), 'planned' (today or later planned
// weekday) or 'rest'. Display only — the queue decides what's next.
export function buildTrainingWeek(sessions, referenceDate) {
  const days = getWeekDates(referenceDate).map((date) => {
    const isToday = sameDay(date, referenceDate)
    const isPlanned = PLANNED_WEEKDAYS.includes(date.getDay())
    const completedDayIds = sessions.filter((s) => sameDay(new Date(s.completed_at), date)).map((s) => s.day_id)
    let status
    if (completedDayIds.length) status = 'completed'
    else if (!isPlanned) status = 'rest'
    else if (date < referenceDate && !isToday) status = 'missed'
    else status = 'planned'
    return { date, isToday, isPlanned, completedDayIds, status }
  })
  return { days, completedCount: sessions.length, plannedCount: PLANNED_WEEKDAYS.length }
}

// ---- Weekly streak ------------------------------------------------------------
// The streak looks back up to 52 weeks; sessions are read from
// [lookback, end).
export function getStreakRange(referenceDate) {
  const lookback = getWeekStart(referenceDate)
  lookback.setDate(lookback.getDate() - 52 * 7)
  const end = new Date(referenceDate)
  end.setDate(end.getDate() + 1)
  return { start: lookback, end }
}

// Consecutive Mon-Sun weeks with >= 3 completed sessions, counting back from
// last week. The current week adds 1 once it reaches 3, but an unfinished
// current week never breaks the streak.
export function countWeeklyStreak(sessions, referenceDate) {
  const { start: lookback } = getStreakRange(referenceDate)
  const perWeek = new Map()
  for (const s of sessions) {
    const key = getWeekStart(new Date(s.completed_at)).getTime()
    perWeek.set(key, (perWeek.get(key) || 0) + 1)
  }

  const cursor = getWeekStart(referenceDate)
  let streak = (perWeek.get(cursor.getTime()) || 0) >= HOLD_RULE.minSessions ? 1 : 0
  cursor.setDate(cursor.getDate() - 7)
  while (cursor >= lookback && (perWeek.get(cursor.getTime()) || 0) >= HOLD_RULE.minSessions) {
    streak++
    cursor.setDate(cursor.getDate() - 7)
  }
  return streak
}

// ---- Weekly weigh-in ------------------------------------------------------------
export const WEIGH_IN_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

// True when there's no body-weight entry, or the latest is >= 7 days old.
export function isWeighInDue(lastLoggedAt, now = new Date()) {
  if (!lastLoggedAt) return true
  return now.getTime() - new Date(lastLoggedAt).getTime() >= WEIGH_IN_INTERVAL_MS
}

// ---- Timeframe filter -----------------------------------------------------------
const TIMEFRAME_MONTHS = { '1m': 1, '3m': 3, '6m': 6 }

// timeframe: '1m' | '3m' | '6m' | 'all'. Filters by `logged_at` unless a
// different field name is passed.
export function filterByTimeframe(entries, timeframe, dateKey = 'logged_at', now = new Date()) {
  const months = TIMEFRAME_MONTHS[timeframe]
  if (!months) return entries
  const cutoff = new Date(now)
  cutoff.setMonth(cutoff.getMonth() - months)
  return entries.filter((entry) => new Date(entry[dateKey]) >= cutoff)
}
