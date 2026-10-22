import { describe, expect, it } from 'vitest'
import { buildBlockState } from './block'
import { getAutoCloseDecision, getFinishStatus, getSetSpanSeconds, AUTO_CLOSE_IDLE_MS, AUTO_CLOSE_MAX_MS } from './sessionRules'
import { isWeighInDue, getWeekRange, getMonthRange, WEIGH_IN_INTERVAL_MS } from './calendar'

describe('buildBlockState', () => {
  it('starts a fresh block at day 1', () => {
    expect(buildBlockState([])).toMatchObject({ sessionNumber: 1, lastCompletedDayId: null, nextDay: { id: 'day-1' } })
  })

  it('reads the queue position from the newest completed session', () => {
    expect(buildBlockState([{ day_id: 'day-2' }, { day_id: 'day-1' }])).toMatchObject({ sessionNumber: 3, nextDay: { id: 'day-3' } })
  })
})

describe('getFinishStatus / getSetSpanSeconds', () => {
  it('completes at 6+ sets or when she counts it', () => {
    expect(getFinishStatus(6, false)).toBe('completed')
    expect(getFinishStatus(5, false)).toBe('partial')
    expect(getFinishStatus(1, true)).toBe('completed')
  })

  it('measures first -> last set in whole seconds', () => {
    expect(getSetSpanSeconds([3_000, 1_000, 61_400])).toBe(60)
    expect(getSetSpanSeconds([5_000])).toBe(0)
  })
})

describe('getAutoCloseDecision', () => {
  const now = 10 * 60 * 60 * 1000
  const startedAt = (msAgo) => new Date(now - msAgo).toISOString()

  it('keeps a session with recent activity', () => {
    expect(getAutoCloseDecision({ startedAt: startedAt(30 * 60 * 1000), setTimes: [now - 60_000], now })).toEqual({ action: 'keep' })
  })

  it('deletes a stale session with no sets', () => {
    expect(getAutoCloseDecision({ startedAt: startedAt(AUTO_CLOSE_IDLE_MS), setTimes: [], now })).toEqual({ action: 'delete' })
  })

  it('closes after 90 idle minutes, dated at the last set', () => {
    const setTimes = [now - AUTO_CLOSE_IDLE_MS - 20 * 60_000, now - AUTO_CLOSE_IDLE_MS]
    const decision = getAutoCloseDecision({ startedAt: startedAt(AUTO_CLOSE_IDLE_MS + 21 * 60_000), setTimes, now })
    expect(decision).toEqual({
      action: 'close',
      patch: { status: 'partial', completed_at: new Date(now - AUTO_CLOSE_IDLE_MS).toISOString(), duration_seconds: 20 * 60, closed_by: 'auto' },
    })
  })

  it('closes at the 2h cap even while active, completed with 6+ sets', () => {
    const setTimes = Array.from({ length: 6 }, (_, i) => now - AUTO_CLOSE_MAX_MS + i * 20 * 60_000)
    const decision = getAutoCloseDecision({ startedAt: startedAt(AUTO_CLOSE_MAX_MS), setTimes, now })
    expect(decision.action).toBe('close')
    expect(decision.patch.status).toBe('completed')
  })
})

describe('calendar ranges', () => {
  it('spans Monday to the next Monday', () => {
    const { start, end } = getWeekRange(new Date(2026, 9, 25, 12)) // a Sunday
    expect(start).toEqual(new Date(2026, 9, 19))
    expect(end).toEqual(new Date(2026, 9, 26))
  })

  it('spans the calendar month', () => {
    expect(getMonthRange(new Date(2026, 11, 15))).toEqual({ start: new Date(2026, 11, 1), end: new Date(2027, 0, 1) })
  })
})

describe('isWeighInDue', () => {
  const now = new Date(2026, 9, 21, 10)
  it('is due with no entry or one at least 7 days old', () => {
    expect(isWeighInDue(null, now)).toBe(true)
    expect(isWeighInDue(new Date(now.getTime() - WEIGH_IN_INTERVAL_MS).toISOString(), now)).toBe(true)
    expect(isWeighInDue(new Date(now.getTime() - WEIGH_IN_INTERVAL_MS + 1).toISOString(), now)).toBe(false)
  })
})
