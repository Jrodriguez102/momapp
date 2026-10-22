// @vitest-environment jsdom
// useWorkoutSession against an in-memory Supabase: the real helpers run, so
// these check the rows that would be written, not just hook state.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { fake, hasOp } from '@/test/fakeSupabase'
import { createMemoryDb } from '@/test/memorySupabase'
import { findDayById } from '@/domain/metrics'
import { SESSIONS_AUTO_CLOSED_EVENT } from '@/services/autoClose'
import { useWorkoutSession } from './useWorkoutSession'
import { draftStorageKey } from './workoutDraft'

vi.mock('@/lib/supabase', async () => ({ supabase: (await import('@/test/fakeSupabase')).fake.client }))

const DAY = findDayById('day-1')
const BENCH = DAY.exercises.find((ex) => ex.id === 'db-bench-press') // 4 sets, 8-10
const LAT = DAY.exercises.find((ex) => ex.id === 'lat-pulldown')
const minutesAgo = (m) => new Date(Date.now() - m * 60_000).toISOString()

let db

function seed(tables) {
  db = createMemoryDb(tables)
  fake.respond(db.respond)
}

async function mount(dayId = 'day-1') {
  const hook = renderHook(() => useWorkoutSession(dayId))
  await waitFor(() => expect(hook.result.current.ready).toBe(true))
  return hook
}

// Run a hook action and flush its state updates.
async function run(result, fn) {
  let value
  await act(async () => {
    value = await fn(result.current)
  })
  return value
}

const logsFor = (exerciseId) =>
  db.tables.exercise_logs.filter((l) => l.exercise_id === exerciseId).sort((a, b) => a.set_number - b.set_number)

