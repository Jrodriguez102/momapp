import { describe, expect, it } from 'vitest'
import {
  bestTopSet,
  bodyWeightSummary,
  bodyWeightText,
  exerciseSessions,
  formatDelta,
  progressExerciseNames,
  topSetText,
} from './progressMath'

const now = new Date(2026, 9, 21, 12)
const daysAgo = (d) => new Date(now.getTime() - d * 86_400_000).toISOString()
const weights = [
  { weight: 156.2, logged_at: daysAgo(91) },
  { weight: 154.0, logged_at: daysAgo(49) },
  { weight: 152.4, logged_at: daysAgo(28) },
  { weight: 153.2, logged_at: daysAgo(9) },
]

describe('body weight', () => {
  it('computes the delta over the selected timeframe, not since the first entry ever', () => {
    expect(bodyWeightSummary(weights, '1m', now)).toMatchObject({ delta: 0.8, current: weights[3] })
    expect(bodyWeightSummary(weights, '3m', now).delta).toBe(-3)
    expect(bodyWeightSummary(weights, 'all', now).delta).toBe(-3)
  })

  it('has no delta with fewer than two weigh-ins in range', () => {
    const one = bodyWeightSummary([weights[3]], '1m', now)
    expect(one.delta).toBeNull()
    expect(bodyWeightText(one, '1m')).toBe('1 weigh-in over the last month — log another to see a trend.')
    expect(bodyWeightText(bodyWeightSummary([], '3m', now), '3m')).toBe('No weigh-ins in the last 3 months.')
    expect(bodyWeightText(bodyWeightSummary([], 'all', now), 'all')).toBe('No weigh-ins yet.')
  })

  it('formats the delta neutrally and the summary line', () => {
    expect(formatDelta(0.8)).toBe('+0.8 lb')
    expect(formatDelta(-3)).toBe('−3 lb')
    expect(formatDelta(0)).toBe('No change')
    expect(bodyWeightText(bodyWeightSummary(weights, '1m', now), '1m')).toBe('Up 0.8 lb over the last month · 2 weigh-ins')
    expect(bodyWeightText(bodyWeightSummary(weights, '3m', now), '3m')).toBe('Down 3 lb over the last 3 months · 4 weigh-ins')
    expect(bodyWeightText(bodyWeightSummary(weights, 'all', now), 'all')).toMatch(/^Down 3 lb since Jul 2[12] · 4 weigh-ins$/)
  })
})

describe('lifts', () => {
  const log = (name, sessionId, setNumber, weight, reps, day, block = 1) => ({
    exercise_name: name, session_id: sessionId, set_number: setNumber, weight, reps, logged_at: daysAgo(day), workout_sessions: { block },
  })
  const logs = [
    log('KB Sumo Deadlift', 'p', 1, 35, 12, 40, 0),
    log('DB Bench Press', 'p', 1, 30, 12, 40, 0),
    log('DB Bench Press', 'a', 1, 35, 10, 12),
    log('DB Bench Press', 'a', 2, 35, 9, 12),
    log('DB Bench Press', 'b', 1, 40, 8, 1),
    log('Lat Pulldown', 'b', 1, 90, 12, 2),
  ]

  it('lists names logged in Block 01, most recent first, hiding pilot-only names', () => {
    expect(progressExerciseNames(logs)).toEqual(['DB Bench Press', 'Lat Pulldown'])
  })

  it('builds per-session top sets, best top set and the summary', () => {
    const sessions = exerciseSessions(logs, 'DB Bench Press')
    expect(sessions.map((s) => [s.sessionId, s.top.weight, s.top.reps, s.estimated1RM])).toEqual([
      ['p', 30, 12, 42], ['a', 35, 10, 47], ['b', 40, 8, 51],
    ])
    expect(bestTopSet(sessions).sessionId).toBe('b')
    expect(topSetText(sessions)).toBe('Up 10 lb across 3 sessions')
    expect(topSetText(sessions.slice(0, 1))).toBe('1 session so far — log it again to see a trend.')
    expect(topSetText([{ top: { weight: 40 } }, { top: { weight: 37.5 } }])).toBe('Down 2.5 lb across 2 sessions')
    expect(topSetText([{ top: { weight: 40 } }, { top: { weight: 40 } }])).toBe('Same top weight across 2 sessions')
  })
})
