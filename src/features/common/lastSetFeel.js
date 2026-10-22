import { LAST_SET_DIFFICULTY_OPTIONS } from '@/data/program'

// Last-set difficulty, as shown on the workout and History screens.
export const LAST_SET_FEEL_QUESTION = 'How did the last set feel?'

export const LAST_SET_FEEL_OPTIONS = LAST_SET_DIFFICULTY_OPTIONS.map((opt) => ({
  value: opt.value,
  label: opt.feel,
  detail: opt.label,
}))

// '1-2' -> "Just right (1–2 left)" for read-only display.
export function lastSetFeelText(value) {
  const opt = LAST_SET_DIFFICULTY_OPTIONS.find((o) => o.value === value)
  return opt ? `${opt.feel} (${opt.label})` : null
}
