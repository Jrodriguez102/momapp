// Home screen fixtures: HomeView props built with the real domain functions,
// for tests (HomeView.test.jsx) and for rendering Home without Supabase.
import { buildBlockState } from '@/domain/block'
import { buildTrainingWeek } from '@/domain/calendar'

// Tuesday 2026-10-20, 9:00am. Planned weekdays are Mon, Tue, Thu, Fri.
export const FIXTURE_NOW = new Date(2026, 9, 20, 9, 0)

// `count` completed Block 01 sessions, the most recent on `lastDayId`.
function blockAfter(count, lastDayId) {
  return buildBlockState(Array.from({ length: count }, (_, i) => ({ day_id: i === 0 ? lastDayId : 'day-1' })))
}

const mondayUpperA = { day_id: 'day-1', completed_at: new Date(2026, 9, 19, 9, 40).toISOString() }

// Mid-block week (session 10 of 24, week 3): Monday's Upper A is done,
// Lower A is today, Upper B (Thu) and Lower B (Fri) are coming up.
export const midBlockWeek = {
  blockState: blockAfter(9, 'day-1'),
  trainingWeek: buildTrainingWeek([mondayUpperA], FIXTURE_NOW),
  monthCount: 7,
  streak: 2,
  inProgressSession: null,
  now: FIXTURE_NOW,
  quote: 'Progress, not perfection.',
}

// Same week, with today's Lower A already started.
export const inProgressWeek = {
  ...midBlockWeek,
  inProgressSession: {
    id: 'open-session',
    day_id: 'day-2',
    status: 'in_progress',
    started_at: new Date(2026, 9, 20, 8, 50).toISOString(),
  },
}

// Deload week: 21 sessions done, Upper B next.
export const deloadWeek = {
  ...midBlockWeek,
  blockState: blockAfter(20, 'day-2'),
}

// All 24 sessions done; Monday's session was the last one.
export const blockCompleteWeek = {
  ...midBlockWeek,
  blockState: blockAfter(24, 'day-1'),
}
