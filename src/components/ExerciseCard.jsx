import { useState } from 'react'
import { Check, Repeat, ExternalLink } from 'lucide-react'
import InfoTooltip from './InfoTooltip'
import { RPE_EXPLAINER } from '../data/program'

// activeAlt: null when the base exercise is active, otherwise the selected
// alternative object ({ name, demoUrl }). Controlled by the parent
// (WorkoutSession) so the swap choice persists to storage like everything
// else in the session — a local useState here would reset on remount.
//
// sets[i]: { weight, reps, completed }. A completed set is locked/read-only
// — logging is immediate and final for this pass (no post-log editing).
export default function ExerciseCard({ exercise, prescribedSets, lastLoggedText, sets, onSetChange, onLogSet, activeAlt, onSwap }) {
  const [showAlternatives, setShowAlternatives] = useState(false)

  const isCardio = !!exercise.isCardio
  const activeName = activeAlt?.name ?? exercise.name
  const activeDemoUrl = activeAlt?.demoUrl ?? exercise.demoUrl
  const demoHref =
    activeDemoUrl ||
    `https://www.youtube.com/results?search_query=${encodeURIComponent(activeName + ' proper form')}`

  return (
    <div className="card rounded-[28px] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-display font-extrabold text-base text-base-100">{activeName}</h4>
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
            <p className="text-xs text-accent-end mt-1 font-medium">Last time: {lastLoggedText}</p>
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
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              !activeAlt ? 'bg-accent-start text-white' : 'bg-base-900 text-base-200 hover:bg-base-700'
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
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                activeAlt?.name === alt.name ? 'bg-accent-start text-white' : 'bg-base-900 text-base-200 hover:bg-base-700'
              }`}
            >
              {alt.name}
            </button>
          ))}
        </div>
      )}

      {!isCardio && (
        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 text-xs text-base-400 px-1">
            <span>Set</span>
            <span>Weight</span>
            <span>Reps</span>
            <span />
          </div>
          {Array.from({ length: prescribedSets }).map((_, i) => {
            const set = sets[i]
            const canLog = set?.weight !== '' && set?.weight != null && set?.reps !== '' && set?.reps != null

            if (set?.completed) {
              return (
                <div
                  key={i}
                  className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 items-center bg-[var(--color-back)]/8 rounded-xl px-1 py-1.5"
                >
                  <span className="text-sm text-base-400">{i + 1}</span>
                  <span className="text-sm font-semibold text-base-100">{set.weight} lb</span>
                  <span className="text-sm font-semibold text-base-100">{set.reps}</span>
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[var(--color-back)] text-white">
                    <Check size={14} />
                  </span>
                </div>
              )
            }

            return (
              <div key={i} className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 items-center">
                <span className="text-sm text-base-400">{i + 1}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="lb"
                  value={set?.weight ?? ''}
                  onChange={(e) => onSetChange(i, 'weight', e.target.value)}
                  className="w-full min-w-0 bg-base-900 rounded-xl px-2 py-1.5 text-sm text-base-100 outline-none focus:ring-1 focus:ring-accent-start"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="reps"
                  value={set?.reps ?? ''}
                  onChange={(e) => onSetChange(i, 'reps', e.target.value)}
                  className="w-full min-w-0 bg-base-900 rounded-xl px-2 py-1.5 text-sm text-base-100 outline-none focus:ring-1 focus:ring-accent-start"
                />
                <button
                  type="button"
                  disabled={!canLog}
                  onClick={() => onLogSet(i)}
                  className="flex items-center justify-center w-7 h-7 rounded-full accent-gradient text-white disabled:opacity-25 transition-opacity"
                  aria-label={`Log set ${i + 1}`}
                >
                  <Check size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {!isCardio && (
        <a
          href={demoHref}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs text-base-400 hover:text-accent-start transition-colors"
        >
          <ExternalLink size={12} /> Watch demo
        </a>
      )}
    </div>
  )
}
