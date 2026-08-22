import { useState } from 'react'
import { Plus } from 'lucide-react'
import TrendLineChart from './TrendLineChart'
import { filterByTimeframe, logBodyWeight } from '../data/helpers'

const TIMEFRAMES = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: 'all', label: 'All' },
]

function formatDateLabel(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// logs: body_weight_logs rows, oldest-first. onLogged: called after a
// successful insert so the parent can refetch.
export default function BodyWeightPanel({ logs, onLogged }) {
  const [timeframe, setTimeframe] = useState('3m')
  const [showForm, setShowForm] = useState(false)
  const [weightInput, setWeightInput] = useState('')
  const [saving, setSaving] = useState(false)

  const current = logs.length ? logs[logs.length - 1] : null
  const first = logs.length ? logs[0] : null
  const change = current && first && current !== first ? current.weight - first.weight : null

  const chartData = filterByTimeframe(logs, timeframe).map((log) => ({
    date: formatDateLabel(log.logged_at),
    weight: log.weight,
  }))

  async function handleSubmit(e) {
    e.preventDefault()
    const weight = Number(weightInput)
    if (!weight) return
    setSaving(true)
    try {
      await logBodyWeight(weight)
      setWeightInput('')
      setShowForm(false)
      onLogged()
    } catch (err) {
      console.error('Failed to log weight:', err)
      alert('Could not save — check Supabase is configured (src/lib/supabase.js).')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card rounded-[28px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-base-400">Current weight</p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="font-display font-black text-3xl text-base-100">{current ? current.weight : '—'}</span>
            {current && <span className="text-sm text-base-400">lb</span>}
          </div>
          {change !== null && (
            <p className="text-xs text-base-400 mt-1">
              {change === 0 ? 'No change' : `${change > 0 ? '+' : ''}${change.toFixed(1)} lb`} since starting
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 text-xs font-semibold text-accent-end bg-accent-start/10 rounded-full px-3.5 py-2 shrink-0"
        >
          <Plus size={14} /> Log weight
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder="Weight (lb)"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            autoFocus
            className="flex-1 bg-base-900 rounded-xl px-3 py-2.5 text-sm text-base-100 outline-none focus:ring-1 focus:ring-accent-start"
          />
          <button
            type="submit"
            disabled={saving}
            className="accent-gradient text-white font-semibold text-sm rounded-xl px-4 py-2.5 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>
      )}

      {logs.length > 1 ? (
        <>
          <div className="mt-5">
            <TrendLineChart data={chartData} xKey="date" yKey="weight" />
          </div>
          <div className="flex gap-1.5 mt-3">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                type="button"
                onClick={() => setTimeframe(tf.value)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                  timeframe === tf.value ? 'bg-base-100 text-base-800' : 'bg-base-900 text-base-400'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-base-400 mt-5">Log at least two entries to see your trend.</p>
      )}
    </div>
  )
}
