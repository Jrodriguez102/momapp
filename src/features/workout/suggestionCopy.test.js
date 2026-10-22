import { describe, expect, it } from 'vitest'
import { goalLine, suggestionCallout } from './suggestionCopy'

const base = { unit: 'lb', lastWeight: 30, lastReps: 10, goalWeight: 40 }

describe('suggestionCallout', () => {
  it.each([
    [{ action: 'increase', targetWeight: 32.5, targetReps: 8 }, 'Last time 30 lb × 10. Try 32.5 lb today.'],
    [{ action: 'decrease', targetWeight: 25, targetReps: 8 }, 'Last time 30 lb × 10. Drop to 25 lb today and aim for 8 reps.'],
    [{ action: 'more-reps', targetWeight: 30, targetReps: 11 }, 'Last time 30 lb × 10. Same weight — aim for 11 reps.'],
    [{ action: 'hold', targetWeight: 30, targetReps: 12 }, "Last time 30 lb × 10. Stay at 30 lb today. Weight goes up once you've done 3 workouts in 7 days."],
    [{ action: 'repeat-once', targetWeight: 30, targetReps: 12 }, 'Last time 30 lb × 10. That was all-out — repeat 30 lb today.'],
    [{ action: 'deload', targetWeight: 30, targetReps: null }, 'Deload week — 30 lb, fewer sets. Keep it easy.'],
    [{ action: 'calibrate', targetWeight: null, targetReps: null }, 'Calibrating — pick a weight that leaves 2–3 reps in the tank.'],
  ])('%o', (s, text) => {
    expect(suggestionCallout({ ...base, ...s })).toBe(text)
  })

  it('handles a first session with and without a start weight', () => {
    expect(suggestionCallout({ unit: 'lb', lastWeight: null, action: 'start', targetWeight: 35, targetReps: 8 })).toBe(
      'Start at 35 lb and aim for 8 reps.',
    )
    expect(suggestionCallout({ unit: 'lb', lastWeight: null, action: 'start', targetWeight: null, targetReps: 8 })).toBe(
      'First time on this one — pick a weight that leaves 2–3 reps.',
    )
    expect(suggestionCallout(null)).toBeNull()
  })
})

describe('goalLine', () => {
  it('shows the block goal for the base exercise only', () => {
    expect(goalLine(base)).toBe('Goal 40 lb by week 5')
    expect(goalLine({ ...base, goalWeight: null })).toBeNull()
  })
})
