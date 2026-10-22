// Characterization tests for the Supabase-backed helpers: what each query
// asks for, what it writes (the frozen Block 01 data contract), and what it
// falls back to when Supabase fails.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fake, opArgs, hasOp } from '../test/fakeSupabase'
import {
  getCompletedSessionCount,
  getBlockState,
  getTrainingWeek,
  getWeeklyStreak,
  getWorkoutsThisMonth,
  needsWeighIn,
  getProgressionLogs,
  getExerciseLogsForSessions,
  getFinishedSessions,
  getAnyInProgressSession,
  createSession,
  saveSet,
  syncExerciseRpe,
  removeLiveSet,
  removeHistorySet,
  finishSession,
  runAutoClose,
  logBodyWeight,
} from './helpers'

vi.mock('../lib/supabase', async () => ({ supabase: (await import('../test/fakeSupabase')).fake.client }))

const FAIL = { data: null, error: new Error('offline') }

function isOp(query, name) {
  return hasOp(query, name)
}

beforeEach(() => {
  fake.reset()
})

describe('read fallbacks when Supabase fails', () => {
  beforeEach(() => fake.respond(() => FAIL))

  it('count/list reads return empty defaults', async () => {
    expect(await getCompletedSessionCount()).toBe(0)
    expect(await getWorkoutsThisMonth()).toBe(0)
    expect(await getFinishedSessions()).toEqual([])
    expect(await getAnyInProgressSession()).toBeNull()
    expect(await getProgressionLogs(['DB Bench Press'])).toEqual([])
  })

  it('needsWeighIn does not nag on a failed read', async () => {
    expect(await needsWeighIn()).toBe(false)
  })

  it('getBlockState behaves like a fresh block', async () => {
    expect(await getBlockState()).toMatchObject({ sessionNumber: 1, weekInBlock: 1, lastCompletedDayId: null, nextDay: { id: 'day-1' } })
  })
})

describe('getCompletedSessionCount', () => {
  it('counts completed Block 01 sessions', async () => {
    fake.respond(() => ({ count: 5 }))
    expect(await getCompletedSessionCount()).toBe(5)
    const [q] = fake.queries
    expect(q.table).toBe('workout_sessions')
    expect(q.ops.filter((op) => op.name === 'eq').map((op) => op.args)).toEqual([['block', 1], ['status', 'completed']])
  })
})

describe('getBlockState', () => {
  it('puts the day after the most recent completed session next', async () => {
    fake.respond(() => ({ data: [{ day_id: 'day-3' }, { day_id: 'day-2' }, { day_id: 'day-1' }] }))
    expect(await getBlockState()).toMatchObject({ sessionNumber: 4, lastCompletedDayId: 'day-3', nextDay: { id: 'day-4' } })
    expect(opArgs(fake.queries[0], 'order')).toEqual(['completed_at', { ascending: false }])
  })

  it('wraps from day 4 to day 1', async () => {
    fake.respond(() => ({ data: [{ day_id: 'day-4' }] }))
    expect((await getBlockState()).nextDay.id).toBe('day-1')
  })
})

describe('getTrainingWeek', () => {
  // Wednesday 2026-10-21; planned weekdays are Mon, Tue, Thu, Fri.
  const wednesday = new Date(2026, 9, 21, 10, 0)

  it('classifies each Mon-Sun day as completed / missed / planned / rest', async () => {
    fake.respond(() => ({ data: [{ day_id: 'day-1', completed_at: new Date(2026, 9, 19, 9, 0).toISOString() }] }))
    const week = await getTrainingWeek(wednesday)
    expect(week.days.map((d) => d.status)).toEqual(['completed', 'missed', 'rest', 'planned', 'planned', 'rest', 'rest'])
    expect(week.days.map((d) => d.isToday)).toEqual([false, false, true, false, false, false, false])
    expect(week.days[0].completedDayIds).toEqual(['day-1'])
    expect(week).toMatchObject({ completedCount: 1, plannedCount: 4 })
  })

  it('counts an unplanned-day workout as completed', async () => {
    fake.respond(() => ({ data: [{ day_id: 'day-2', completed_at: new Date(2026, 9, 21, 8, 0).toISOString() }] }))
    const week = await getTrainingWeek(wednesday)
    expect(week.days[2].status).toBe('completed')
  })

  it('queries completed sessions from Monday to the next Monday', async () => {
    fake.respond(() => ({ data: [] }))
    await getTrainingWeek(wednesday)
    const [q] = fake.queries
    expect(opArgs(q, 'eq')).toEqual(['status', 'completed'])
    expect(opArgs(q, 'gte')).toEqual(['completed_at', new Date(2026, 9, 19).toISOString()])
    expect(opArgs(q, 'lt')).toEqual(['completed_at', new Date(2026, 9, 26).toISOString()])
  })
})

