import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getGreeting,
  getStatusForSetCount,
  getCurrentBlockAndWeek,
  getNextQueueDay,
  difficultyToRpe,
  rpeToDifficulty,
  getSessionRpeLabel,
  isWithinEditWindow,
  parseRepRange,
  getExerciseSuggestion,
  getPlannedWeeklyVolume,
  getVolumeStatus,
  groupSessionLogsByExercise,
  findExerciseById,
  findDayById,
  isValidReps,
  isValidWeight,
  filterByTimeframe,
  groupLogsBySession,
  getTopSet,
  estimate1RM,
  getSetsVolume,
  getElapsedSeconds,
  formatDuration,
  getDaySummary,
  HISTORY_EDIT_WINDOW_MS,
} from './helpers'

vi.mock('../lib/supabase', async () => ({ supabase: (await import('../test/fakeSupabase')).fake.client }))

afterEach(() => {
  vi.useRealTimers()
})

describe('getGreeting', () => {
  it('switches at noon and 6pm', () => {
    expect(getGreeting(new Date(2026, 9, 21, 11, 59))).toBe('Good morning')
    expect(getGreeting(new Date(2026, 9, 21, 12, 0))).toBe('Good afternoon')
    expect(getGreeting(new Date(2026, 9, 21, 18, 0))).toBe('Good evening')
  })
})

describe('getStatusForSetCount', () => {
  it('needs 6 sets to count as completed', () => {
    expect(getStatusForSetCount(5)).toBe('partial')
    expect(getStatusForSetCount(6)).toBe('completed')
  })
})

describe('getCurrentBlockAndWeek', () => {
  it('describes the session about to be done', () => {
    expect(getCurrentBlockAndWeek(0)).toMatchObject({
      block: 1, weekInBlock: 1, sessionNumber: 1, sessionInWeek: 1, isBlockComplete: false, weekType: 'progressive',
    })
    expect(getCurrentBlockAndWeek(4)).toMatchObject({ weekInBlock: 2, sessionNumber: 5, sessionInWeek: 1 })
    expect(getCurrentBlockAndWeek(19)).toMatchObject({ weekInBlock: 5, sessionNumber: 20, sessionInWeek: 4 })
  })

  it('makes sessions 21-24 the deload week', () => {
    expect(getCurrentBlockAndWeek(20)).toMatchObject({ weekInBlock: 6, sessionNumber: 21, weekType: 'deload' })
    expect(getCurrentBlockAndWeek(23)).toMatchObject({ weekInBlock: 6, sessionNumber: 24, isBlockComplete: false })
  })

  it('marks the block complete at 24 and clamps the session number', () => {
    expect(getCurrentBlockAndWeek(24)).toMatchObject({ isBlockComplete: true, sessionNumber: 24, weekInBlock: 6 })
    expect(getCurrentBlockAndWeek(30)).toMatchObject({ isBlockComplete: true, sessionNumber: 24 })
  })

  it('treats missing or negative counts as 0', () => {
    expect(getCurrentBlockAndWeek(undefined).sessionNumber).toBe(1)
    expect(getCurrentBlockAndWeek(-3).sessionNumber).toBe(1)
  })
})

describe('getNextQueueDay', () => {
  it('starts at day 1 and wraps after day 4', () => {
    expect(getNextQueueDay(null).id).toBe('day-1')
    expect(getNextQueueDay('day-2').id).toBe('day-3')
    expect(getNextQueueDay('day-4').id).toBe('day-1')
  })

  it('falls back to day 1 for unknown (pilot) day ids', () => {
    expect(getNextQueueDay('day-6').id).toBe('day-1')
  })
})

describe('difficulty <-> rpe', () => {
  it('round-trips the three taps', () => {
    for (const value of ['3+', '1-2', '0']) expect(rpeToDifficulty(difficultyToRpe(value))).toBe(value)
  })

  it('handles empty and unknown values', () => {
    expect(difficultyToRpe(null)).toBeNull()
    expect(rpeToDifficulty(null)).toBeNull()
    expect(rpeToDifficulty(9)).toBeNull()
    expect(rpeToDifficulty('8.5')).toBe('1-2')
  })
})

