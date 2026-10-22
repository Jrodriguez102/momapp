// @vitest-environment jsdom
// The workout screen end to end against an in-memory Supabase.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { fake } from '@/test/fakeSupabase'
import { createMemoryDb } from '@/test/memorySupabase'
import WorkoutPage from './WorkoutPage'

vi.mock('@/lib/supabase', async () => ({ supabase: (await import('@/test/fakeSupabase')).fake.client }))

let db

function renderWorkout(dayId = 'day-1') {
  return render(
    <MemoryRouter initialEntries={[`/session/${dayId}`]}>
      <Routes>
        <Route path="/session/:dayId" element={<WorkoutPage />} />
        <Route path="/" element={<p>home page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function ready() {
  await screen.findByRole('button', { name: 'Log set 1' })
}

const benchRows = () => db.tables.exercise_logs.filter((l) => l.exercise_id === 'db-bench-press').sort((a, b) => a.set_number - b.set_number)

async function logSet(setNumber, reps) {
  fireEvent.change(screen.getByLabelText(`Set ${setNumber} reps`), { target: { value: String(reps) } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: `Log set ${setNumber}` }))
  })
  await waitFor(() => expect(screen.getByRole('button', { name: new RegExp(`^Set ${setNumber}: .*Edit$`) })).toBeTruthy())
}