describe('getWeeklyStreak', () => {
  const wednesday = new Date(2026, 9, 21, 10, 0)
  const sessionsOn = (...dates) => dates.map((d) => ({ day_id: 'day-1', completed_at: d.toISOString() }))

  it('counts consecutive past weeks with >= 3 sessions; an unfinished week does not break it', async () => {
    fake.respond(() => ({
      data: sessionsOn(
        new Date(2026, 9, 12, 9), new Date(2026, 9, 13, 9), new Date(2026, 9, 15, 9), // week of Oct 12: 3
        new Date(2026, 9, 5, 9), new Date(2026, 9, 6, 9), new Date(2026, 9, 8, 9), // week of Oct 5: 3
        new Date(2026, 8, 21, 9), new Date(2026, 8, 22, 9), new Date(2026, 8, 24, 9), // Sep 21: 3, but Sep 28 is a gap
        new Date(2026, 9, 19, 9), // this week: 1
      ),
    }))
    expect(await getWeeklyStreak(wednesday)).toBe(2)
  })

  it('adds the current week once it reaches 3', async () => {
    fake.respond(() => ({
      data: sessionsOn(
        new Date(2026, 9, 12, 9), new Date(2026, 9, 13, 9), new Date(2026, 9, 15, 9),
        new Date(2026, 9, 19, 9), new Date(2026, 9, 20, 9), new Date(2026, 9, 21, 8),
      ),
    }))
    expect(await getWeeklyStreak(wednesday)).toBe(2)
  })
})

describe('needsWeighIn', () => {
  const now = new Date(2026, 9, 21, 10, 0)
  const daysAgo = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

  it('is due with no entries or none in the last 7 days', async () => {
    fake.respond(() => ({ data: null }))
    expect(await needsWeighIn(now)).toBe(true)
    fake.respond(() => ({ data: { logged_at: daysAgo(7) } }))
    expect(await needsWeighIn(now)).toBe(true)
  })

  it('is not due with a recent entry', async () => {
    fake.respond(() => ({ data: { logged_at: daysAgo(2) } }))
    expect(await needsWeighIn(now)).toBe(false)
  })
})

describe('progression and history reads', () => {
  it('reads block >= 1 completed + partial sets by exercise name', async () => {
    fake.respond(() => ({ data: [] }))
    await getProgressionLogs(['DB Bench Press', 'Chest Press Machine'])
    const [q] = fake.queries
    expect(q.table).toBe('exercise_logs')
    expect(opArgs(q, 'select')[0]).toContain('workout_sessions!inner(block, status)')
    expect(opArgs(q, 'gt')).toEqual(['workout_sessions.block', 0])
    expect(q.ops.filter((op) => op.name === 'in').map((op) => op.args)).toEqual([
      ['exercise_name', ['DB Bench Press', 'Chest Press Machine']],
      ['workout_sessions.status', ['completed', 'partial']],
    ])
  })

  it('skips the query for empty inputs', async () => {
    expect(await getProgressionLogs([])).toEqual([])
    expect(await getExerciseLogsForSessions([])).toEqual([])
    expect(fake.queries).toHaveLength(0)
  })

  it('lists finished sessions newest first', async () => {
    fake.respond(() => ({ data: [{ id: 'x' }] }))
    expect(await getFinishedSessions()).toEqual([{ id: 'x' }])
    expect(opArgs(fake.queries[0], 'in')).toEqual(['status', ['completed', 'partial']])
    expect(opArgs(fake.queries[0], 'order')).toEqual(['completed_at', { ascending: false }])
  })
})

