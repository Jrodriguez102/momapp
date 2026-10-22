// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { clearDraft, draftStorageKey, EMPTY_DRAFT, loadDraft, saveDraft } from './workoutDraft'

beforeEach(() => localStorage.clear())

describe('workoutDraft', () => {
  it('uses the Block 01 key', () => {
    expect(draftStorageKey('day-2')).toBe('block1:session-in-progress-day-2')
  })

  it('round-trips the exact JSON format', () => {
    const draft = { entries: { 'leg-press': [null, { weight: '300' }] }, swaps: { 'leg-press': { name: 'Hack Squat Machine', demoUrl: 'x' } }, sessionRpe: 7 }
    saveDraft('day-4', draft)
    expect(localStorage.getItem('block1:session-in-progress-day-4')).toBe(
      '{"entries":{"leg-press":[null,{"weight":"300"}]},"swaps":{"leg-press":{"name":"Hack Squat Machine","demoUrl":"x"}},"sessionRpe":7}',
    )
    expect(loadDraft('day-4')).toEqual(draft)
  })

  it('reads a draft written by the old screen', () => {
    localStorage.setItem('block1:session-in-progress-day-1', '{"entries":{},"swaps":{}}')
    expect(loadDraft('day-1')).toEqual(EMPTY_DRAFT)
  })

  it('falls back to an empty draft for missing or corrupt data', () => {
    expect(loadDraft('day-3')).toEqual(EMPTY_DRAFT)
    localStorage.setItem('block1:session-in-progress-day-3', '{not json')
    expect(loadDraft('day-3')).toEqual(EMPTY_DRAFT)
  })

  it('clears it', () => {
    saveDraft('day-1', EMPTY_DRAFT)
    clearDraft('day-1')
    expect(localStorage.getItem('block1:session-in-progress-day-1')).toBeNull()
  })
})
