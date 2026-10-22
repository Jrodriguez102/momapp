// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { House } from 'lucide-react'
import { AppShell } from './AppShell'
import { BottomNav } from '@/ui/bottom-nav'

beforeEach(() => {
  window.scrollTo = vi.fn()
})
afterEach(cleanup)

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell>
        <Routes>
          <Route path="/" element={<p>home page</p>} />
          <Route path="/history" element={<p>history page</p>} />
          <Route path="/progress" element={<p>progress page</p>} />
          <Route path="/session/:dayId" element={<p>session page</p>} />
        </Routes>
      </AppShell>
    </MemoryRouter>,
  )
}

describe('AppShell + BottomNav', () => {
  it('shows all three items with their labels, and marks the active one', () => {
    renderAt('/history')
    const nav = screen.getByRole('navigation', { name: 'Main' })
    const links = nav.querySelectorAll('a')
    expect([...links].map((a) => a.textContent)).toEqual(['Home', 'History', 'Progress'])
    expect(screen.getByRole('link', { name: 'History' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBeNull()
  })

  it('only marks Home active on the root route', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Progress' }).getAttribute('aria-current')).toBeNull()
  })

  it('navigates between tabs', () => {
    renderAt('/')
    fireEvent.click(screen.getByRole('link', { name: 'Progress' }))
    expect(screen.getByText('progress page')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Progress' }).getAttribute('aria-current')).toBe('page')
  })

  it('hides the nav and its padding on the workout session', () => {
    renderAt('/session/day-1')
    expect(screen.getByText('session page')).toBeTruthy()
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.getByRole('main').className).not.toContain('pb-nav-clearance')
  })

  it('pads tab pages so content clears the nav', () => {
    renderAt('/progress')
    expect(screen.getByRole('main').className).toContain('pb-nav-clearance')
  })

  it('scrolls to the top on route change', () => {
    renderAt('/')
    window.scrollTo.mockClear()
    fireEvent.click(screen.getByRole('link', { name: 'History' }))
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  })
})

describe('BottomNav dot', () => {
  it('adds the dot label to the link name only when the dot is shown', () => {
    const { rerender } = render(
      <MemoryRouter>
        <BottomNav items={[{ to: '/progress', label: 'Progress', icon: House, dot: true, dotLabel: 'weigh-in due' }]} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Progress, weigh-in due' })).toBeTruthy()
    rerender(
      <MemoryRouter>
        <BottomNav items={[{ to: '/progress', label: 'Progress', icon: House, dot: false, dotLabel: 'weigh-in due' }]} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Progress' })).toBeTruthy()
  })
})
