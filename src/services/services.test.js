// Services are the throwing layer: reads must reject on a Supabase error so
// new screens can show a real error state (the helpers.js barrel keeps the
// old swallow-and-fallback behavior for existing screens).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fake } from '../test/fakeSupabase'
import * as sessionsApi from './sessionsApi'
import * as setsApi from './setsApi'
import * as bodyWeightApi from './bodyWeightApi'

vi.mock('../lib/supabase', async () => ({ supabase: (await import('../test/fakeSupabase')).fake.client }))

beforeEach(() => {
  fake.reset()
  fake.respond(() => ({ data: null, error: new Error('offline') }))
})

describe('service reads reject on error', () => {
  it.each([
    ['fetchCompletedSessionCount', () => sessionsApi.fetchCompletedSessionCount()],
    ['fetchBlockState', () => sessionsApi.fetchBlockState()],
    ['fetchRecentCompletedSessionCount', () => sessionsApi.fetchRecentCompletedSessionCount()],
    ['fetchTrainingWeek', () => sessionsApi.fetchTrainingWeek()],
    ['fetchWeeklyStreak', () => sessionsApi.fetchWeeklyStreak()],
    ['fetchWorkoutsThisMonth', () => sessionsApi.fetchWorkoutsThisMonth()],
    ['fetchFinishedSessions', () => sessionsApi.fetchFinishedSessions()],
    ['fetchInProgressSession', () => sessionsApi.fetchInProgressSession('day-1')],
    ['fetchAnyInProgressSession', () => sessionsApi.fetchAnyInProgressSession()],
    ['fetchProgressionLogs', () => setsApi.fetchProgressionLogs(['DB Bench Press'])],
    ['fetchSessionExerciseLogs', () => setsApi.fetchSessionExerciseLogs('s1')],
    ['fetchExerciseLogsForSessions', () => setsApi.fetchExerciseLogsForSessions(['s1'])],
    ['fetchAllStrengthLogs', () => setsApi.fetchAllStrengthLogs()],
    ['fetchBodyWeightLogs', () => bodyWeightApi.fetchBodyWeightLogs()],
    ['fetchWeighInDue', () => bodyWeightApi.fetchWeighInDue()],
  ])('%s', async (_, read) => {
    await expect(read()).rejects.toThrow('offline')
  })
})

describe('createSession', () => {
  it('still inserts when the resume lookup fails (unchanged behavior)', async () => {
    fake.respond((q) => (q.ops.some((op) => op.name === 'insert') ? { data: { id: 'new' } } : { data: null, error: new Error('offline') }))
    expect(await sessionsApi.createSession('day-1', 1)).toEqual({ id: 'new' })
  })
})

describe('fetchAllStrengthLogs', () => {
  it('reads non-cardio sets oldest first, with their session block', async () => {
    fake.respond(() => ({ data: [{ id: 'a' }] }))
    expect(await setsApi.fetchAllStrengthLogs()).toEqual([{ id: 'a' }])
    const [q] = fake.queries
    expect(q.ops.map((op) => [op.name, ...op.args])).toEqual([
      ['select', '*, workout_sessions!inner(block)'],
      ['eq', 'is_cardio', false],
      ['order', 'logged_at', { ascending: true }],
    ])
  })
})
