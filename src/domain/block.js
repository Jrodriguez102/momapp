import {
  getWeekMeta,
  PROGRAM_DAYS,
  CURRENT_BLOCK,
  SESSIONS_PER_WEEK,
  WEEKS_PER_BLOCK,
  SESSIONS_PER_BLOCK,
} from '../data/program'

// ---- Block / week math ------------------------------------------------------
// Session-count-based (not calendar-based): every 4 completed sessions is one
// training week, 24 is one block (weeks 1-5 progressive, week 6 deload).
// Describes the session she's about to do — so 0 completed is session 1,
// week 1. Once the block is done (24 completed) isBlockComplete is set and
// nothing new should start.
export function getCurrentBlockAndWeek(completedInBlock) {
  const count = Math.max(0, completedInBlock || 0)
  const isBlockComplete = count >= SESSIONS_PER_BLOCK
  const sessionNumber = Math.min(count + 1, SESSIONS_PER_BLOCK)
  const weekInBlock = Math.min(WEEKS_PER_BLOCK, Math.ceil(sessionNumber / SESSIONS_PER_WEEK))
  const sessionInWeek = ((sessionNumber - 1) % SESSIONS_PER_WEEK) + 1
  return {
    block: CURRENT_BLOCK,
    weekInBlock,
    sessionNumber,
    sessionInWeek,
    completedSessionCount: count,
    isBlockComplete,
    ...getWeekMeta(weekInBlock),
  }
}

// ---- Queue ------------------------------------------------------------------
// Days run in PROGRAM_DAYS order and wrap. What's next is always the day
// after the most recent *completed* session in this block — a partial
// session leaves the same day next, and a missed calendar day never skips
// content.
export function getNextQueueDay(lastCompletedDayId) {
  const index = PROGRAM_DAYS.findIndex((d) => d.id === lastCompletedDayId)
  return PROGRAM_DAYS[(index + 1) % PROGRAM_DAYS.length]
}

// Block/week + queue position from this block's completed sessions, most
// recent first (only day_id is read).
export function buildBlockState(completedSessionsNewestFirst) {
  const lastCompletedDayId = completedSessionsNewestFirst[0]?.day_id ?? null
  return {
    ...getCurrentBlockAndWeek(completedSessionsNewestFirst.length),
    lastCompletedDayId,
    nextDay: getNextQueueDay(lastCompletedDayId),
  }
}
