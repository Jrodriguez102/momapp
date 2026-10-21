import { Scale, X } from 'lucide-react'
import BodyWeightForm from './BodyWeightForm'

// Weekly weigh-in prompt on Home — the parent only renders it when there's
// no body_weight_logs entry in the last 7 days and it wasn't dismissed today.
export default function WeighInCard({ onSaved, onDismiss }) {
  return (
    <div className="card rounded-[28px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-accent-start/10 flex items-center justify-center shrink-0">
            <Scale size={18} className="text-accent-end" />
          </span>
          <div>
            <h3 className="font-display font-extrabold text-lg text-base-100">Weekly weigh-in</h3>
            <p className="text-xs text-base-400 mt-0.5">It's been a week — log today's weight.</p>
          </div>
        </div>
        <button type="button" onClick={onDismiss} className="text-base-400 hover:text-base-100 shrink-0" aria-label="Not now">
          <X size={18} />
        </button>
      </div>
      <div className="mt-4">
        <BodyWeightForm onSaved={onSaved} autoFocus={false} />
      </div>
    </div>
  )
}
