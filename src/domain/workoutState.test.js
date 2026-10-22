import { describe, expect, it } from 'vitest'
import { allLoggedRows, applyRestoredSwaps, getFinishAction, getRowCount, prefillWeights, restoreFromSessionLogs } from './workoutState'
import { findDayById } from './metrics'

const DAY = findDayById('day-1')
const LAT = DAY.exercises.find((ex) => ex.id === 'lat-pulldown')

describe('restoreFromSessionLogs', () => {
  it('groups rows by slot and set, reads the difficulty and the logged swap', () => {
    const rows = [
      { exercise_id: 'db-bench-press', exercise_name: 'DB Bench Press', set_number: 2, rpe: 10 },
      { exercise_id: 'db-bench-press', exercise_name: 'DB Bench Press', set_number: 1, rpe: null },
      { exercise_id: 'lat-pulldown', exercise_name: 'Close-Grip Pulldown', set_number: 1, rpe: null },
    ]
    const { logs, difficulties, swaps } = restoreFromSessionLogs(DAY, rows)
    expect(Object.keys(logs['db-bench-press'])).toEqual(['1', '2'])
    expect(difficulties).toEqual({ 'db-bench-press': '0' })
    expect(swaps).toEqual({ 'db-bench-press': null, 'lat-pulldown': LAT.alternatives.find((a) => a.name === 'Close-Grip Pulldown') })
  })
})

describe('applyRestoredSwaps', () => {
  it('lets logged names win and keeps the draft for untouched slots', () => {
    const draft = { a: { name: 'Draft A' }, b: { name: 'Draft B' } }
    expect(applyRestoredSwaps(draft, { a: null, c: { name: 'Logged C' } })).toEqual({ b: { name: 'Draft B' }, c: { name: 'Logged C' } })
    expect(draft).toEqual({ a: { name: 'Draft A' }, b: { name: 'Draft B' } }) // not mutated
  })
})

describe('prefillWeights / getRowCount / allLoggedRows', () => {
  it('starts from the suggestion and carries each logged weight forward', () => {
    expect(prefillWeights({ logsBySet: { 1: { weight: 40 }, 3: { weight: 42.5 } }, prefillWeight: 35, rowCount: 4 })).toEqual([35, 40, 40, 42.5])
    expect(prefillWeights({ logsBySet: {}, prefillWeight: null, rowCount: 2 })).toEqual(['', ''])
  })

  it('shows extra logged sets beyond the prescription', () => {
    expect(getRowCount(3, {})).toBe(3)
    expect(getRowCount(3, { 1: {}, 4: {} })).toBe(4)
  })

  it('flattens logged rows', () => {
    expect(allLoggedRows({ a: { 1: 'r1', 2: 'r2' }, b: { 1: 'r3' } })).toEqual(['r1', 'r2', 'r3'])
  })
})

describe('getFinishAction', () => {
  it('blocks with no saved set, confirms under 6, finishes at 6+', () => {
    expect(getFinishAction(0, true)).toBe('blocked')
    expect(getFinishAction(3, false)).toBe('blocked')
    expect(getFinishAction(5, true)).toBe('confirm')
    expect(getFinishAction(6, true)).toBe('finish')
  })
})
