// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Button } from './button'
import { IconButton } from './icon-button'
import { ChoiceChips } from './choice-chips'
import { SegmentedControl } from './segmented-control'
import { NumberInput } from './number-input'
import { LoadingState } from './skeleton'

afterEach(cleanup)

const DIFFICULTY = [
  { value: '3+', label: 'Easy', detail: '3+ left' },
  { value: '1-2', label: 'Just right', detail: '1–2 left' },
  { value: '0', label: 'Hard', detail: '0 left' },
]

describe('Button', () => {
  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('button')
  })

  it('keeps an explicit submit type', () => {
    render(<Button type="submit">Save</Button>)
    expect(screen.getByRole('button').getAttribute('type')).toBe('submit')
  })
})

describe('IconButton', () => {
  it('uses its label as the accessible name', () => {
    render(<IconButton label="Back"><svg /></IconButton>)
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy()
  })
})

describe('ChoiceChips', () => {
  it('marks only the selected chip with aria-pressed and shows both lines', () => {
    render(<ChoiceChips label="Last set" options={DIFFICULTY} value="1-2" onChange={() => {}} />)
    const pressed = screen.getAllByRole('button').map((b) => b.getAttribute('aria-pressed'))
    expect(pressed).toEqual(['false', 'true', 'false'])
    expect(screen.getByRole('button', { name: /Just right\s*1–2 left/ })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Last set' })).toBeTruthy()
  })

  it('selects a value, and tapping the selected chip clears it', () => {
    const onChange = vi.fn()
    const { rerender } = render(<ChoiceChips label="Last set" options={DIFFICULTY} value={null} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Hard/ }))
    expect(onChange).toHaveBeenLastCalledWith('0')
    rerender(<ChoiceChips label="Last set" options={DIFFICULTY} value="0" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Hard/ }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('can require a value', () => {
    const onChange = vi.fn()
    render(<ChoiceChips label="x" options={DIFFICULTY} value="0" onChange={onChange} allowDeselect={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Hard/ }))
    expect(onChange).toHaveBeenLastCalledWith('0')
  })
})

describe('SegmentedControl', () => {
  it('is a labelled group of aria-pressed buttons', () => {
    const onChange = vi.fn()
    render(
      <SegmentedControl
        label="Filter workouts"
        options={[{ value: 'all', label: 'All' }, { value: 'week', label: 'This week' }]}
        value="all"
        onChange={onChange}
      />,
    )
    expect(screen.getByRole('group', { name: 'Filter workouts' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'This week' }))
    expect(onChange).toHaveBeenCalledWith('week')
  })
})

describe('NumberInput', () => {
  it('is labelled, uses the right keypad, and uses the 20px input size', () => {
    render(
      <>
        <NumberInput label="Set 1 weight" />
        <NumberInput label="Set 1 reps" decimal={false} />
      </>,
    )
    const weight = screen.getByLabelText('Set 1 weight')
    expect(weight.getAttribute('inputmode')).toBe('decimal')
    expect(screen.getByLabelText('Set 1 reps').getAttribute('inputmode')).toBe('numeric')
    expect(weight.className).toContain('text-input')
  })
})

describe('LoadingState', () => {
  it('announces loading politely', () => {
    render(<LoadingState label="Loading your week…" />)
    expect(screen.getByRole('status').textContent).toBe('Loading your week…')
  })
})
