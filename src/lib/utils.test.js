import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('joins conditional classes', () => {
    const isActive = false
    expect(cn('a', isActive && 'b', { c: true, d: false }, undefined)).toBe('a c')
  })

  it('keeps a custom font size and a text color side by side', () => {
    expect(cn('text-caption text-foreground')).toBe('text-caption text-foreground')
  })

  it('lets later custom tokens override earlier ones in the same group', () => {
    expect(cn('text-body', 'text-caption')).toBe('text-caption')
    expect(cn('rounded-card', 'rounded-row')).toBe('rounded-row')
    expect(cn('shadow-hero', 'shadow-none')).toBe('shadow-none')
    expect(cn('px-gutter', 'px-4')).toBe('px-4')
    expect(cn('size-tap', 'size-input')).toBe('size-input')
    expect(cn('bg-surface', 'bg-accent')).toBe('bg-accent')
  })
})
