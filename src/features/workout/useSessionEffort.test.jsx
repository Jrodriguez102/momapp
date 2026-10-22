// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { fake, hasOp, opArgs } from '@/test/fakeSupabase'
import { createMemoryDb } from '@/test/memorySupabase'
import { toast } from '@/ui/toast'
import { useSessionEffort } from './useSessionEffort'

vi.mock('@/lib/supabase', async () => ({ supabase: (await import('@/test/fakeSupabase')).fake.client }))
vi.mock('@/ui/toast', () => ({ toast: { error: vi.fn(), dismiss: vi.fn() } }))

let db
const finished = { id: 's1', day_id: 'day-1', block: 1, week_in_block: 1, status: 'completed', closed_by: 'user', session_rpe: null, completed_at: '2026-10-21T17:00:00.000Z', duration_seconds: 2700 }

beforeEach(() => {
  fake.reset()
  db = createMemoryDb({ workout_sessions: [{ ...finished }] })
  fake.respond(db.respond)
  toast.error.mockClear()
  toast.dismiss.mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const session = () => db.tables.workout_sessions[0]

describe('useSessionEffort', () => {
  it('saves only session_rpe, leaving the finished workout as it was', async () => {
    const { result } = renderHook(() => useSessionEffort('s1'))
    await act(() => result.current.choose(7))
    expect(session()).toEqual({ ...finished, session_rpe: 7 })
    expect(result.current).toMatchObject({ value: 7, status: 'saved' })
    const updates = fake.queries.filter((q) => hasOp(q, 'update'))
    expect(updates.map((q) => opArgs(q, 'update')[0])).toEqual([{ session_rpe: 7 }])
  })

  it('clears it when the pick is tapped again (null)', async () => {
    const { result } = renderHook(() => useSessionEffort('s1', 7))
    await act(() => result.current.choose(null))
    expect(session().session_rpe).toBeNull()
  })

  it('writes nothing if she skips it', () => {
    renderHook(() => useSessionEffort('s1'))
    expect(fake.queries).toHaveLength(0)
    expect(session().session_rpe).toBeNull()
  })

  it('lands the latest pick last when tapped quickly', async () => {
    const { result } = renderHook(() => useSessionEffort('s1'))
    await act(async () => {
      result.current.choose(5)
      result.current.choose(8)
      await result.current.choose(6)
    })
    expect(session().session_rpe).toBe(6)
    expect(result.current.status).toBe('saved')
  })

  it('on failure: toast with Retry, workout untouched; Retry saves the latest pick', async () => {
    fake.respond((q) => (hasOp(q, 'update') ? { data: null, error: new Error('offline') } : db.respond(q)))
    const { result } = renderHook(() => useSessionEffort('s1'))
    await act(() => result.current.choose(9))
    expect(result.current).toMatchObject({ value: 9, status: 'error' })
    expect(session()).toEqual(finished)
    expect(toast.error).toHaveBeenCalledTimes(1)
    const [message, options] = toast.error.mock.calls[0]
    expect(message).toBe("Couldn't save how hard it was")
    expect(options.action.label).toBe('Retry')

    fake.respond(db.respond)
    await act(() => options.action.onClick())
    expect(session().session_rpe).toBe(9)
    expect(result.current.status).toBe('saved')
    expect(toast.dismiss).toHaveBeenCalledWith('effort-save')
  })
})
