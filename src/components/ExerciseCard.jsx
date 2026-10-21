import { useState } from 'react'
import { Check, Repeat, ExternalLink } from 'lucide-react'
import InfoTooltip from './InfoTooltip'
import LastSetDifficultyTap from './LastSetDifficultyTap'
import { RPE_EXPLAINER, GOAL_WEEK } from '../data/program'
import { isValidReps, isValidWeight } from '../data/helpers'

const ROW_GRID = 'grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 items-center'
const INPUT_CLASS =
  'w-full min-w-0 bg-base-900 rounded-xl px-2 py-1.5 text-sm text-base-100 outline-none focus:ring-1 focus:ring-accent-start'

function SuggestionLines({ suggestion }) {
  if (!suggestion) return null
  const { action, targetWeight, targetReps, goalWeight, lastWeight, unit } = suggestion
  const showLastTime = (action === 'increase' || action === 'decrease') && lastWeight != null

  return (
    <div className="mt-1 space-y-0.5">
      {action === 'calibrate' ? (
        <p className="text-xs text-accent-end font-medium">Calibrating — pick a weight that leaves ~2–3 reps</p>
      ) : (
        targetWeight != null && (
          <p className="text-xs text-accent-end font-medium">
            Today: {targetWeight} {unit}
            {targetReps ? ` · aim for ${targetReps} reps` : ''}
            {action === 'deload' ? ' · deload' : ''}
          </p>
        )
      )}
      {showLastTime && (
        <p className="text-[11px] text-base-400">
          Last time: {lastWeight} {unit}
        </p>
      )}
      {goalWeight != null && (
        <p className="text-[11px] text-base-400">
          Goal {goalWeight} {unit} by week {GOAL_WEEK}
        </p>
      )}
    </div>
  )
}