describe('getSessionRpeLabel', () => {
  it('labels the 1-10 scale by anchor', () => {
    expect(getSessionRpeLabel(1)).toBe('Easy')
    expect(getSessionRpeLabel(6)).toBe('Moderate')
    expect(getSessionRpeLabel(8)).toBe('Hard')
    expect(getSessionRpeLabel(10)).toBe('Max')
    expect(getSessionRpeLabel(null)).toBeNull()
  })
})

describe('isWithinEditWindow', () => {
  const completedAt = new Date(2026, 9, 20, 9, 0)
  const session = { status: 'completed', completed_at: completedAt.toISOString() }

  it('is editable for 48h after completed_at', () => {
    expect(isWithinEditWindow(session, new Date(completedAt.getTime() + HISTORY_EDIT_WINDOW_MS - 1))).toBe(true)
    expect(isWithinEditWindow(session, new Date(completedAt.getTime() + HISTORY_EDIT_WINDOW_MS))).toBe(false)
  })

  it('covers partial sessions but never in-progress or uncompleted ones', () => {
    const now = new Date(completedAt.getTime() + 1000)
    expect(isWithinEditWindow({ ...session, status: 'partial' }, now)).toBe(true)
    expect(isWithinEditWindow({ ...session, status: 'in_progress' }, now)).toBe(false)
    expect(isWithinEditWindow({ status: 'completed', completed_at: null }, now)).toBe(false)
  })
})

describe('parseRepRange', () => {
  it('reads the first min-max pair', () => {
    expect(parseRepRange('8-10')).toEqual({ min: 8, max: 10 })
    expect(parseRepRange('12-15 / leg')).toEqual({ min: 12, max: 15 })
    expect(parseRepRange('AMRAP')).toBeNull()
    expect(parseRepRange(undefined)).toBeNull()
  })
})

// ---- Progression ------------------------------------------------------------
const BENCH = findExerciseById('db-bench-press') // 8-10, start 35, goal 40, +5, high confidence
const SHOULDER = findExerciseById('seated-db-shoulder-press') // 8-10, start 15, goal 20, +2.5, low confidence
const PROGRESSIVE = getCurrentBlockAndWeek(8) // week 3
const DELOAD = getCurrentBlockAndWeek(20) // week 6

// One logged session of `name`: reps[i] at `weight`, rpe on the last set.
let sessionSeq = 0
function loggedSession(name, { weight, reps, rpe = null, daysAgo }) {
  sessionSeq += 1
  const sessionId = `s${sessionSeq}`
  const loggedAt = new Date(2026, 9, 21 - daysAgo, 9, 0).toISOString()
  return reps.map((r, i) => ({
    session_id: sessionId,
    exercise_id: 'db-bench-press',
    exercise_name: name,
    set_number: i + 1,
    weight,
    reps: r,
    rpe: i === reps.length - 1 ? rpe : null,
    logged_at: loggedAt,
  }))
}

function suggest({ exercise = BENCH, activeName = exercise.name, logs = [], weekMeta = PROGRESSIVE, recentCompletedCount = 3 } = {}) {
  return getExerciseSuggestion({ exercise, activeName, logs, weekMeta, recentCompletedCount })
}

