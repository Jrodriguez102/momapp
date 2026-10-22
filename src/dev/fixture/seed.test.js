import { describe, expect, it } from 'vitest'
import { findExerciseById } from '@/domain/metrics'
import { isWithinEditWindow } from '@/domain/sessionRules'
import { isWeighInDue } from '@/domain/calendar'
import { buildFixtureDb } from './seed'

const now = new Date(2026, 9, 21, 18, 0).getTime()
const db = buildFixtureDb({ now })
const finished = db.workout_sessions.filter((s) => ['completed', 'partial'].includes(s.status))
const at = new Date(now)

describe('fixture seed (default)', () => {
  it('has the History cases: in/out of the edit window, partial, auto-closed, swapped', () => {
    const recent = db.workout_sessions.find((s) => s.id === 'fx-recent')
    expect(recent.status).toBe('completed')
    expect(isWithinEditWindow(recent, at)).toBe(true)

    const old = db.workout_sessions.find((s) => s.id === 'fx-old')
    expect(old.status).toBe('completed')
    expect(isWithinEditWindow(old, at)).toBe(false)

    expect(db.workout_sessions.find((s) => s.id === 'fx-partial')).toMatchObject({ status: 'partial' })
    expect(db.workout_sessions.find((s) => s.id === 'fx-auto')).toMatchObject({ status: 'completed', closed_by: 'auto', session_rpe: null })

    const swapped = db.exercise_logs.filter((l) => l.session_id === 'fx-swap' && l.exercise_id === 'hack-squat-machine')
    expect(swapped.length).toBeGreaterThan(0)
    expect(swapped.every((l) => l.exercise_name === 'Goblet Squat' && findExerciseById(l.exercise_id).name !== l.exercise_name)).toBe(true)
  })

  it('is a consistent mid-block state: 9 completed in Block 01, Lower A in progress', () => {
    expect(db.workout_sessions.filter((s) => s.block === 1 && s.status === 'completed')).toHaveLength(9)
    expect(db.workout_sessions.filter((s) => s.status === 'in_progress')).toEqual([expect.objectContaining({ id: 'fx-live', day_id: 'day-2' })])
    expect(db.workout_sessions.find((s) => s.block === 0)).toMatchObject({ effort: 'hard' })
  })

  it('stores durations and completion times that match the logged sets', () => {
    for (const s of finished) {
      const times = db.exercise_logs.filter((l) => l.session_id === s.id).map((l) => new Date(l.logged_at).getTime())
      expect(s.duration_seconds, s.id).toBe(Math.round((Math.max(...times) - Math.min(...times)) / 1000))
      expect(new Date(s.completed_at).getTime(), s.id).toBeGreaterThanOrEqual(Math.max(...times))
    }
  })

  it('puts the last-set difficulty only on each exercise’s highest set', () => {
    for (const s of finished) {
      const byExercise = Object.groupBy(db.exercise_logs.filter((l) => l.session_id === s.id), (l) => l.exercise_id)
      for (const rows of Object.values(byExercise)) {
        const top = Math.max(...rows.map((r) => r.set_number))
        expect(rows.filter((r) => r.rpe != null && r.set_number !== top)).toEqual([])
      }
    }
  })

  it('has the Progress cases: 3 months of weigh-ins, varied lifts, a pilot-only and a one-session lift', () => {
    const weighIns = db.body_weight_logs.map((b) => new Date(b.logged_at).getTime())
    expect(db.body_weight_logs.length).toBeGreaterThanOrEqual(12)
    expect((Math.max(...weighIns) - Math.min(...weighIns)) / 86_400_000).toBeGreaterThan(80)
    expect(isWeighInDue(db.body_weight_logs.at(-1).logged_at, at)).toBe(true)

    const blockOf = (sessionId) => db.workout_sessions.find((s) => s.id === sessionId).block
    const sessionsFor = (name) => new Set(db.exercise_logs.filter((l) => l.exercise_name === name).map((l) => l.session_id))
    const topWeight = (name, sessionId) =>
      Math.max(...db.exercise_logs.filter((l) => l.exercise_name === name && l.session_id === sessionId).map((l) => l.weight))

    expect([...sessionsFor('KB Sumo Deadlift')].every((id) => blockOf(id) === 0)).toBe(true)
    expect(sessionsFor('Goblet Squat').size).toBe(1)
    expect(topWeight('DB Bench Press', 'fx-recent')).toBeGreaterThan(topWeight('DB Bench Press', 'fx-22d'))
    expect(topWeight('Seated DB Shoulder Press', 'fx-recent')).toBeLessThan(topWeight('Seated DB Shoulder Press', 'fx-12d'))
  })

  it('is deterministic for a given now', () => {
    expect(buildFixtureDb({ now })).toEqual(db)
  })
})

describe('fixture seed (scenarios)', () => {
  it('empty: no data at all', () => {
    expect(buildFixtureDb({ now, scenario: 'empty' })).toEqual({ workout_sessions: [], exercise_logs: [], body_weight_logs: [] })
  })

  it('blockDone: all 24 Block 01 sessions completed, nothing in progress', () => {
    const done = buildFixtureDb({ now, scenario: 'blockDone' })
    expect(done.workout_sessions.filter((s) => s.block === 1 && s.status === 'completed')).toHaveLength(24)
    expect(done.workout_sessions.some((s) => s.status === 'in_progress')).toBe(false)
  })
})
