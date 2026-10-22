import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { NumberInput } from '@/ui/number-input'

// One set in a workout. Columns: set number / weight / reps / action.
//   logged  — green-tint row with a green check; tapping it starts editing
//   active  — weight + reps inputs and a 52px coral check that logs the
//             set; `current` gives the weight input the 2px coral border
//   editing — the same inputs for a logged set, plus Remove and Cancel
// Input ids are `${id}-weight` / `${id}-reps` so the screen can move focus.
const ROW_GRID = 'grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)_var(--spacing-input)] items-center gap-2'

export function SetRowHeader({ unit }) {
  return (
    <div aria-hidden="true" className={cn(ROW_GRID, 'px-1 text-caption font-semibold text-muted-foreground')}>
      <span>Set</span>
      <span>Weight ({unit})</span>
      <span>Reps</span>
      <span />
    </div>
  )
}

export function SetRow(props) {
  if (props.mode === 'logged') return <LoggedSetRow {...props} />
  return <EntrySetRow {...props} />
}

function LoggedSetRow({ setNumber, weight, reps, unit, onEdit, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onEdit}
      aria-label={`Set ${setNumber}: ${weight ?? '—'} ${unit} × ${reps}. Edit`}
      className={cn(
        ROW_GRID,
        'focus-ring w-full rounded-row border border-success-border bg-success-tint px-1 py-1 text-left disabled:opacity-100',
      )}
    >
      <span className="text-center text-body font-bold text-success-foreground">{setNumber}</span>
      <span className="px-3 text-field font-semibold text-foreground tabular-nums">
        {weight ?? '—'} <span className="text-body-sm font-normal text-muted-foreground">{unit}</span>
      </span>
      <span className="px-3 text-field font-semibold text-foreground tabular-nums">{reps}</span>
      <span className="flex size-input items-center justify-center">
        <span className="flex size-9 items-center justify-center rounded-full bg-success text-primary-foreground">
          <Check aria-hidden="true" className="size-5" strokeWidth={3} />
        </span>
      </span>
    </button>
  )
}

function EntrySetRow({
  mode,
  id,
  setNumber,
  unit,
  weight,
  reps,
  current = false,
  onWeightChange,
  onRepsChange,
  onSubmit,
  canSubmit,
  saving = false,
  disabled = false,
  onRemove,
  onCancel,
}) {
  const editing = mode === 'editing'
  const actionLabel = editing ? `Save set ${setNumber}` : `Log set ${setNumber}`
  return (
    <div className={cn('space-y-2', editing && 'rounded-row border border-accent-border bg-accent p-1')}>
      <form
        className={ROW_GRID}
        onSubmit={(e) => {
          e.preventDefault()
          if (canSubmit) onSubmit()
        }}
      >
        <span className={cn('text-center text-body font-bold', current || editing ? 'text-accent-foreground' : 'text-muted-foreground')}>
          {setNumber}
        </span>
        <NumberInput
          id={`${id}-weight`}
          label={`Set ${setNumber} weight (${unit})`}
          placeholder={unit}
          active={current || editing}
          value={weight}
          disabled={disabled}
          onChange={(e) => onWeightChange(e.target.value)}
        />
        <NumberInput
          id={`${id}-reps`}
          label={`Set ${setNumber} reps`}
          placeholder="reps"
          decimal={false}
          value={reps}
          disabled={disabled}
          onChange={(e) => onRepsChange(e.target.value)}
        />
        <Button type="submit" size="icon-lg" aria-label={actionLabel} disabled={!canSubmit || disabled || saving}>
          {saving ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Check aria-hidden="true" strokeWidth={3} />}
        </Button>
      </form>
      {editing && (
        <div className="flex gap-2 pl-9">
          <Button variant="destructive" size="sm" disabled={saving} onClick={onRemove}>
            Remove set
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