beforeEach(() => {
  localStorage.clear()
  fake.reset()
  db = createMemoryDb()
  fake.respond(db.respond)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('WorkoutPage', () => {
  it('shows the top bar, opens the first exercise and collapses the rest', async () => {
    renderWorkout()
    await ready()
    expect(screen.getByRole('heading', { level: 1, name: 'Upper A' })).toBeTruthy()
    expect(screen.getByText('Session 1 · Week 1')).toBeTruthy()
    expect(screen.getByRole('timer', { name: 'Workout time' }).textContent).toBe('0:00')
    expect(screen.getByText('0 of 19 sets')).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Workout progress' }).getAttribute('aria-valuenow')).toBe('0')
    expect(screen.getByRole('heading', { level: 2, name: 'DB Bench Press' })).toBeTruthy()
    expect(screen.getByText('Start at 35 lb and aim for 8 reps.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Lat Pulldown\s*0 of 3 sets/, expanded: false })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Log a set to finish' }).disabled).toBe(true)
  })

  it('logs a set, then moves focus to the next set’s reps', async () => {
    renderWorkout()
    await ready()
    expect(screen.getByLabelText('Set 1 weight (lb)').value).toBe('35')
    await logSet(1, 10)
    expect(benchRows()).toEqual([expect.objectContaining({ set_number: 1, weight: 35, reps: 10, exercise_name: 'DB Bench Press' })])
    expect(db.tables.workout_sessions).toHaveLength(1)
    await waitFor(() => expect(document.activeElement?.id).toBe('set-db-bench-press-2-reps'))
    expect(screen.getByText('1 of 19 sets')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Finish workout · 1 set' })).toBeTruthy()
  })

  it('shows the last-set chips with two lines and aria-pressed', async () => {
    renderWorkout()
    await ready()
    await logSet(1, 10)
    const group = screen.getByRole('group', { name: 'How did the last set feel?' })
    const chips = within(group).getAllByRole('button')
    expect(chips.map((c) => c.textContent)).toEqual(['Easy3+ left', 'Just right1–2 left', 'Hard0 left'])
    await act(async () => {
      fireEvent.click(chips[1])
    })
    expect(chips[1].getAttribute('aria-pressed')).toBe('true')
    await waitFor(() => expect(benchRows()[0].rpe).toBe(8.5))
  })

  it('auto-advances to the next exercise after the last set and its feel', async () => {
    renderWorkout()
    await ready()
    for (const n of [1, 2, 3, 4]) await logSet(n, 10)
    expect(screen.getByRole('heading', { level: 2, name: 'DB Bench Press' })).toBeTruthy() // waits for the feel tap
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Just right/ }))
    })
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Lat Pulldown' })).toBeTruthy())
    expect(screen.getByRole('button', { name: /DB Bench Press\s*4 of 4 sets\s*Done/ })).toBeTruthy()
  })

  it('asks before removing a set', async () => {
    renderWorkout()
    await ready()
    await logSet(1, 10)
    await logSet(2, 9)
    fireEvent.click(screen.getByRole('button', { name: /^Set 2: .*Edit$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove set' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Remove set 2?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep it' }))
    expect(benchRows()).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Remove set' }))
    await act(async () => {
      fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove set' }))
    })
    await waitFor(() => expect(benchRows()).toHaveLength(1))
  })

  it('warns before a swap clears typed numbers', async () => {
    renderWorkout()
    await ready()
    fireEvent.change(screen.getByLabelText('Set 1 reps'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Swap' }))
    const sheet = await screen.findByRole('dialog', { name: 'Swap exercise' })
    fireEvent.click(within(sheet).getByRole('button', { name: /Chest Press Machine/ }))
    const warning = await screen.findByRole('alertdialog', { name: 'Clear the numbers you typed?' })
    fireEvent.click(within(warning).getByRole('button', { name: 'Keep DB Bench Press' }))
    expect(screen.getByRole('heading', { level: 2, name: 'DB Bench Press' })).toBeTruthy()
    expect(screen.getByLabelText('Set 1 reps').value).toBe('9')

    fireEvent.click(screen.getByRole('button', { name: 'Swap' }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Swap exercise' })).getByRole('button', { name: /Chest Press Machine/ }))
    await act(async () => {
      fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Switch exercise' }))
    })
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Chest Press Machine' })).toBeTruthy())
    expect(screen.getByText('Instead of DB Bench Press')).toBeTruthy()
    expect(screen.getByLabelText('Set 1 reps').value).toBe('')
  })

  it('swaps straight away when nothing is typed', async () => {
    renderWorkout()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Swap' }))
    await act(async () => {
      fireEvent.click(within(await screen.findByRole('dialog', { name: 'Swap exercise' })).getByRole('button', { name: /Smith Machine Bench Press/ }))
    })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Smith Machine Bench Press' })).toBeTruthy())
  })

  it('confirms a below-minimum finish in a dialog and saves it as partial', async () => {
    renderWorkout()
    await ready()
    await logSet(1, 10)
    fireEvent.click(screen.getByRole('button', { name: 'Finish workout · 1 set' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Only 1 set logged' })
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save as partial' }))
    })
    await waitFor(() => expect(db.tables.workout_sessions[0].status).toBe('partial'))
    expect(await screen.findByText('Saved as Partial')).toBeTruthy()
  })

  it('"Keep going" closes the finish dialog without writing', async () => {
    renderWorkout()
    await ready()
    await logSet(1, 10)
    fireEvent.click(screen.getByRole('button', { name: 'Finish workout · 1 set' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Keep going' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(db.tables.workout_sessions[0].status).toBe('in_progress')
  })

  it('shows an error with Try again when offline, not a fresh block', async () => {
    fake.respond(() => ({ data: null, error: new Error('offline') }))
    renderWorkout()
    expect(await screen.findByText("Couldn't load this workout")).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Log set 1' })).toBeNull()
    fake.respond(db.respond)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await ready()
  })

  it('points to the workout already in progress', async () => {
    db.tables.workout_sessions.push({ id: 'open', day_id: 'day-3', block: 1, week_in_block: 1, status: 'in_progress', started_at: new Date().toISOString() })
    renderWorkout()
    expect(await screen.findByText('Another workout is in progress')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continue Upper B' })).toBeTruthy()
  })

  it('goes back home from the top bar', async () => {
    renderWorkout()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Home' }))
    expect(screen.getByText('home page')).toBeTruthy()
  })
})
