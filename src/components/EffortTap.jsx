import { EFFORT_OPTIONS } from '../data/program'

export default function EffortTap({ value, onChange }) {
  return (
    <div>
      <p className="text-sm text-base-400 mb-2">How did today feel?</p>
      <div className="grid grid-cols-4 gap-2">
        {EFFORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`py-3 rounded-xl text-xs font-medium transition-all ${
              value === opt.value
                ? 'accent-gradient text-base-950'
                : 'glass text-base-200 hover:border-accent-start/40'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
