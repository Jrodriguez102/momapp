import { describe, expect, it } from 'vitest'
import {
  PROGRAM_DAYS,
  SESSIONS_PER_BLOCK,
  LAST_SET_DIFFICULTY_OPTIONS,
  getWeekMeta,
  applyDeloadToSets,
} from './program'

describe('program content invariants (Block 01)', () => {
  it('runs 4 days in queue order', () => {
    expect(PROGRAM_DAYS.map((d) => d.id)).toEqual(['day-1', 'day-2', 'day-3', 'day-4'])
  })

  it('has 22 slots covering 21 unique movements', () => {
    const ids = PROGRAM_DAYS.flatMap((d) => d.exercises.map((ex) => ex.id))
    expect(ids).toHaveLength(22)
    expect(new Set(ids).size).toBe(21)
  })

  it('gives every exercise exactly 2 alternatives, a parseable rep range and weight config', () => {
    for (const day of PROGRAM_DAYS) {
      for (const ex of day.exercises) {
        expect(ex.alternatives, ex.id).toHaveLength(2)
        expect(ex.repRange, ex.id).toMatch(/\d+\s*-\s*\d+/)
        expect(ex.weight.increment, ex.id).toBeGreaterThan(0)
        expect(['high', 'low'], ex.id).toContain(ex.weight.confidence)
      }
    }
  })

  it('never repeats a movement name within a day (swap rename relies on this)', () => {
    for (const day of PROGRAM_DAYS) {
      const names = day.exercises.flatMap((ex) => [ex.name, ...ex.alternatives.map((a) => a.name)])
      expect(new Set(names).size, day.id).toBe(names.length)
    }
  })

  it('gives every day a short label and a display-only duration estimate', () => {
    for (const day of PROGRAM_DAYS) {
      expect(day.shortLabel, day.id).toBeTruthy()
      expect(day.estimatedMinutes, day.id).toBeGreaterThan(0)
    }
  })

  it('is 24 sessions per block', () => {
    expect(SESSIONS_PER_BLOCK).toBe(24)
  })

  it('maps last-set difficulty to the frozen rpe values', () => {
    expect(LAST_SET_DIFFICULTY_OPTIONS.map((o) => [o.value, o.rpe])).toEqual([
      ['3+', 7],
      ['1-2', 8.5],
      ['0', 10],
    ])
  })
})

describe('getWeekMeta', () => {
  it('treats weeks 1-5 as progressive and week 6 as deload', () => {
    for (const week of [1, 2, 3, 4, 5]) expect(getWeekMeta(week).weekType).toBe('progressive')
    expect(getWeekMeta(6)).toMatchObject({ weekType: 'deload', label: 'Week 6 (Deload)' })
  })
})

describe('applyDeloadToSets', () => {
  it('leaves progressive weeks alone', () => {
    expect(applyDeloadToSets(4, 3)).toBe(4)
  })

  it('halves sets in the deload week with a floor of 2', () => {
    expect(applyDeloadToSets(4, 6)).toBe(2)
    expect(applyDeloadToSets(3, 6)).toBe(2)
    expect(applyDeloadToSets(5, 6)).toBe(3)
  })
})
