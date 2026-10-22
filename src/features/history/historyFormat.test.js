import { describe, expect, it } from 'vitest'
import { editHoursLeft, effortText, filterSessions, sessionSummaryParts } from './historyFormat'

const now = new Date(2026, 9, 21, 18, 0) // Wed Oct 21
const at = (month, day, hour = 9) => new Date(2026, month, day, hour).toISOString()

describe('filterSessions', () => {
  const sessions = [{ completed_at: at(9, 21) }, { completed_at: at(9, 19) }, { completed_at: at(9, 18) }, { completed_at: at(9, 1) }, { completed_at: at(8, 30) }]
  it('filters by Monday-start week and calendar month', () => {
    expect(filterSessions(sessions, 'all', now)).toHaveLength(5)
    expect(filterSessions(sessions, 'week', now)).toHaveLength(2)
    expect(filterSessions(sessions, 'month', now)).toHaveLength(4)
  })
})

describe('sessionSummaryParts', () => {
  const logs = [{ weight: 40, reps: 8 }, { weight: 40, reps: 8 }, { weight: null, reps: 10 }]
  it('lists date, minutes, sets and volume', () => {
    expect(sessionSummaryParts({ completed_at: at(9, 20), duration_seconds: 2700 }, logs)).toEqual(['Tue, Oct 20', '45 min', '3 sets', '640 lb'])
  })
  it('marks auto-closed sessions and copes with missing duration', () => {
    expect(sessionSummaryParts({ completed_at: at(9, 20), duration_seconds: null, closed_by: 'auto' }, [logs[0]])).toEqual([
      'Tue, Oct 20', '1 set', '320 lb', 'auto-closed',
    ])
  })
})

describe('editHoursLeft', () => {
  it('rounds up and never shows 0 while editable', () => {
    expect(editHoursLeft({ completed_at: new Date(now.getTime() - 20 * 3600_000).toISOString() }, now)).toBe(28)
    expect(editHoursLeft({ completed_at: new Date(now.getTime() - (48 * 3600_000 - 60_000)).toISOString() }, now)).toBe(1)
  })
})

describe('effortText', () => {
  it('shows the 1-10 effort, the pilot label, or nothing', () => {
    expect(effortText({ session_rpe: 7 })).toBe('Effort 7 of 10 · Hard')
    expect(effortText({ session_rpe: null, effort: 'very_hard' })).toBe('Effort: Very Hard')
    expect(effortText({ session_rpe: null, effort: null })).toBeNull()
  })
})
