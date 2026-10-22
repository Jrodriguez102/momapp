import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Tailwind resolves `text-<name>` against both --color-* and --text-*; when
// a name exists in both, it silently picks the color (this made 20px set
// inputs render in the pale input-border color once). Keep them disjoint.
const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')
const names = (prefix) => new Set([...css.matchAll(new RegExp(`--${prefix}-([a-z0-9-]+?)(?:--[a-z-]+)?:`, 'g'))].map((m) => m[1]))

describe('design tokens', () => {
  it('never reuse a color name as a font-size name', () => {
    const colors = names('color')
    const overlap = [...names('text')].filter((n) => colors.has(n))
    expect(overlap).toEqual([])
  })
})