// ---- Writes (frozen data contract) -------------------------------------------
describe('createSession', () => {
  it('resumes an existing in_progress session for the day', async () => {
    fake.respond(() => ({ data: { id: 'open' } }))
    expect(await createSession('day-2', 1)).toEqual({ id: 'open' })
    expect(fake.queries.some((q) => isOp(q, 'insert'))).toBe(false)
  })

  it('otherwise inserts block, week_in_block, day_id and in_progress status', async () => {
    fake.respond((q) => (isOp(q, 'insert') ? { data: { id: 'new' } } : { data: null }))
    expect(await createSession('day-2', 3)).toEqual({ id: 'new' })
    const insert = fake.queries.find((q) => isOp(q, 'insert'))
    expect(opArgs(insert, 'insert')).toEqual([{ day_id: 'day-2', block: 1, week_in_block: 3, status: 'in_progress' }])
  })
})

describe('saveSet', () => {
  it('rejects bad reps or a missing name without querying', async () => {
    await expect(saveSet({ sessionId: 's', exerciseId: 'e', exerciseName: 'X', setNumber: 1, weight: 10, reps: 0 })).rejects.toThrow()
    await expect(saveSet({ sessionId: 's', exerciseId: 'e', exerciseName: 'X', setNumber: 1, weight: 10, reps: '8.5' })).rejects.toThrow()
    await expect(saveSet({ sessionId: 's', exerciseId: 'e', exerciseName: '', setNumber: 1, weight: 10, reps: 8 })).rejects.toThrow()
    await expect(saveSet({ sessionId: 's', exerciseId: 'e', exerciseName: 'X', setNumber: 1, weight: 'abc', reps: 8 })).rejects.toThrow()
    expect(fake.queries).toHaveLength(0)
  })

  it('upserts one row per (session, name, set) and never sends logged_at', async () => {
    fake.respond(() => ({ data: { id: 'row' } }))
    await saveSet({ sessionId: 's1', exerciseId: 'db-bench-press', exerciseName: 'DB Bench Press', setNumber: 2, weight: '32.5', reps: '9' })
    const [q] = fake.queries
    expect(opArgs(q, 'upsert')).toEqual([
      { session_id: 's1', exercise_id: 'db-bench-press', exercise_name: 'DB Bench Press', set_number: 2, weight: 32.5, weight_unit: 'lb', reps: 9 },
      { onConflict: 'session_id,exercise_name,set_number' },
    ])
  })

  it('writes a blank weight as null', async () => {
    fake.respond(() => ({ data: { id: 'row' } }))
    await saveSet({ sessionId: 's1', exerciseId: 'e', exerciseName: 'X', setNumber: 1, weight: '', reps: 8 })
    expect(opArgs(fake.queries[0], 'upsert')[0].weight).toBeNull()
  })
})

describe('syncExerciseRpe', () => {
  it('moves the existing rpe onto the highest set', async () => {
    fake.respond((q) =>
      isOp(q, 'select')
        ? { data: [{ id: 'r1', set_number: 1, rpe: null }, { id: 'r2', set_number: 2, rpe: 8.5 }, { id: 'r3', set_number: 3, rpe: null }] }
        : { data: null },
    )
    expect(await syncExerciseRpe('s1', 'db-bench-press')).toBe(8.5)
    const updates = fake.queries.filter((q) => isOp(q, 'update'))
    expect(updates.map((q) => [opArgs(q, 'update')[0], opArgs(q, 'in') ?? opArgs(q, 'eq')])).toEqual([
      [{ rpe: null }, ['id', ['r2']]],
      [{ rpe: 8.5 }, ['id', 'r3']],
    ])
  })

  it('does nothing when the value is already on the highest set', async () => {
    fake.respond((q) => (isOp(q, 'select') ? { data: [{ id: 'r1', set_number: 1, rpe: null }, { id: 'r2', set_number: 2, rpe: 10 }] } : { data: null }))
    expect(await syncExerciseRpe('s1', 'e', 10)).toBe(10)
    expect(fake.queries.filter((q) => isOp(q, 'update'))).toHaveLength(0)
  })
})

