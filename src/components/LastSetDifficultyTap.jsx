import { LAST_SET_DIFFICULTY_OPTIONS } from '../data/program'

// Three-option "how many reps were left on the last set" tap. value is an
// option value ('3+' | '1-2' | '0') or null; tapping the active option
// clears it. The parent maps it to exercise_logs.rpe.
export default function LastSetDifficultyTap({ value, onChange, disabled }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {LAST_SET_DIFFICULTY_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(value === opt.value ? null : opt.value)}
          className={`py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-60 ${
            value === opt.value ? 'accent-gradient text-white' : 'bg-base-800 text-base-200 hover:bg-base-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