beforeEach(() => {
  localStorage.clear()
  fake.reset()
  seed({})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('lazy session creation', () => {
  it('creates no workout_sessions row just by opening the screen', async () => {
    const { result } = await mount()
    expect(result.current.session).toBeNull()
    expect(db.tables.workout_sessions).toHaveLength(0)
  })

  it('creates the session on the first saved set, then saves the set', async () => {
    const { result } = await mount()
    expect(await run(result, (ws) => ws.logSet(BENCH, 0, { weight: '35', reps: '10' }))).toBe(true)
    expect(db.tables.workout_sessions).toEqual([
      expect.objectContaining({ day_id: 'day-1', block: 1, week_in_block: 1, status: 'in_progress' }),
    ])
    const [session] = db.tables.workout_sessions
    expect(result.current.session.id).toBe(session.id)
    expect(logsFor('db-bench-press')).toEqual([
      expect.objectContaining({ session_id: session.id, exercise_name: 'DB Bench Press', set_number: 1, weight: 35, reps: 10 }),
    ])
  })

  it('creates only one session when two sets are tapped at once', async () => {
    const { result } = await mount()
    await run(result, (ws) =>
      Promise.all([ws.logSet(BENCH, 0, { weight: '35', reps: '10' }), ws.logSet(BENCH, 1, { weight: '35', reps: '9' })]),
    )
    expect(db.tables.workout_sessions).toHaveLength(1)
    expect(logsFor('db-bench-press').map((l) => l.set_number)).toEqual([1, 2])
  })

  it('removing the only set deletes the session row again', async () => {
    const { result } = await mount()
    await run(result, (ws) => ws.logSet(BENCH, 0, { weight: '35', reps: '10' }))
    const row = result.current.logs['db-bench-press'][1]
    expect(await run(result, (ws) => ws.removeSet(BENCH, row))).toBe(true)
    expect(db.tables.workout_sessions).toHaveLength(0)
    expect(result.current.session).toBeNull()
  })
})

describe('resume from DB rows', () => {
  it('restores logged sets, difficulty and swaps; what was logged wins over the draft', async () => {
    const session = { id: 's1', day_id: 'day-1', block: 1, week_in_block: 3, status: 'in_progress', started_at: minutesAgo(10) }
    seed({
      workout_sessions: [session],
      exercise_logs: [
        { id: 'l1', session_id: 's1', exercise_id: 'db-bench-press', exercise_name: 'DB Bench Press', set_number: 1, weight: 35, reps: 10, rpe: null, logged_at: minutesAgo(8) },
        { id: 'l2', session_id: 's1', exercise_id: 'db-bench-press', exercise_name: 'DB Bench Press', set_number: 2, weight: 35, reps: 9, rpe: 8.5, logged_at: minutesAgo(6) },
        { id: 'l3', session_id: 's1', exercise_id: 'lat-pulldown', exercise_name: 'Close-Grip Pulldown', set_number: 1, weight: 80, reps: 12, rpe: null, logged_at: minutesAgo(4) },
      ],
    })
    const rowAlt = DAY.exercises.find((ex) => ex.id === 'seated-cable-row').alternatives[0]
    localStorage.setItem(
      draftStorageKey('day-1'),
      JSON.stringify({
        entries: { 'db-bench-press': [null, null, { reps: '8' }] },
        swaps: { 'db-bench-press': BENCH.alternatives[0], 'seated-cable-row': rowAlt },
        sessionRpe: 7,
      }),
    )

    const { result } = await mount()
    const ws = result.current
    expect(ws.session.id).toBe('s1')
    expect(Object.keys(ws.logs['db-bench-press'])).toEqual(['1', '2'])
    expect(ws.difficulties).toEqual({ 'db-bench-press': '1-2' })
    expect(ws.swaps).toEqual({ 'lat-pulldown': LAT.alternatives.find((a) => a.name === 'Close-Grip Pulldown'), 'seated-cable-row': rowAlt })
    expect(ws.entries['db-bench-press'][2]).toEqual({ reps: '8' })
    expect(ws.sessionRpe).toBe(7)
    expect(db.tables.workout_sessions).toHaveLength(1)
  })

  it('points to the other day when a different workout is in progress', async () => {
    seed({ workout_sessions: [{ id: 's9', day_id: 'day-3', block: 1, week_in_block: 1, status: 'in_progress', started_at: minutesAgo(5) }] })
    const { result } = await mount()
    expect(result.current.otherSession).toMatchObject({ id: 's9', day_id: 'day-3' })
    expect(result.current.session).toBeNull()
  })
})

describe('draft persistence', () => {
  it('keeps the exact localStorage key and JSON format', async () => {
    const { result } = await mount()
    act(() => result.current.changeEntry('db-bench-press', 0, 'reps', '10'))
    expect(localStorage.getItem('block1:session-in-progress-day-1')).toBe(
      '{"entries":{"db-bench-press":[{"reps":"10"}]},"swaps":{},"sessionRpe":null}',
    )
    act(() => result.current.setSessionRpe(6))
    expect(JSON.parse(localStorage.getItem('block1:session-in-progress-day-1')).sessionRpe).toBe(6)
  })
})

describe('swap rename', () => {
  it('renames already-logged rows of the slot and clears its unsaved entries', async () => {
    const { result } = await mount()
    await run(result, (ws) => ws.logSet(LAT, 0, { weight: '90', reps: '12' }))
    act(() => result.current.changeEntry('lat-pulldown', 1, 'reps', '11'))
    const alt = LAT.alternatives[0]
    await run(result, (ws) => ws.swapExercise(LAT, alt))
    expect(logsFor('lat-pulldown').map((l) => l.exercise_name)).toEqual([alt.name])
    expect(result.current.logs['lat-pulldown'][1].exercise_name).toBe(alt.name)
    expect(result.current.swaps['lat-pulldown']).toEqual(alt)
    expect(result.current.entries['lat-pulldown']).toEqual([])
    expect(result.current.activeNameFor(LAT)).toBe(alt.name)

    await run(result, (ws) => ws.swapExercise(LAT, null))
    expect(logsFor('lat-pulldown').map((l) => l.exercise_name)).toEqual(['Lat Pulldown'])
    expect(result.current.swaps['lat-pulldown']).toBeUndefined()
  })

  it('writes nothing when no set of the slot is logged yet', async () => {
    const { result } = await mount()
    act(() => result.current.changeEntry('lat-pulldown', 0, 'weight', '100'))
    fake.queries.length = 0
    await run(result, (ws) => ws.swapExercise(LAT, LAT.alternatives[1]))
    expect(fake.queries.some((q) => hasOp(q, 'update'))).toBe(false)
    expect(result.current.entries['lat-pulldown']).toEqual([])
    expect(result.current.swaps['lat-pulldown']).toEqual(LAT.alternatives[1])
  })

  it('logs the swapped-in name for new sets', async () => {
    const { result } = await mount()
    await run(result, (ws) => ws.swapExercise(LAT, LAT.alternatives[1]))
    await run(result, (ws) => ws.logSet(LAT, 0, { weight: '70', reps: '10' }))
    expect(logsFor('lat-pulldown')[0].exercise_name).toBe(LAT.alternatives[1].name)
  })
})

describe('last-set difficulty (rpe sync)', () => {
  async function benchSets(result, count) {
    for (let i = 0; i < count; i++) await run(result, (ws) => ws.logSet(BENCH, i, { weight: '35', reps: '10' }))
  }
  const rpes = () => logsFor('db-bench-press').map((l) => l.rpe)

  it('puts the tap on the highest logged set only', async () => {
    const { result } = await mount()
    await benchSets(result, 2)
    await run(result, (ws) => ws.setDifficulty(BENCH, '1-2'))
    expect(rpes()).toEqual([null, 8.5])
    expect(result.current.difficulties['db-bench-press']).toBe('1-2')
  })

  it('moves it up when a higher set is logged, and clears it on deselect', async () => {
    const { result } = await mount()
    await benchSets(result, 2)
    await run(result, (ws) => ws.setDifficulty(BENCH, '0'))
    await run(result, (ws) => ws.logSet(BENCH, 2, { weight: '35', reps: '8' }))
    expect(rpes()).toEqual([null, null, 10])
    await run(result, (ws) => ws.setDifficulty(BENCH, null))
    expect(rpes()).toEqual([null, null, null])
  })

  it('does nothing before a session exists', async () => {
    const { result } = await mount()
    await run(result, (ws) => ws.setDifficulty(BENCH, '3+'))
    expect(result.current.difficulties).toEqual({})
    expect(db.tables.workout_sessions).toHaveLength(0)
  })

  // Regression: the screen's rows used to never learn their rpe, so removing
  // the set holding the tap didn't move it down (the DB lost it).
  it('moves it back down when the set holding it is removed', async () => {
    const { result } = await mount()
    await benchSets(result, 2)
    await run(result, (ws) => ws.setDifficulty(BENCH, '1-2'))
    await benchSets(result, 3)
    const top = result.current.logs['db-bench-press'][3]
    await run(result, (ws) => ws.removeSet(BENCH, top))
    expect(rpes()).toEqual([null, 8.5])
  })

  it('tap difficulty, log a higher set, remove it: exact rows left in the DB', async () => {
    const { result } = await mount()
    await run(result, (ws) => ws.logSet(BENCH, 0, { weight: '35', reps: '10' }))
    await run(result, (ws) => ws.logSet(BENCH, 1, { weight: '35', reps: '9' }))
    await run(result, (ws) => ws.setDifficulty(BENCH, '1-2'))
    await run(result, (ws) => ws.logSet(BENCH, 2, { weight: '35', reps: '8' }))
    expect(rpes()).toEqual([null, null, 8.5])

    const sessionId = result.current.session.id
    fake.queries.length = 0
    await run(result, (ws) => ws.removeSet(BENCH, ws.logs['db-bench-press'][3]))

    const pick = ({ session_id, exercise_id, exercise_name, set_number, weight, weight_unit, reps, rpe, is_cardio }) => ({
      session_id, exercise_id, exercise_name, set_number, weight, weight_unit, reps, rpe, is_cardio,
    })
    expect(db.tables.exercise_logs.map(pick)).toEqual([
      { session_id: sessionId, exercise_id: 'db-bench-press', exercise_name: 'DB Bench Press', set_number: 1, weight: 35, weight_unit: 'lb', reps: 10, rpe: null, is_cardio: false },
      { session_id: sessionId, exercise_id: 'db-bench-press', exercise_name: 'DB Bench Press', set_number: 2, weight: 35, weight_unit: 'lb', reps: 9, rpe: 8.5, is_cardio: false },
    ])
    expect(db.tables.workout_sessions).toEqual([expect.objectContaining({ id: sessionId, status: 'in_progress' })])

    // The writes the removal made: delete the row, re-home the tap with one
    // rpe update on the new highest set, then the remaining-sets count.
    const set2Id = logsFor('db-bench-press')[1].id
    expect(fake.queries.map((q) => [q.table, q.ops.find((op) => ['delete', 'update', 'select'].includes(op.name)).name])).toEqual([
      ['exercise_logs', 'delete'],
      ['exercise_logs', 'select'],
      ['exercise_logs', 'update'],
      ['exercise_logs', 'select'],
    ])
    const update = fake.queries.find((q) => hasOp(q, 'update'))
    expect(update.ops.map((op) => [op.name, ...op.args])).toEqual([
      ['update', { rpe: 8.5 }],
      ['eq', 'id', set2Id],
    ])

    // The screen's copy matches the DB.
    expect(result.current.logs['db-bench-press'][2].rpe).toBe(8.5)
    expect(result.current.difficulties['db-bench-press']).toBe('1-2')
  })

  it('moves the tap down when it was set directly on the top set', async () => {
    const { result } = await mount()
    await benchSets(result, 3)
    await run(result, (ws) => ws.setDifficulty(BENCH, '0'))
    await run(result, (ws) => ws.removeSet(BENCH, ws.logs['db-bench-press'][3]))
    expect(rpes()).toEqual([null, 10])
  })

  it('writes no rpe update when the removed set did not hold the tap', async () => {
    const { result } = await mount()
    await benchSets(result, 3)
    await run(result, (ws) => ws.setDifficulty(BENCH, '3+'))
    fake.queries.length = 0
    await run(result, (ws) => ws.removeSet(BENCH, ws.logs['db-bench-press'][1]))
    expect(fake.queries.some((q) => hasOp(q, 'update'))).toBe(false)
    expect(rpes()).toEqual([null, 7])
  })

  it('keeps the screen rows equal to the DB after every sync', async () => {
    const { result } = await mount()
    await benchSets(result, 2)
    await run(result, (ws) => ws.setDifficulty(BENCH, '1-2'))
    await run(result, (ws) => ws.logSet(BENCH, 2, { weight: '35', reps: '8' }))
    const screenRpes = () => Object.values(result.current.logs['db-bench-press']).map((r) => r.rpe)
    expect(screenRpes()).toEqual(rpes())
    await run(result, (ws) => ws.setDifficulty(BENCH, null))
    expect(screenRpes()).toEqual([null, null, null])
  })
})

describe('finish decision', () => {
  async function logSets(result, count) {
    const exercises = DAY.exercises
    for (let i = 0; i < count; i++) {
      const ex = exercises[i % exercises.length]
      await run(result, (ws) => ws.logSet(ex, Math.floor(i / exercises.length), { weight: '20', reps: '10' }))
    }
  }

  it('does nothing with no sets logged', async () => {
    const { result } = await mount()
    act(() => result.current.requestFinish())
    expect(result.current.confirmingFinish).toBe(false)
    expect(result.current.result).toBeNull()
  })

  it('asks first under 6 sets, and "save as partial" writes partial', async () => {
    const { result } = await mount()
    await logSets(result, 3)
    act(() => result.current.requestFinish())
    expect(result.current.confirmingFinish).toBe(true)
    expect(db.tables.workout_sessions[0].status).toBe('in_progress')

    await run(result, (ws) => ws.finish(false))
    expect(db.tables.workout_sessions[0]).toMatchObject({ status: 'partial', closed_by: 'user', session_rpe: null })
    expect(result.current.result).toMatchObject({ kind: 'finished', status: 'partial', setsCompleted: 3, totalVolume: 600 })
    expect(result.current.confirmingFinish).toBe(false)
    expect(localStorage.getItem(draftStorageKey('day-1'))).toBeNull()
  })

  it('"count it" under 6 sets writes completed', async () => {
    const { result } = await mount()
    await logSets(result, 2)
    await run(result, (ws) => ws.finish(true))
    expect(db.tables.workout_sessions[0].status).toBe('completed')
  })

  it('finishes straight away at 6+ sets, with the effort pick', async () => {
    const { result } = await mount()
    await logSets(result, 6)
    act(() => result.current.setSessionRpe(8))
    await run(result, async (ws) => {
      ws.requestFinish()
    })
    await waitFor(() => expect(result.current.result?.kind).toBe('finished'))
    expect(db.tables.workout_sessions[0]).toMatchObject({ status: 'completed', session_rpe: 8, closed_by: 'user' })
    expect(result.current.locked).toBe(true)
  })

  it('shows "closed" when the session was auto-closed before Finish landed', async () => {
    const { result } = await mount()
    await logSets(result, 6)
    db.tables.workout_sessions[0].status = 'completed'
    await run(result, (ws) => ws.finish(true))
    expect(result.current.result).toEqual({ kind: 'auto-closed' })
  })
})

describe('loading', () => {
  it('reports a failed load instead of showing a fresh block, and retries', async () => {
    fake.respond(() => ({ data: null, error: new Error('offline') }))
    const { result } = renderHook(() => useWorkoutSession('day-1'))
    await waitFor(() => expect(result.current.loadError).toBeTruthy())
    expect(result.current.ready).toBe(false)

    fake.respond(db.respond)
    act(() => result.current.retryLoad())
    expect(result.current.loadError).toBeNull()
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.weekMeta.sessionNumber).toBe(1)
  })

  it('gives up waiting after 8 seconds', async () => {
    vi.useFakeTimers()
    try {
      // Every read hangs: a thenable that never settles.
      fake.respond(() => ({ then() {} }))
      const { result } = renderHook(() => useWorkoutSession('day-1'))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(7999)
      })
      expect(result.current.loadError).toBeNull()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(result.current.loadError?.name).toBe('LoadTimeoutError')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('auto-close while open', () => {
  it('stops logging and clears the draft when this session is auto-closed', async () => {
    const { result } = await mount()
    await run(result, (ws) => ws.logSet(BENCH, 0, { weight: '35', reps: '10' }))
    const id = result.current.session.id
    act(() => {
      window.dispatchEvent(new CustomEvent(SESSIONS_AUTO_CLOSED_EVENT, { detail: { sessionIds: [id] } }))
    })
    expect(result.current.result).toEqual({ kind: 'auto-closed' })
    expect(result.current.locked).toBe(true)
    expect(localStorage.getItem(draftStorageKey('day-1'))).toBeNull()
  })
})
