import { useState } from 'react'
import { ArrowRight, ExternalLink, Repeat } from 'lucide-react'
import { LAST_SET_DIFFICULTY_OPTIONS, RPE_EXPLAINER } from '@/data/program'
import { isValidReps, isValidWeight } from '@/domain/metrics'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/alert-dialog'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { ChoiceChips } from '@/ui/choice-chips'
import { InfoPopover } from '@/ui/info-popover'
import { SetRow, SetRowHeader } from '@/ui/set-row'
import { formatRepRange } from './exerciseProgress'
import { goalLine, suggestionCallout } from './suggestionCopy'

const DIFFICULTY_CHIPS = LAST_SET_DIFFICULTY_OPTIONS.map((opt) => ({ value: opt.value, label: opt.feel, detail: opt.label }))

// The open exercise: header, suggestion, set rows, last-set difficulty.
// Logged rows open an inline editor; removing asks first.
// - entries[i]: unsaved { weight, reps } for set i+1 (weight undefined = prefill)
// - logs: { [setNumber]: exercise_logs row }
// - onLogSet(index, values) / onRemoveSet(row) resolve true on success
export function ExerciseCard({
  exercise,
  activeAlt,
  prescribedSets,
  rowCount,
  supersetPartner,
  suggestion,
  entries,
  logs,
  prefillWeights,
  savingSets,
  difficulty,
  locked,
  isComplete,
  isOnlySetInWorkout,
  onEntryChange,
  onLogSet,
  onRemoveSet,
  onRequestSwap,
  onDifficulty,
  onNext,
}) {
  const [editing, setEditing] = useState(null) // { index, weight, reps }
  const [confirmRemove, setConfirmRemove] = useState(null) // row
  const activeName = activeAlt?.name ?? exercise.name
  const demoHref =
    (activeAlt ? activeAlt.demoUrl : exercise.demoUrl) ||
    `https://www.youtube.com/results?search_query=${encodeURIComponent(`${activeName} proper form`)}`
  const unit = exercise.weight.unit
  const loggedCount = Object.keys(logs).length
  const firstOpenIndex = Array.from({ length: rowCount }).findIndex((_, i) => !logs[i + 1])
  const promptDifficulty = isComplete && !difficulty
  const callout = suggestionCallout(suggestion)
  const goal = goalLine(suggestion)

  async function saveEdit() {
    if (await onLogSet(editing.index, { weight: editing.weight, reps: editing.reps })) setEditing(null)
  }

  async function removeConfirmed() {
    const row = confirmRemove
    setConfirmRemove(null)
    if (await onRemoveSet(row)) setEditing(null)
  }

  return (
    <Card raised as="section" aria-labelledby={`exercise-${exercise.id}-name`} className="space-y-4 p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`exercise-${exercise.id}-name`} className="font-display text-title-lg font-extrabold text-foreground">
            {activeName}
          </h2>
          {activeAlt && <p className="text-caption text-muted-foreground">Instead of {exercise.name}</p>}
          <p className="mt-1 text-body-sm text-foreground-secondary">
            {prescribedSets} sets · {formatRepRange(exercise.repRange)}
          </p>
          {supersetPartner && <p className="text-caption text-muted-foreground">Superset with {supersetPartner}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={onRequestSwap} disabled={locked} className="shrink-0">
          <Repeat /> Swap
        </Button>
      </header>

      {callout && (
        <div className="rounded-row border border-accent-border bg-accent px-3.5 py-3">
          <p className="text-body-sm font-semibold text-accent-deep">{callout}</p>
          {goal && <p className="mt-0.5 text-caption text-accent-foreground">{goal}</p>}
        </div>
      )}

      <p className="flex items-center gap-2 text-caption text-muted-foreground">
        {RPE_EXPLAINER.cue}
        <InfoPopover label={RPE_EXPLAINER.title} title={RPE_EXPLAINER.title}>
          {RPE_EXPLAINER.body}
        </InfoPopover>
      </p>

      <div className="space-y-2">
        <SetRowHeader unit={unit} />
        {Array.from({ length: rowCount }).map((_, i) => {
          const setNumber = i + 1
          const row = logs[setNumber]
          const id = `set-${exercise.id}-${setNumber}`
          const saving = !!savingSets[setNumber]

          if (row && editing?.index === i) {
            return (
              <SetRow
                key={setNumber}
                mode="editing"
                id={id}
                setNumber={setNumber}
                unit={unit}
                weight={editing.weight}
                reps={editing.reps}
                onWeightChange={(weight) => setEditing((ed) => ({ ...ed, weight }))}
                onRepsChange={(reps) => setEditing((ed) => ({ ...ed, reps }))}
                canSubmit={isValidWeight(editing.weight) && isValidReps(editing.reps)}
                saving={saving}
                disabled={locked}
                onSubmit={saveEdit}
                onRemove={() => setConfirmRemove(row)}
                onCancel={() => setEditing(null)}
              />
            )
          }

          if (row) {
            return (
              <SetRow
                key={setNumber}
                mode="logged"
                setNumber={setNumber}
                unit={unit}
                weight={row.weight}
                reps={row.reps}
                disabled={locked}
                onEdit={() => setEditing({ index: i, weight: row.weight ?? '', reps: row.reps ?? '' })}
              />
            )
          }

          const entry = entries[i]
          const weight = entry?.weight !== undefined ? entry.weight : (prefillWeights[i] ?? '')
          const reps = entry?.reps ?? ''
          return (
            <SetRow
              key={setNumber}
              mode="active"
              id={id}
              setNumber={setNumber}
              unit={unit}
              weight={weight}
              reps={reps}
              current={i === firstOpenIndex && !editing}
              onWeightChange={(value) => onEntryChange(i, 'weight', value)}
              onRepsChange={(value) => onEntryChange(i, 'reps', value)}
              canSubmit={isValidWeight(weight) && isValidReps(reps)}
              saving={saving}
              disabled={locked}
              onSubmit={() => onLogSet(i, { weight, reps })}
            />
          )
        })}
      </div>

      {loggedCount > 0 && (
        <div className={cn('space-y-2 rounded-row p-3', promptDifficulty ? 'border-[1.5px] border-primary bg-accent' : 'bg-surface-muted')}>
          <p id={`difficulty-${exercise.id}`} className="text-body-sm font-semibold text-foreground">
            How did the last set feel?
          </p>
          <ChoiceChips
            label="How did the last set feel?"
            options={DIFFICULTY_CHIPS}
            value={difficulty}
            onChange={onDifficulty}
            disabled={locked}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <a href={demoHref} target="_blank" rel="noreferrer">
            <ExternalLink /> Watch demo
          </a>
        </Button>
        {isComplete && onNext && (
          <Button variant="ghost" size="sm" onClick={onNext}>
            Next exercise <ArrowRight />
          </Button>
        )}
      </div>

      <AlertDialog open={!!confirmRemove} onOpenChange={(open) => !open && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove set {confirmRemove?.set_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRemove?.weight ?? '—'} {unit} × {confirmRemove?.reps} will be deleted.
              {isOnlySetInWorkout && ' It’s the only set logged, so this workout will be cleared too.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction variant="destructive" onClick={removeConfirmed}>
              Remove set
            </AlertDialogAction>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