describe('getExerciseSuggestion', () => {
  it('starts a never-logged base exercise at startWeight, bottom of the range', () => {
    expect(suggest()).toMatchObject({
      action: 'start', targetWeight: 35, targetReps: 8, prefillWeight: 35, lastWeight: null, goalWeight: 40, unit: 'lb',
    })
  })

  it('gives a never-logged alternative no target, prefill or goal', () => {
    expect(suggest({ activeName: 'Chest Press Machine' })).toMatchObject({
      action: 'start', targetWeight: null, prefillWeight: null, goalWeight: null,
    })
  })

  it('calibrates low-confidence exercises until 2 sessions are logged', () => {
    const one = loggedSession(SHOULDER.name, { weight: 15, reps: [10, 10, 10], rpe: 7, daysAgo: 2 })
    expect(suggest({ exercise: SHOULDER, logs: one })).toMatchObject({ action: 'calibrate', targetWeight: null, prefillWeight: 15 })
  })

  it('stops calibrating once 2 sessions are logged', () => {
    const logs = [
      ...loggedSession(SHOULDER.name, { weight: 15, reps: [10, 10, 10], rpe: 7, daysAgo: 4 }),
      ...loggedSession(SHOULDER.name, { weight: 15, reps: [10, 10, 10], rpe: 7, daysAgo: 2 }),
    ]
    expect(suggest({ exercise: SHOULDER, logs })).toMatchObject({ action: 'increase', targetWeight: 17.5, prefillWeight: 17.5 })
  })

  it('holds at the last working weight in the deload week', () => {
    const logs = loggedSession(BENCH.name, { weight: 40, reps: [10, 10, 10, 10], rpe: 7, daysAgo: 2 })
    expect(suggest({ logs, weekMeta: DELOAD })).toMatchObject({ action: 'deload', targetWeight: 40, targetReps: null, prefillWeight: 40 })
  })

  it('increases when every set hit the top and the last set was not "0 left"', () => {
    const logs = loggedSession(BENCH.name, { weight: 35, reps: [10, 10, 10, 10], rpe: 8.5, daysAgo: 2 })
    expect(suggest({ logs })).toMatchObject({ action: 'increase', targetWeight: 40, targetReps: 8, prefillWeight: 40, lastWeight: 35 })
  })

  it('applies the hold rule (< 3 completed sessions in 7 days) instead of increasing', () => {
    const logs = loggedSession(BENCH.name, { weight: 35, reps: [10, 10, 10, 10], rpe: 8.5, daysAgo: 2 })
    expect(suggest({ logs, recentCompletedCount: 2 })).toMatchObject({ action: 'hold', targetWeight: 35, targetReps: 10, prefillWeight: 35 })
  })

  it('repeats once when the top was hit with "0 left"', () => {
    const logs = loggedSession(BENCH.name, { weight: 35, reps: [10, 10, 10, 10], rpe: 10, daysAgo: 2 })
    expect(suggest({ logs })).toMatchObject({ action: 'repeat-once', targetWeight: 35, targetReps: 10 })
  })

  it('increases after the repeat session also hit the top with "0 left"', () => {
    const logs = [
      ...loggedSession(BENCH.name, { weight: 35, reps: [10, 10, 10, 10], rpe: 10, daysAgo: 5 }),
      ...loggedSession(BENCH.name, { weight: 35, reps: [10, 10, 10, 10], rpe: 10, daysAgo: 2 }),
    ]
    expect(suggest({ logs })).toMatchObject({ action: 'increase', targetWeight: 40 })
  })

  it('decreases after 2 sessions at the same weight with most sets below the range', () => {
    const logs = [
      ...loggedSession(BENCH.name, { weight: 40, reps: [7, 6, 6, 8], rpe: 10, daysAgo: 5 }),
      ...loggedSession(BENCH.name, { weight: 40, reps: [7, 7, 6, 8], rpe: 10, daysAgo: 2 }),
    ]
    expect(suggest({ logs })).toMatchObject({ action: 'decrease', targetWeight: 35, targetReps: 8, prefillWeight: 35 })
  })

  it('never decreases below one increment', () => {
    const logs = [
      ...loggedSession(BENCH.name, { weight: 5, reps: [6, 6, 6, 6], rpe: 10, daysAgo: 5 }),
      ...loggedSession(BENCH.name, { weight: 5, reps: [6, 6, 6, 6], rpe: 10, daysAgo: 2 }),
    ]
    expect(suggest({ logs }).targetWeight).toBe(5)
  })

  it('otherwise asks for one more rep at the same weight, within the range', () => {
    const logs = loggedSession(BENCH.name, { weight: 35, reps: [9, 9, 8, 8], rpe: 8.5, daysAgo: 2 })
    expect(suggest({ logs })).toMatchObject({ action: 'more-reps', targetWeight: 35, targetReps: 10, prefillWeight: 35 })
  })

  it('tracks progression per exercise_name (alternatives never inherit the base)', () => {
    const logs = loggedSession(BENCH.name, { weight: 35, reps: [10, 10, 10, 10], rpe: 8.5, daysAgo: 2 })
    expect(suggest({ logs, activeName: 'Chest Press Machine' })).toMatchObject({ action: 'start', lastWeight: null })
  })

  it('ignores rows without reps', () => {
    const logs = loggedSession(BENCH.name, { weight: 35, reps: [null, null, null, null], daysAgo: 2 })
    expect(suggest({ logs })).toMatchObject({ action: 'start' })
  })
})

