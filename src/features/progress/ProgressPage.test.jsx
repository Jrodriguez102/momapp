// @vitest-environment jsdom
// Progress end to end on the dev fixture data in an in-memory Supabase,
// inside the real AppShell (to check the weigh-in nav dot).
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { fake, hasOp, opArgs } from '@/test/fakeSupabase'
import { createMemoryDb } from '@/test/memorySupabase'
import { buildFixtureDb } from '@/dev/fixture/seed'
import { AppShell } from '@/app/AppShell'
import ProgressPage from './ProgressPage'

vi.mock('@/lib/supabase', async () => ({ supabase: (await import('@/test/fakeSupabase')).fake.client }))

let db

beforeAll(() => {
  // jsdom gaps used by Recharts (ResizeObserver) and Radix Select.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
})

function seed(scenario) {
  fake.reset()
  db = createMemoryDb(buildFixtureDb({ scenario }))
  fake.respond(db.respond)
}

async function renderProgress() {
  window.scrollTo = vi.fn()
  render(
    <MemoryRouter initialEntries={['/progress']}>
      <AppShell>
        <Routes>
          <Route path="/progress" element={<ProgressPage />} />
        </Routes>
      </AppShell>
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { name: 'Body weight' })
}

const bodyCard = () => screen.getByRole('region', { name: 'Body weight' })
const liftsCard = () => screen.getByRole('region', { name: 'Lifts' })

async function pickExercise(name) {
  const trigger = within(liftsCard()).getByRole('combobox', { name: 'Exercise' })
  fireEvent.keyDown(trigger, { key: 'Enter' })
  const option = await screen.findByRole('option', { name })
  fireEvent.keyDown(option, { key: 'Enter' })
  await waitFor(() => expect(trigger.textContent).toBe(name))
}

beforeEach(() => {
  localStorage.clear()
  seed('default')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Body weight', () => {
  it('shows the latest weight and a neutral delta over the selected timeframe', async () => {
    await renderProgress()
    const card = bodyCard()
    expect(card.textContent).toContain('153.2lb')
    expect(within(card).getByText('−3 lb')).toBeTruthy() // 3M default: 156.2 -> 153.2
    expect(within(card).getByText(/^Down 3 lb over the last 3 months · 13 weigh.ins$/)).toBeTruthy()

    fireEvent.click(within(card).getByRole('button', { name: '1M' }))
    expect(within(card).getByText('+0.8 lb')).toBeTruthy() // last month: 152.4 -> 153.2
    expect(within(card).getByText(/^Up 0.8 lb over the last month · 4 weigh.ins$/)).toBeTruthy()
    // Same neutral style for gain and loss.
    expect(within(card).getByText('+0.8 lb').className).toContain('bg-accent')
    expect(within(card).getByText(/time for a weigh-in/)).toBeTruthy()
  })

  it('logs a weight (same insert as before) and clears the nav dot', async () => {
    await renderProgress()
    await waitFor(() => expect(screen.getByRole('link', { name: 'Progress, weigh-in due' })).toBeTruthy())

    fireEvent.click(within(bodyCard()).getByRole('button', { name: 'Log weight' }))
    const sheet = await screen.findByRole('dialog', { name: 'Log weight' })
    fireEvent.change(within(sheet).getByLabelText('Body weight (lb)'), { target: { value: '152.8' } })
    fake.queries.length = 0
    await act(async () => {
      fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))
    })

    const insert = fake.queries.find((q) => hasOp(q, 'insert'))
    expect(insert.table).toBe('body_weight_logs')
    expect(Object.keys(opArgs(insert, 'insert')[0])).toEqual(['weight', 'logged_at'])
    expect(opArgs(insert, 'insert')[0].weight).toBe(152.8)
    await waitFor(() => expect(bodyCard().textContent).toContain('152.8lb'))
    await waitFor(() => expect(screen.getByRole('link', { name: 'Progress' })).toBeTruthy())
    expect(screen.queryByText(/time for a weigh-in/)).toBeNull()
  })

  it('shows empty states with no data', async () => {
    seed('empty')
    await renderProgress()
    expect(within(bodyCard()).getByText('No weigh-ins yet')).toBeTruthy()
    expect(screen.getByText('No lifts logged yet')).toBeTruthy()
  })
})

describe('Lifts', () => {
  it('opens on the most recently logged lift and hides pilot-only names', async () => {
    await renderProgress()
    const trigger = within(liftsCard()).getByRole('combobox', { name: 'Exercise' })
    expect(trigger.textContent).toBe('Step-Up') // logged 3 minutes ago in today's workout
    fireEvent.keyDown(trigger, { key: 'Enter' })
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent)
    expect(options).toContain('DB Bench Press')
    expect(options).toContain('Goblet Squat')
    expect(options).not.toContain('KB Sumo Deadlift')
  })

  it('shows best top set, est. 1RM, the chart summary and session chips', async () => {
    await renderProgress()
    await pickExercise('DB Bench Press')
    const card = liftsCard()
    expect(within(card).getByText('Best top set').parentElement.textContent).toBe('40 × 9lbBest top set')
    expect(within(card).getAllByText('Est. 1-rep max')[0].parentElement.textContent).toBe('52lbEst. 1-rep max') // the stat tile
    expect(within(card).getByText('Up 5 lb across 3 sessions')).toBeTruthy()

    const chips = within(within(card).getByRole('group', { name: 'Sessions' })).getAllByRole('button')
    expect(chips).toHaveLength(3)
    expect(chips.at(-1).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(chips[0])
    expect(chips[0].getAttribute('aria-pressed')).toBe('true')
    expect(within(card).getByText('Selected')).toBeTruthy()
    expect(within(card).getAllByText(/^35 lb × \d+$/).length).toBe(4)
  })

  it('handles a lift that went down and one with a single session', async () => {
    await renderProgress()
    await pickExercise('Seated DB Shoulder Press')
    expect(within(liftsCard()).getByText('Down 2.5 lb across 3 sessions')).toBeTruthy()
    await pickExercise('Goblet Squat')
    expect(within(liftsCard()).getByText('1 session so far — log it again to see a trend.')).toBeTruthy()
    expect(within(within(liftsCard()).getByRole('group', { name: 'Sessions' })).getAllByRole('button')).toHaveLength(1)
  })
})
