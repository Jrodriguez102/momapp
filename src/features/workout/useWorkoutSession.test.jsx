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

  // KNOWN BUG (pre-existing, reported, not fixed in the extract-only
  // commit): the row kept in state after a save never learns its rpe, so
  // removing the set that holds the difficulty doesn't move it down — the
  // tap is lost from the DB while the screen still shows it. `it.fails`
  // passes while the bug exists; delete `.fails` once it's fixed.
  it.fails('moves it back down when the set holding it is removed', async () => {
    const { result } = await mount()
    await benchSets(result, 2)
    await run(result, (ws) => ws.setDifficulty(BENCH, '1-2'))
    await benchSets(result, 3)
    const top = result.current.logs['db-bench-press'][3]
    await run(result, (ws) => ws.removeSet(BENCH, top))
    expect(rpes()).toEqual([null, 8.5])
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
