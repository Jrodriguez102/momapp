import { SESSION_RPE_ANCHORS } from '../data/program'

const SCALE = Array.from({ length: 10 }, (_, i) => i + 1)

// Whole-session effort, 1-10 (written to workout_sessions.session_rpe).
// value: number | null; tapping the active number clears it.
export default function EffortTap({ value, onChange, disabled, label = 'How hard was today overall?' }) {
  return (
    <div>
      <p className="text-sm text-base-400 mb-2">{label}</p>
      <div className="grid grid-cols-10 gap-1">
        {SCALE.map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(value === n ? null : n)}
            className={`py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${
              value === n ? 'accent-gradient text-white' : 'bg-base-900 text-base-200 hover:bg-base-700'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-10 gap-1 mt-1.5 text-[10px] text-base-400 text-center">
        {SESSION_RPE_ANCHORS.map((a) => (
          <span key={a.label} style={{ gridColumn: `span ${a.max - a.min + 1}` }}>
            {a.label}
          </span>
        ))}
      </div>
    </div>
  )
}