// One exercise slot in a live session.
// - activeAlt: null for the base exercise, else the swapped-in { name, demoUrl }.
// - entries[i]: unsaved draft { weight, reps } for set i+1 (weight undefined = use prefill).
// - logs: { [setNumber]: exercise_logs row } already saved to Supabase.
// - prefillWeights[i]: starting weight value for set i+1.
// - onSaveSet(index, { weight, reps }) -> Promise<boolean>; also used to edit a logged set.
// - onRemoveSet(row) -> Promise<boolean>.
// - difficulty / onDifficulty: last-set tap, available once >= 1 set is logged,
//   highlighted once the final prescribed set is in.
export default function ExerciseCard({
  exercise,
  prescribedSets,
  suggestion,
  activeAlt,
  onSwap,
  entries,
  logs,
  prefillWeights,
  onEntryChange,
  onSaveSet,
  onRemoveSet,
  savingSets,
  difficulty,
  onDifficulty,
  locked,
}) {
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [editing, setEditing] = useState(null) // { index, weight, reps }

  const activeName = activeAlt?.name ?? exercise.name
  const activeDemoUrl = activeAlt?.demoUrl ?? exercise.demoUrl
  const demoHref =
    activeDemoUrl ||
    `https://www.youtube.com/results?search_query=${encodeURIComponent(activeName + ' proper form')}`

  const loggedNumbers = Object.keys(logs).map(Number)
  const rowCount = Math.max(prescribedSets, ...loggedNumbers, 0)
  const promptDifficulty = !!logs[prescribedSets] && !difficulty

  async function saveEdit() {
    const ok = await onSaveSet(editing.index, { weight: editing.weight, reps: editing.reps })
    if (ok) setEditing(null)
  }

  async function removeEdited(row) {
    const ok = await onRemoveSet(row)
    if (ok) setEditing(null)
  }

  return (
    <div className="card rounded-[28px] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-display font-extrabold text-base text-base-100">{activeName}</h4>
          <p className="text-xs text-base-400 mt-0.5 flex items-center gap-1 flex-wrap">
            {prescribedSets} sets × {exercise.repRange}
            {exercise.supersetGroup && ' · superset'} · {RPE_EXPLAINER.cue}
            <InfoTooltip title={RPE_EXPLAINER.title} body={RPE_EXPLAINER.body} />
          </p>
          <SuggestionLines suggestion={suggestion} />
        </div>
        <button
          type="button"
          disabled={locked}
          onClick={() => setShowAlternatives((s) => !s)}
          className="text-base-400 hover:text-accent-start transition-colors flex items-center gap-1 text-xs shrink-0 disabled:opacity-40"
        >
          <Repeat size={14} /> Swap
        </button>
      </div>

      {showAlternatives && (
        <div className="mt-3 flex flex-wrap gap-2">
          {[null, ...exercise.alternatives].map((alt) => {
            const isActive = alt ? activeAlt?.name === alt.name : !activeAlt
            return (
              <button
                key={alt?.name ?? 'default'}
                type="button"
                onClick={() => {
                  onSwap(alt)
                  setShowAlternatives(false)
                }}
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                  isActive ? 'bg-accent-start text-white' : 'bg-base-900 text-base-200 hover:bg-base-700'
                }`}
              >
                {alt ? alt.name : `${exercise.name} (default)`}
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-4 space-y-2">
        <div className={`${ROW_GRID} text-xs text-base-400 px-1`}>
          <span>Set</span>
          <span>Weight</span>
          <span>Reps</span>
          <span />
        </div>
        {Array.from({ length: rowCount }).map((_, i) => {
          const setNumber = i + 1
          const row = logs[setNumber]
          const saving = !!savingSets[setNumber]

          if (editing?.index === i && row) {
            const canSave = isValidWeight(editing.weight) && isValidReps(editing.reps) && !saving
            return (
              <div key={i} className="space-y-1.5">
                <div className={ROW_GRID}>
                  <span className="text-sm text-base-400">{setNumber}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="lb"
                    value={editing.weight}
                    onChange={(e) => setEditing((ed) => ({ ...ed, weight: e.target.value }))}
                    className={INPUT_CLASS}
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="reps"
                    value={editing.reps}
                    onChange={(e) => setEditing((ed) => ({ ...ed, reps: e.target.value }))}
                    className={INPUT_CLASS}
                  />
                  <button
                    type="button"
                    disabled={!canSave}
                    onClick={saveEdit}
                    className="flex items-center justify-center w-7 h-7 rounded-full accent-gradient text-white disabled:opacity-25 transition-opacity"
                    aria-label={`Save set ${setNumber}`}
                  >
                    <Check size={14} />
                  </button>
                </div>
                <div className="flex gap-4 pl-10 text-xs">
                  <button type="button" disabled={saving} onClick={() => removeEdited(row)} className="text-[var(--color-glute)] font-medium disabled:opacity-40">
                    Remove set
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="text-base-400">
                    Cancel
                  </button>
                </div>
              </div>
            )
          }

          if (row) {
            return (
              <button
                key={i}
                type="button"
                disabled={locked}
                onClick={() => setEditing({ index: i, weight: row.weight ?? '', reps: row.reps ?? '' })}
                className={`${ROW_GRID} w-full text-left bg-[var(--color-back)]/8 rounded-xl px-1 py-1.5`}
                aria-label={`Edit set ${setNumber}`}
              >
                <span className="text-sm text-base-400">{setNumber}</span>
                <span className="text-sm font-semibold text-base-100">{row.weight ?? '—'} lb</span>
                <span className="text-sm font-semibold text-base-100">{row.reps}</span>
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[var(--color-back)] text-white">
                  <Check size={14} />
                </span>
              </button>
            )
          }

          const entry = entries[i]
          const weight = entry?.weight !== undefined ? entry.weight : (prefillWeights[i] ?? '')
          const reps = entry?.reps ?? ''
          const canLog = isValidWeight(weight) && isValidReps(reps) && !saving && !locked

          return (
            <div key={i} className={ROW_GRID}>
              <span className="text-sm text-base-400">{setNumber}</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="lb"
                value={weight}
                disabled={locked}
                onChange={(e) => onEntryChange(i, 'weight', e.target.value)}
                className={INPUT_CLASS}
              />
              <input
                type="number"
                inputMode="numeric"
                placeholder="reps"
                value={reps}
                disabled={locked}
                onChange={(e) => onEntryChange(i, 'reps', e.target.value)}
                className={INPUT_CLASS}
              />
              <button
                type="button"
                disabled={!canLog}
                onClick={() => onSaveSet(i, { weight, reps })}
                className="flex items-center justify-center w-7 h-7 rounded-full accent-gradient text-white disabled:opacity-25 transition-opacity"
                aria-label={`Log set ${setNumber}`}
              >
                <Check size={14} />
              </button>
            </div>
          )
        })}
      </div>

      {loggedNumbers.length > 0 && (
        <div className={`mt-3 rounded-2xl p-3 ${promptDifficulty ? 'bg-accent-start/10 ring-1 ring-accent-start/40' : 'bg-base-900'}`}>
          <p className="text-xs text-base-400 mb-2">Last set — how many reps did you have left?</p>
          <LastSetDifficultyTap value={difficulty} onChange={onDifficulty} disabled={locked} />
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
