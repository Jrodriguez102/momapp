import { useState } from 'react'
import { Repeat, ExternalLink } from 'lucide-react'
import InfoTooltip from './InfoTooltip'
import { RPE_EXPLAINER } from '../data/program'

// activeAlt: null when the base exercise is active, otherwise the selected
// alternative object ({ name, demoUrl }). Controlled by the parent
// (WorkoutSession) so the swap choice persists to storage like everything
// else in the session — a local useState here would reset on remount.
export default function ExerciseCard({ exercise, prescribedSets, lastLoggedText, sets, onSetChange, activeAlt, onSwap }) {
  const [showAlternatives, setShowAlternatives] = useState(false)

  const isCardio = !!exercise.isCardio
  const activeName = activeAlt?.name ?? exercise.name
  const activeDemoUrl = activeAlt?.demoUrl ?? exercise.demoUrl
  const demoHref =
    activeDemoUrl ||
    `https://www.youtube.com/results?search_query=${encodeURIComponent(activeName + ' proper form')}`

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-display text-base text-base-100">{activeName}</h4>
          <p className="text-xs text-base-400 mt-0.5 flex items-center gap-1">
            {isCardio ? (
              `${exercise.duration} · ${exercise.cardioType.replace('-', ' ')}`
            ) : (
              <>
                {prescribedSets} sets x {exercise.repRange} · RPE {exercise.rpe}
                <InfoTooltip title={RPE_EXPLAINER.title} body={RPE_EXPLAINER.body} />
              </>
            )}
          </p>
          {lastLoggedText && (
            <p className="text-xs text-accent-start mt-1">Last time: {lastLoggedText}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowAlternatives((s) => !s)}
          className="text-base-400 hover:text-accent-start transition-colors flex items-center gap-1 text-xs shrink-0"
        >
          <Repeat size={14} /> Swap
        </button>
      </div>

      {showAlternatives && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              onSwap(null)
              setShowAlternatives(false)
            }}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              !activeAlt ? 'bg-accent-start text-base-950' : 'bg-base-800 text-base-200 hover:bg-base-700'
            }`}
          >
            {exercise.name} (default)
          </button>
          {exercise.alternatives?.map((alt) => (
            <button
              key={alt.name}
              type="button"
              onClick={() => {
                onSwap(alt)
                setShowAlternatives(false)
              }}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                activeAlt?.name === alt.name ? 'bg-accent-start text-base-950' : 'bg-base-800 text-base-200 hover:bg-base-700'
              }`}
            >
              {alt.name}
            </button>
          ))}
        </div>
      )}

      {!isCardio && (
        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-[2rem_1fr_1fr] gap-2 text-xs text-base-400 px-1">
            <span>Set</span>
            <span>Weight</span>
            <span>Reps</span>
          </div>
          {Array.from({ length: prescribedSets }).map((_, i) => (
            <div key={i} className="grid grid-cols-[2rem_1fr_1fr] gap-2 items-center">
              <span className="text-sm text-base-400">{i + 1}</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="lb"
                value={sets[i]?.weight ?? ''}
                onChange={(e) => onSetChange(i, 'weight', e.target.value)}
                className="bg-base-800 rounded-lg px-2 py-1.5 text-sm text-base-100 outline-none focus:ring-1 focus:ring-accent-start"
              />
              <input
                type="number"
                inputMode="numeric"
                placeholder="reps"
                value={sets[i]?.reps ?? ''}
                onChange={(e) => onSetChange(i, 'reps', e.target.value)}
                className="bg-base-800 rounded-lg px-2 py-1.5 text-sm text-base-100 outline-none focus:ring-1 focus:ring-accent-start"
              />
            </div>
          ))}
        </div>
      )}

      <a
        href={demoHref}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-xs text-base-400 hover:text-accent-start transition-colors"
      >
        <ExternalLink size={12} /> Watch demo
      </a>
    </div>
  )
}
