import { describe, expect, it } from 'vitest'
import {
  formatRepRange,
  hasUnsavedEntries,
  isExerciseComplete,
  nextIncompleteExercise,
  nextOpenSetNumber,
} from './exerciseProgress'

describe('isExerciseComplete', () => {
  it('needs every prescribed set number', () => {
    expect(isExerciseComplete(3, { 1: {}, 2: {}, 3: {} })).toBe(true)
    expect(isExerciseComplete(3, { 1: {}, 3: {} })).toBe(false)
    expect(isExerciseComplete(3, { 1: {}, 3: {} }, 2)).toBe(true)
    expect(isExerciseComplete(2, {})).toBe(false)
  })
})

describe('nextIncompleteExercise', () => {
  const exercises = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  const done = (ids) => (ex) => ids.includes(ex.id)

  it('starts from the top, or after the given exercise, wrapping around', () => {
    expect(nextIncompleteExercise(exercises, done([]))?.id).toBe('a')
    expect(nextIncompleteExercise(exercises, done(['a']), 'a')?.id).toBe('b')
    expect(nextIncompleteExercise(exercises, done(['c']), 'c')?.id).toBe('a')
    expect(nextIncompleteExercise(exercises, done(['b', 'c']), 'c')?.id).toBe('a')
  })

  it('returns null when everything else is done', () => {
    expect(nextIncompleteExercise(exercises, done(['a', 'b', 'c']))).toBeNull()
    expect(nextIncompleteExercise(exercises, done(['b', 'c']), 'a')).toBeNull()
  })
})

describe('nextOpenSetNumber', () => {
  it('finds the next unlogged row after the one just saved', () => {
    expect(nextOpenSetNumber(4, { 1: {} }, 1)).toBe(2)
    expect(nextOpenSetNumber(4, { 1: {}, 2: {} }, 1, 3)).toBe(4)
    expect(nextOpenSetNumber(3, { 2: {}, 3: {} }, 3)).toBe(1)
    expect(nextOpenSetNumber(2, { 1: {} }, 1, 2)).toBeNull()
  })
})

describe('formatRepRange', () => {
  it('spells out reps, keeping per-side ranges', () => {
    expect(formatRepRange('8-10')).toBe('8–10 reps')
    expect(formatRepRange('12-15 / leg')).toBe('12–15 reps / leg')
  })
})

describe('hasUnsavedEntries', () => {
  it('ignores empty slots and untouched fields', () => {
    expect(hasUnsavedEntries([])).toBe(false)
    expect(hasUnsavedEntries([undefined, null, {}, { weight: '' }])).toBe(false)
    expect(hasUnsavedEntries([undefined, { reps: '8' }])).toBe(true)
    expect(hasUnsavedEntries([{ weight: '40' }])).toBe(true)
  })
})
