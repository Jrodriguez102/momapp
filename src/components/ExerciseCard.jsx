import { useState } from 'react'
import { Repeat, ExternalLink } from 'lucide-react'
import InfoTooltip from './InfoTooltip'
import { RPE_EXPLAINER } from '../data/program'

export default function ExerciseCard({ exercise, prescribedSets, lastLoggedText, sets, onSetChange }) {
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [activeName, setActiveName] = useState(exercise.name)

  const isCardio = !!exercise.isCardio

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-display text-base text-base-100">{activeName}</h4>
          <p className="text-xs text-base-400 mt-0.5">
            {isCardio
              ? `${exercise.duration} · ${exercise.cardioType.replace('-', ' ')}`
              : `${prescribedSets} sets x ${exercise.repRange} · RPE ${exercise.rpe}`}
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
          {exercise.alternatives?.map((alt) => (
            <button
              key={alt}
              type="button"
              onClick={() => {
                setActiveName(alt)
                setShowAlternatives(false)
              }}
              className="text-xs px-3 py-1.5 rounded-full bg-base-800 text-base-200 hover:bg-base-700 transition-colors"
            >
              {alt}
            </button>
          ))}
        </div>
      )}

      {!isCardio && (
        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-[2rem_1fr_1fr_1fr] gap-2 text-xs text-base-400 px-1">
            <span>Set</span>
            <span>Weight</span>
            <span>Reps</span>
            <span className="flex items-center gap-1">
              RPE <InfoTooltip title={RPE_EXPLAINER.title} body={RPE_EXPLAINER.body} />
            </span>
          </div>
          {Array.from({ length: prescribedSets }).map((_, i) => (
            <div key={i} className="grid grid-cols-[2rem_1fr_1fr_1fr] gap-2 items-center">
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
              <input
                type="number"
                inputMode="decimal"
                placeholder="RPE"
                min="1"
                max="10"
                value={sets[i]?.rpe ?? ''}
                onChange={(e) => onSetChange(i, 'rpe', e.target.value)}
                className="bg-base-800 rounded-lg px-2 py-1.5 text-sm text-base-100 outline-none focus:ring-1 focus:ring-accent-start"
              />
            </div>
          ))}
        </div>
      )}

      <a
        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(activeName + ' proper form')}`}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-xs text-base-400 hover:text-accent-start transition-colors"
      >
        <ExternalLink size={12} /> Watch demo
      </a>
    </div>
  )
}
