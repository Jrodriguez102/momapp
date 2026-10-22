// @vitest-environment jsdom
// History end to end on the dev fixture data (src/dev/fixture/seed.js) in an
// in-memory Supabase: what's listed, and exactly what edits write.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { fake, hasOp, opArgs } from '@/test/fakeSupabase'
import { createMemoryDb } from '@/test/memorySupabase'
import { buildFixtureDb } from '@/dev/fixture/seed'
import { editHoursLeft, filterSessions } from './historyFormat'
import HistoryPage from './HistoryPage'

vi.mock('@/lib/supabase', async () => ({ supabase: (await import('@/test/fakeSupabase')).fake.client }))

let db
const session = (id) => db.tables.workout_sessions.find((s) => s.id === id)
const rows = (sessionId, exerciseId) =>
  db.tables.exercise_logs.filter((l) => l.session_id === sessionId && l.exercise_id === exerciseId).sort((a, b) => a.set_number - b.set_number)

function seed(tables) {
  fake.reset()
  db = createMemoryDb(tables)
  fake.respond(db.respond)
}

async function renderHistory() {
  render(<HistoryPage />)
  await screen.findAllByRole('article')
}

// The card for a session id (cards are labelled "<title>, <date>").
function card(id) {
  const s = session(id)
  const date = new Date(s.completed_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  return screen.getAllByRole('article').find((a) => a.getAttribute('aria-label').endsWith(date) && a.textContent.includes(s.status === 'partial' ? 'Partial' : 'Completed'))
}

async function expand(id) {
  const el = card(id)
  fireEvent.click(within(el).getAllByRole('button')[0])
  return el
}

beforeEach(() => {
  localStorage.clear()
  seed(buildFixtureDb({ now: Date.now() }))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('History list', () => {
  it('lists every finished session newest first with its badge, including pilot', async () => {
    await renderHistory()
    const cards = screen.getAllByRole('article')
    expect(cards).toHaveLength(11)
    expect(cards[0].textContent).toMatch(/^Upper A.*Completed$/)
    expect(cards.at(-1).textContent).toMatch(/^Pilot workout/)
    expect(card('fx-partial').textContent).toContain('Partial')
    expect(card('fx-auto').textContent).toContain('auto-closed')
    expect(screen.queryByText(/in progress/i)).toBeNull()
  })

  it('shows date, minutes, sets and volume on each card', async () => {
    await renderHistory()
    const s = session('fx-recent')
    const logs = db.tables.exercise_logs.filter((l) => l.session_id === 'fx-recent')
    const volume = logs.reduce((sum, l) => sum + l.weight * l.reps, 0)
    expect(card('fx-recent').textContent).toContain(`${Math.round(s.duration_seconds / 60)} min · ${logs.length} sets · ${volume.toLocaleString()} lb`)
  })

  it('filters by this week and this month', async () => {
    await renderHistory()
    const finished = db.tables.workout_sessions.filter((s) => s.status !== 'in_progress')
    fireEvent.click(screen.getByRole('button', { name: 'This week' }))
    expect(screen.queryAllByRole('article')).toHaveLength(filterSessions(finished, 'week').length)
    fireEvent.click(screen.getByRole('button', { name: 'This month' }))
    expect(screen.queryAllByRole('article')).toHaveLength(filterSessions(finished, 'month').length)
    expect(screen.getByRole('button', { name: 'This month' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('shows an empty state with no data', async () => {
    seed(buildFixtureDb({ scenario: 'empty' }))
    render(<HistoryPage />)
    expect(await screen.findByText('No workouts yet')).toBeTruthy()
  })
})

describe('History expanded (read-only view)', () => {
  it('shows set chips, "+N more exercises · Effort N of 10" and the edit strip inside 48h', async () => {
    await renderHistory()
    const el = await expand('fx-recent')
    expect(within(el).getByRole('list', { name: 'DB Bench Press sets' }).textContent).toBe('40 × 940 × 940 × 840 × 8')
    expect(within(el).getByText(/Effort 7 of 10 · Hard$/)).toBeTruthy()
    fireEvent.click(within(el).getByRole('button', { name: '+3 more exercises' }))
    expect(within(el).getByRole('heading', { name: 'DB Bicep Curl' })).toBeTruthy()
    const hours = editHoursLeft(session('fx-recent'))
    expect(within(el).getByText(`Editable for ${hours} more hours`)).toBeTruthy()
    expect(within(el).getByRole('button', { name: 'Edit sets' })).toBeTruthy()
  })

  it('is read-only after 48h', async () => {
    await renderHistory()
    const el = await expand('fx-old')
    expect(within(el).queryByRole('button', { name: 'Edit sets' })).toBeNull()
    expect(within(el).queryByText(/Editable for/)).toBeNull()
    expect(within(el).getByText(/Effort 8 of 10 · Hard$/)).toBeTruthy()
  })

  it('flags a swapped exercise', async () => {
    await renderHistory()
    const el = await expand('fx-swap')
    expect(within(el).getByRole('heading', { name: 'Goblet Squat' })).toBeTruthy()
    expect(within(el).getByText('Swapped from Hack Squat Machine')).toBeTruthy()
  })

  it('labels the pilot session’s legacy effort', async () => {
    await renderHistory()
    const el = await expand('fx-pilot')
    expect(within(el).getByText('Effort: Hard')).toBeTruthy()
  })
})

describe('History editing (writes unchanged)', () => {
  async function editRecent() {
    await renderHistory()
    const el = await expand('fx-recent')
    fireEvent.click(within(el).getByRole('button', { name: 'Edit sets' }))
    const bench = within(el).getByRole('heading', { name: 'DB Bench Press' }).closest('section')
    return { el, bench }
  }

  it('edits a set with saveSet: same upsert payload, logged_at and status untouched', async () => {
    const { bench } = await editRecent()
    const before = rows('fx-recent', 'db-bench-press')[1]
    const sessionBefore = { ...session('fx-recent') }
    fireEvent.click(within(bench).getByRole('button', { name: 'Set 2: 40 lb × 9. Edit' }))
    fireEvent.change(within(bench).getByLabelText('Set 2 reps'), { target: { value: '10' } })
    fake.queries.length = 0
    await act(async () => {
      fireEvent.click(within(bench).getByRole('button', { name: 'Save set 2' }))
    })
    await waitFor(() => expect(rows('fx-recent', 'db-bench-press')[1].reps).toBe(10))
    const upsert = fake.queries.find((q) => hasOp(q, 'upsert'))
    expect(opArgs(upsert, 'upsert')).toEqual([
      { session_id: 'fx-recent', exercise_id: 'db-bench-press', exercise_name: 'DB Bench Press', set_number: 2, weight: 40, weight_unit: 'lb', reps: 10 },
      { onConflict: 'session_id,exercise_name,set_number' },
    ])
    expect(rows('fx-recent', 'db-bench-press')[1].logged_at).toBe(before.logged_at)
    expect(session('fx-recent')).toEqual(sessionBefore)
    expect(fake.queries.filter((q) => hasOp(q, 'update') || hasOp(q, 'delete'))).toEqual([])
  })

  it('sets the last-set feel with syncExerciseRpe (top set only)', async () => {
    const { bench } = await editRecent()
    await act(async () => {
      fireEvent.click(within(bench).getByRole('button', { name: /Hard/ }))
    })
    await waitFor(() => expect(rows('fx-recent', 'db-bench-press').map((r) => r.rpe)).toEqual([null, null, null, 10]))
  })

  it('sets effort with updateSessionRpe only', async () => {
    const { el } = await editRecent()
    const sessionBefore = { ...session('fx-recent') }
    fake.queries.length = 0
    await act(async () => {
      fireEvent.click(within(within(el).getByRole('group', { name: 'How hard was it overall?' })).getByRole('button', { name: '9' }))
    })
    await waitFor(() => expect(session('fx-recent').session_rpe).toBe(9))
    expect(session('fx-recent')).toEqual({ ...sessionBefore, session_rpe: 9 })
    expect(fake.queries.filter((q) => hasOp(q, 'update')).map((q) => opArgs(q, 'update')[0])).toEqual([{ session_rpe: 9 }])
  })

  it('removes a set with removeHistorySet after confirming; the tap moves down', async () => {
    const { bench } = await editRecent()
    expect(rows('fx-recent', 'db-bench-press').map((r) => r.rpe)).toEqual([null, null, null, 8.5])
    fireEvent.click(within(bench).getByRole('button', { name: 'Set 4: 40 lb × 8. Edit' }))
    fireEvent.click(within(bench).getByRole('button', { name: 'Remove set' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Remove set 4?' })
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Remove set' }))
    })
    await waitFor(() => expect(rows('fx-recent', 'db-bench-press').map((r) => [r.set_number, r.rpe])).toEqual([[1, null], [2, null], [3, 8.5]]))
    expect(session('fx-recent').status).toBe('completed')
  })

  it('marks the session partial when its last set is removed', async () => {
    const done = new Date(Date.now() - 60 * 60_000).toISOString()
    seed({
      workout_sessions: [{ id: 'one', day_id: 'day-1', block: 1, week_in_block: 3, status: 'completed', completed_at: done, duration_seconds: 0, session_rpe: null, closed_by: 'user' }],
      exercise_logs: [{ id: 'only', session_id: 'one', exercise_id: 'db-bench-press', exercise_name: 'DB Bench Press', set_number: 1, weight: 40, weight_unit: 'lb', reps: 8, rpe: null, logged_at: done }],
    })
    await renderHistory()
    const el = await expand('one')
    fireEvent.click(within(el).getByRole('button', { name: 'Edit sets' }))
    fireEvent.click(within(el).getByRole('button', { name: 'Set 1: 40 lb × 8. Edit' }))
    fireEvent.click(within(el).getByRole('button', { name: 'Remove set' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toContain('the workout will be marked partial')
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Remove set' }))
    })
    await waitFor(() => expect(session('one').status).toBe('partial'))
    expect(screen.getByRole('article').textContent).toContain('Partial')
    expect(screen.getByText('No sets logged for this session.')).toBeTruthy()
  })
})
