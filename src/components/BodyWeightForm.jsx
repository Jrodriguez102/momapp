import { useState } from 'react'
import { logBodyWeight } from '../data/helpers'

// Single-field body-weight logger, shared by the Progress tab panel and the
// Home tab's weekly weigh-in card. onSaved: called after a successful insert.
export default function BodyWeightForm({ onSaved, autoFocus = true }) {
  const [weightInput, setWeightInput] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const weight = Number(weightInput)
    if (!weight) return
    setSaving(true)
    try {
      await logBodyWeight(weight)
      setWeightInput('')
      onSaved()
    } catch (err) {
      console.error('Failed to log weight:', err)
      alert('Could not save — check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        placeholder="Weight (lb)"
        value={weightInput}
        onChange={(e) => setWeightInput(e.target.value)}
        autoFocus={autoFocus}
        className="flex-1 min-w-0 bg-base-900 rounded-xl px-3 py-2.5 text-sm text-base-100 outline-none focus:ring-1 focus:ring-accent-start"
      />
      <button
        type="submit"
        disabled={saving}
        className="accent-gradient text-white font-semibold text-sm rounded-xl px-4 py-2.5 disabled:opacity-60"
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </form>
  )
}
