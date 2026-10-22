import { describe, expect, it } from 'vitest'
import { buildWeekRows, getDayFocus, getExercisePreview } from './weekPlan'
import { buildBlockState } from './block'
import { buildTrainingWeek } from './calendar'
import { findDayById } from './metrics'

// Planned weekdays are Mon, Tue, Thu, Fri. Week of Mon 2026-10-19.
const at = (day, hour = 9) => new Date(2026, 9, day, hour)
const completedOn = (day, dayId) => ({ day_id: dayId, completed_at: at(day).toISOString() })

// n completed block sessions, the newest being `lastDayId`.
function blockAfter(n, lastDayId) {
  return buildBlockState(Array.from({ length: n }, (_, i) => ({ day_id: i === 0 ? lastDayId : 'day-1' })))
}

function rowsFor({ now, sessions, block, inProgressDayId }) {
  return buildWeekRows({ trainingWeek: buildTrainingWeek(sessions, now), blockState: block, inProgressDayId }).map((r) => [
    r.date.getDate(),
    r.kind,
    r.programDay?.id ?? null,
    ...(r.inProgress ? ['in-progress'] : []),
  ])
}

describe('buildWeekRows', () => {
  it('mid-block week: one completed, today, two upcoming in queue order', () => {
    const rows = rowsFor({ now: at(20), sessions: [completedOn(19, 'day-1')], block: blockAfter(9, 'day-1') })
    expect(rows).toEqual([
      [19, 'completed', 'day-1'],
      [20, 'today', 'day-2'],
      [22, 'upcoming', 'day-3'],
      [23, 'upcoming', 'day-4'],
    ])
  })

  it('shows a missed planned day as a muted row and keeps the queue where it was', () => {
    const rows = rowsFor({ now: at(22), sessions: [completedOn(19, 'day-1')], block: blockAfter(9, 'day-1') })
    expect(rows).toEqual([
      [19, 'completed', 'day-1'],
      [20, 'missed', null],
      [22, 'today', 'day-2'],
      [23, 'upcoming', 'day-3'],
    ])
  })

  it('shows a workout done on an unplanned weekday as completed', () => {
    const rows = rowsFor({
      now: at(22),
      sessions: [completedOn(19, 'day-1'), completedOn(21, 'day-2')],
      block: blockAfter(10, 'day-2'),
    })
    expect(rows).toEqual([
      [19, 'completed', 'day-1'],
      [20, 'missed', null],
      [21, 'completed', 'day-2'],
      [22, 'today', 'day-3'],
      [23, 'upcoming', 'day-4'],
    ])
  })

  it('after training today, the next queue day moves to the following planned day', () => {
    const rows = rowsFor({ now: at(20, 18), sessions: [completedOn(20, 'day-2')], block: blockAfter(10, 'day-2') })
    expect(rows).toEqual([
      [19, 'missed', null],
      [20, 'completed', 'day-2'],
      [22, 'upcoming', 'day-3'],
      [23, 'upcoming', 'day-4'],
    ])
  })

  it('shows an in-progress workout as today, and continues the queue from it', () => {
    // Next in queue is day-2, but she chose day-4.
    const rows = rowsFor({ now: at(20), sessions: [completedOn(19, 'day-1')], block: blockAfter(9, 'day-1'), inProgressDayId: 'day-4' })
    expect(rows).toEqual([
      [19, 'completed', 'day-1'],
      [20, 'today', 'day-4', 'in-progress'],
      [22, 'upcoming', 'day-1'],
      [23, 'upcoming', 'day-2'],
    ])
  })

  it('shows an in-progress workout on an unplanned day too', () => {
    const rows = rowsFor({ now: at(21), sessions: [], block: blockAfter(9, 'day-1'), inProgressDayId: 'day-2' })
    expect(rows.find((r) => r[0] === 21)).toEqual([21, 'today', 'day-2', 'in-progress'])
  })

  it('lists two workouts on one day as two rows', () => {
    const rows = rowsFor({
      now: at(20, 20),
      sessions: [completedOn(20, 'day-1'), { day_id: 'day-2', completed_at: at(20, 19).toISOString() }],
      block: blockAfter(10, 'day-2'),
    })
    expect(rows.filter((r) => r[0] === 20)).toEqual([
      [20, 'completed', 'day-1'],
      [20, 'completed', 'day-2'],
    ])
  })

  it('never projects past the end of the block', () => {
    const rows = rowsFor({ now: at(20), sessions: [], block: blockAfter(22, 'day-2') })
    expect(rows).toEqual([
      [19, 'missed', null],
      [20, 'today', 'day-3'],
      [22, 'upcoming', 'day-4'],
    ])
  })

  it('shows no upcoming rows once the block is complete', () => {
    const rows = rowsFor({ now: at(20), sessions: [completedOn(19, 'day-4')], block: blockAfter(24, 'day-4') })
    expect(rows).toEqual([[19, 'completed', 'day-4']])
  })
})

describe('day helpers', () => {
  it('reads the focus from the day name', () => {
    expect(getDayFocus(findDayById('day-1'))).toBe('Chest / Back')
    expect(getDayFocus({ name: 'Upper A' })).toBeNull()
  })

  it('previews the first lifts and counts the rest', () => {
    expect(getExercisePreview(findDayById('day-1'), 2)).toEqual({ names: ['DB Bench Press', 'Lat Pulldown'], more: 4 })
  })
})