// ---- Volume (kept for a possible Volume tab) ----------------------------------
describe('volume helpers', () => {
  it('halves planned volume in the deload week', () => {
    const week1 = getPlannedWeeklyVolume(1)
    const week6 = getPlannedWeeklyVolume(6)
    expect(week1.calves).toBe(6) // shared calf raise on day 2 + day 4, 3 sets each
    expect(week6.calves).toBe(4)
    expect(week6.chest).toBeLessThan(week1.chest)
  })

  it('classifies volume against per-group thresholds', () => {
    expect(getVolumeStatus(7, 'chest')).toBe('low')
    expect(getVolumeStatus(10, 'chest')).toBe('optimal')
    expect(getVolumeStatus(15, 'biceps')).toBe('high')
  })
})

// ---- History grouping -------------------------------------------------------
describe('groupSessionLogsByExercise', () => {
  it('groups by slot in first-logged order, sorts sets and flags swaps', () => {
    const logs = [
      { exercise_id: 'lat-pulldown', exercise_name: 'Close-Grip Pulldown', set_number: 2, rpe: 8.5 },
      { exercise_id: 'db-bench-press', exercise_name: 'DB Bench Press', set_number: 1, rpe: null },
      { exercise_id: 'lat-pulldown', exercise_name: 'Close-Grip Pulldown', set_number: 1, rpe: null },
    ]
    const groups = groupSessionLogsByExercise(logs)
    expect(groups.map((g) => g.exerciseId)).toEqual(['lat-pulldown', 'db-bench-press'])
    expect(groups[0]).toMatchObject({ displayName: 'Close-Grip Pulldown', originalName: 'Lat Pulldown', difficulty: '1-2' })
    expect(groups[0].sets.map((s) => s.set_number)).toEqual([1, 2])
    expect(groups[1]).toMatchObject({ displayName: 'DB Bench Press', originalName: null, difficulty: null })
  })

  it('falls back to the logged name for pilot ids not in the program', () => {
    const [group] = groupSessionLogsByExercise([{ exercise_id: 'kb-sumo-deadlift-2', exercise_name: 'KB Sumo Deadlift', set_number: 1 }])
    expect(group).toMatchObject({ displayName: 'KB Sumo Deadlift', originalName: null })
  })
})

describe('lookups', () => {
  it('finds days and exercises by id', () => {
    expect(findDayById('day-3').shortLabel).toBe('Upper B')
    expect(findDayById('day-9')).toBeNull()
    expect(findExerciseById('leg-press-calf-raise').name).toBe('Leg Press Calf Raise')
    expect(findExerciseById('nope')).toBeNull()
  })

  it('summarizes a day in MUSCLE_GROUPS order', () => {
    const summary = getDaySummary(findDayById('day-1'))
    expect(summary.exerciseCount).toBe(6)
    expect(summary.muscles).toEqual(['chest', 'back', 'shoulders', 'biceps', 'triceps'])
  })
})

