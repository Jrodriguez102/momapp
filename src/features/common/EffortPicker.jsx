import { getSessionRpeLabel } from '@/domain/sessionRules'
import { ChoiceChips } from '@/ui/choice-chips'

const SCALE = Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))

// Whole-session effort, 1-10 (workout_sessions.session_rpe): two rows of
// five 48px chips. Optional — tapping the selected number clears it.
// statusText (e.g. "Saved") is appended to the caption line.
export function EffortPicker({ value, onChange, disabled, statusText, title = 'How hard was it overall?' }) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p id="effort-title" className="font-display text-title font-extrabold text-foreground">
          {title}
        </p>
        <p className="shrink-0 text-caption text-muted-foreground">Optional</p>
      </div>
      <ChoiceChips
        label={title}
        options={SCALE}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="grid-cols-5"
        chipClassName="min-h-12 text-body"
      />
      <p aria-live="polite" className="text-caption text-muted-foreground">
        {value ? `${value} of 10 · ${getSessionRpeLabel(value)}` : '1 = very easy · 10 = everything you had'}
        {statusText && <span className="font-semibold"> · {statusText}</span>}
      </p>
    </div>
  )
}
