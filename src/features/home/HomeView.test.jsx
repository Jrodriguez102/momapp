// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { HomeView } from './HomeView'
import { blockCompleteWeek, deloadWeek, inProgressWeek, midBlockWeek } from './__fixtures__/homeFixtures'

afterEach(cleanup)

function renderHome(props) {
  const onStart = vi.fn()
  render(<HomeView {...props} onStart={onStart} />)
  return { onStart }
}

function weekRows() {
  const card = screen.getByRole('region', { name: 'This week' })
  return within(card)
    .getAllByRole('listitem')
    .map((li) => li.textContent)
}

describe('HomeView — mid-block week', () => {
  it('shows the date, greeting, block chip and quote', () => {
    renderHome(midBlockWeek)
    expect(screen.getByText('Tuesday, October 20')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Good morning, Arlene' })).toBeTruthy()
    expect(screen.getByText('Block 01 · Week 3 of 6')).toBeTruthy()
    expect(screen.getByText('Progress, not perfection.')).toBeTruthy()
  })

  it("puts the next queue day in the hero with real exercise names", () => {
    const { onStart } = renderHome(midBlockWeek)
    const hero = screen.getByRole('region', { name: "Today's workout" })
    expect(within(hero).getByRole('heading', { name: 'Lower A' })).toBeTruthy()
    expect(within(hero).getByText('Quad / Glute')).toBeTruthy()
    expect(hero.textContent).toContain('Session 10 of 24 · 5 exercises · about 50 min')
    const chips = within(within(hero).getByRole('list', { name: 'Exercises' })).getAllByRole('listitem').map((li) => li.textContent)
    expect(chips).toEqual(['Hack Squat Machine', 'Step-Up', 'Seated Leg Curl', '+2 more'])
    fireEvent.click(within(hero).getByRole('button', { name: 'Start workout' }))
    expect(onStart).toHaveBeenCalledWith('day-2')
  })

  it('shows this month, streak and block progress', () => {
    renderHome(midBlockWeek)
    expect(screen.getByText('This month').parentElement.textContent).toBe('7workoutsThis month')
    expect(screen.getByText('Streak').parentElement.textContent).toBe('2weeksStreak')
    expect(screen.getByText('Block').parentElement.textContent).toBe('9/24Block')
  })

  it('lists the week: one completed, today, two upcoming', () => {
    renderHome(midBlockWeek)
    expect(screen.getByText('1 of 4 done')).toBeTruthy()
    expect(weekRows()).toEqual([
      'Mon19Upper ADB Bench Press · Lat Pulldown · +4Completed',
      'Tue20Lower AHack Squat Machine · Step-Up · +3Today',
      'Thu22Upper BIncline Machine Press · DB Single-Arm Row · +4Upcoming',
      'Fri23Lower BSmith Machine Hip Thrust · Romanian Deadlift · +3Upcoming',
    ])
  })

  it('chooses a different day from a sheet', () => {
    const { onStart } = renderHome(midBlockWeek)
    fireEvent.click(screen.getByRole('button', { name: 'Choose a different day' }))
    const sheet = screen.getByRole('dialog', { name: 'Choose a workout' })
    const options = within(sheet).getAllByRole('button').filter((b) => b.textContent.includes('exercises'))
    expect(options).toHaveLength(4)
    expect(options[1].textContent).toContain('Next up')
    fireEvent.click(within(sheet).getByRole('button', { name: /Upper B/ }))
    expect(onStart).toHaveBeenCalledWith('day-3')
  })
})

describe('HomeView — other states', () => {
  it('continues an in-progress workout and hides "choose a different day"', () => {
    const { onStart } = renderHome(inProgressWeek)
    const hero = screen.getByRole('region', { name: 'Workout in progress' })
    expect(within(hero).getByRole('heading', { name: 'Lower A' })).toBeTruthy()
    fireEvent.click(within(hero).getByRole('button', { name: 'Continue workout' }))
    expect(onStart).toHaveBeenCalledWith('day-2')
    expect(screen.queryByRole('button', { name: 'Choose a different day' })).toBeNull()
    expect(weekRows()[1]).toContain('In progress')
  })

  it('labels the deload week', () => {
    renderHome(deloadWeek)
    expect(screen.getByText('Block 01 · Week 6 of 6 · Deload')).toBeTruthy()
  })

  it('shows the finished block with nothing to start', () => {
    renderHome(blockCompleteWeek)
    expect(screen.getByText('Block 01 · Complete')).toBeTruthy()
    const hero = screen.getByRole('region', { name: 'Block complete' })
    expect(hero.textContent).toContain('All 24 sessions are done')
    expect(screen.queryByRole('button', { name: /Start workout|Choose a different day/ })).toBeNull()
    expect(weekRows()).toEqual(['Mon19Upper ADB Bench Press · Lat Pulldown · +4Completed'])
    expect(screen.getByText('24/24')).toBeTruthy()
  })
})