describe('set removal', () => {
  const row = { id: 'r1', session_id: 's1', exercise_id: 'e', rpe: null }

  it('deletes the session row when the live session has no sets left', async () => {
    fake.respond((q) => (isOp(q, 'select') ? { count: 0 } : { data: null }))
    expect(await removeLiveSet(row)).toEqual({ remaining: 0, sessionDeleted: true })
    const sessionDelete = fake.queries.find((q) => q.table === 'workout_sessions' && isOp(q, 'delete'))
    expect(sessionDelete.ops.filter((op) => op.name === 'eq').map((op) => op.args)).toEqual([['id', 's1'], ['status', 'in_progress']])
  })

  it('keeps the live session when sets remain', async () => {
    fake.respond((q) => (isOp(q, 'select') ? { count: 2 } : { data: null }))
    expect(await removeLiveSet(row)).toEqual({ remaining: 2, sessionDeleted: false })
    expect(fake.queries.some((q) => q.table === 'workout_sessions')).toBe(false)
  })

  it('marks a History session partial when every set is removed', async () => {
    fake.respond((q) => (isOp(q, 'select') ? { count: 0 } : { data: null }))
    expect(await removeHistorySet(row)).toEqual({ remaining: 0 })
    const update = fake.queries.find((q) => q.table === 'workout_sessions' && isOp(q, 'update'))
    expect(opArgs(update, 'update')).toEqual([{ status: 'partial' }])
  })
})

describe('finishSession', () => {
  const times = (n) => Array.from({ length: n }, (_, i) => ({ logged_at: new Date(2026, 9, 21, 9, i * 5).toISOString() }))

  function respondWithLogs(n, updated = [{ id: 's1', status: 'x' }]) {
    fake.respond((q) => (q.table === 'exercise_logs' ? { data: times(n) } : { data: updated }))
  }

  it('completes with >= 6 sets and writes duration first -> last set', async () => {
    respondWithLogs(6)
    await finishSession('s1', { sessionRpe: 7 })
    const update = fake.queries.find((q) => isOp(q, 'update'))
    expect(opArgs(update, 'update')[0]).toMatchObject({ status: 'completed', duration_seconds: 25 * 60, closed_by: 'user', session_rpe: 7 })
    expect(update.ops.filter((op) => op.name === 'eq').map((op) => op.args)).toEqual([['id', 's1'], ['status', 'in_progress']])
  })

  it('is partial under 6 sets unless she counts it', async () => {
    respondWithLogs(3)
    await finishSession('s1', { countAsWorkout: false })
    expect(opArgs(fake.queries.find((q) => isOp(q, 'update')), 'update')[0]).toMatchObject({ status: 'partial', session_rpe: null })
    fake.reset()
    respondWithLogs(3)
    await finishSession('s1', { countAsWorkout: true })
    expect(opArgs(fake.queries.find((q) => isOp(q, 'update')), 'update')[0].status).toBe('completed')
  })

  it('returns null when the session was no longer in progress', async () => {
    respondWithLogs(6, [])
    expect(await finishSession('s1')).toBeNull()
  })

  it('refuses to finish with no sets', async () => {
    respondWithLogs(0)
    await expect(finishSession('s1')).rejects.toThrow()
  })
})

describe('runAutoClose', () => {
  const now = Date.now()
  const minsAgo = (m) => new Date(now - m * 60 * 1000).toISOString()

  it('closes idle sessions from their sets, deletes stale empty ones, leaves active ones', async () => {
    fake.respond((q) => {
      if (q.table === 'workout_sessions' && isOp(q, 'select')) {
        return { data: [{ id: 'idle', started_at: minsAgo(150) }, { id: 'empty', started_at: minsAgo(100) }, { id: 'active', started_at: minsAgo(20) }] }
      }
      if (q.table === 'exercise_logs') {
        return {
          data: [
            { session_id: 'idle', logged_at: minsAgo(140) },
            { session_id: 'idle', logged_at: minsAgo(100) },
            { session_id: 'active', logged_at: minsAgo(5) },
          ],
        }
      }
      return { data: null }
    })

    expect(await runAutoClose()).toEqual(['idle', 'empty'])

    const update = fake.queries.find((q) => isOp(q, 'update'))
    expect(opArgs(update, 'update')[0]).toEqual({
      status: 'partial', completed_at: minsAgo(100), duration_seconds: 40 * 60, closed_by: 'auto',
    })
    expect(opArgs(update, 'eq')).toEqual(['id', 'idle'])
    const del = fake.queries.find((q) => isOp(q, 'delete'))
    expect(opArgs(del, 'eq')).toEqual(['id', 'empty'])
  })

  it('never rejects', async () => {
    fake.respond(() => FAIL)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await runAutoClose()).toEqual([])
  })
})

describe('logBodyWeight', () => {
  it('inserts weight and logged_at', async () => {
    const at = new Date(2026, 9, 21, 7, 30)
    await logBodyWeight(150.4, at)
    expect(opArgs(fake.queries[0], 'insert')).toEqual([{ weight: 150.4, logged_at: at.toISOString() }])
  })
})
