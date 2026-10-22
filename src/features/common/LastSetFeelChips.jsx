import { ChoiceChips } from '@/ui/choice-chips'
import { LAST_SET_FEEL_OPTIONS, LAST_SET_FEEL_QUESTION } from './lastSetFeel'

// "How did the last set feel?" — Easy / 3+ left, Just right / 1–2 left,
// Hard / 0 left. value: '3+' | '1-2' | '0' | null (the caller maps it to
// exercise_logs.rpe 7 / 8.5 / 10). Shared by the workout and History.
export function LastSetFeelChips({ value, onChange, disabled, label = LAST_SET_FEEL_QUESTION }) {
  return <ChoiceChips label={label} options={LAST_SET_FEEL_OPTIONS} value={value} onChange={onChange} disabled={disabled} />
}