describe('set input validation', () => {
  it('requires whole-number reps above 0', () => {
    expect(isValidReps('8')).toBe(true)
    expect(isValidReps('0')).toBe(false)
    expect(isValidReps('8.5')).toBe(false)
    expect(isValidReps('')).toBe(false)
    expect(isValidReps(null)).toBe(false)
  })

  it('requires a finite weight of 0 or more', () => {
    expect(isValidWeight('32.5')).toBe(true)
    expect(isValidWeight('0')).toBe(true)
    expect(isValidWeight('-5')).toBe(false)
    expect(isValidWeight('')).toBe(false)
    expect(isValidWeight('abc')).toBe(false)
  })
})

describe('filterByTimeframe', () => {
  it('keeps entries inside the last N months', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 21, 12, 0))
    const entries = [
      { logged_at: new Date(2026, 3, 1).toISOString() },
      { logged_at: new Date(2026, 7, 1).toISOString() },
      { logged_at: new Date(2026, 9, 1).toISOString() },
    ]
    expect(filterByTimeframe(entries, '1m')).toHaveLength(1)
    expect(filterByTimeframe(entries, '3m')).toHaveLength(2)
    expect(filterByTimeframe(entries, '6m')).toHaveLength(2)
    expect(filterByTimeframe(entries, 'all')).toHaveLength(3)
    expect(filterByTimeframe([{ when: new Date(2026, 9, 1).toISOString() }], '1m', 'when')).toHaveLength(1)
  })
})

// ---- Progress math ----------------------------------------------------------
describe('progress math', () => {
  const logs = [
    { session_id: 'b', exercise_name: 'Leg Press', set_number: 2, weight: 300, reps: 10, logged_at: '2026-10-14T16:00:00Z' },
    { session_id: 'a', exercise_name: 'Leg Press', set_number: 1, weight: 290, reps: 12, logged_at: '2026-10-07T16:00:00Z' },
    { session_id: 'b', exercise_name: 'Leg Press', set_number: 1, weight: 300, reps: 12, logged_at: '2026-10-14T16:00:00Z' },
    { session_id: 'b', exercise_name: 'Hack Squat Machine', set_number: 1, weight: 90, reps: 10, logged_at: '2026-10-14T16:00:00Z' },
    { session_id: 'c', exercise_name: 'Leg Press', set_number: 1, weight: null, reps: 10, logged_at: '2026-10-15T16:00:00Z' },
  ]

  it('groups one exercise name into sessions, oldest first, skipping incomplete rows', () => {
    const sessions = groupLogsBySession(logs, 'Leg Press')
    expect(sessions.map((s) => s.sessionId)).toEqual(['a', 'b'])
    expect(sessions[1].sets.map((s) => s.set_number)).toEqual([1, 2])
  })

  it('picks the heaviest set as the top set, ties broken by reps', () => {
    const [, b] = groupLogsBySession(logs, 'Leg Press')
    expect(getTopSet(b.sets)).toMatchObject({ weight: 300, reps: 12 })
  })

  it('estimates 1RM with Epley', () => {
    expect(estimate1RM(100, 10)).toBe(133)
    expect(estimate1RM(100, 1)).toBe(100)
    expect(estimate1RM(0, 10)).toBeNull()
  })

  it('sums weight x reps for volume, treating nulls as 0', () => {
    expect(getSetsVolume([{ weight: 35, reps: 10 }, { weight: null, reps: 10 }, { weight: 40, reps: 8 }])).toBe(670)
  })
})

describe('timer helpers', () => {
  it('caps elapsed time at 2h and never goes negative', () => {
    const start = new Date(2026, 9, 21, 9, 0)
    expect(getElapsedSeconds(start.toISOString(), new Date(2026, 9, 21, 9, 5, 30))).toBe(330)
    expect(getElapsedSeconds(start.toISOString(), new Date(2026, 9, 21, 12, 0))).toBe(7200)
    expect(getElapsedSeconds(start.toISOString(), new Date(2026, 9, 21, 8, 0))).toBe(0)
  })

  it('formats m:ss under an hour and h:mm:ss above', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(330)).toBe('5:30')
    expect(formatDuration(3725)).toBe('1:02:05')
  })
})
