import { GOAL_WEEK } from '@/data/program'
import { HOLD_RULE } from '@/domain/sessionRules'

// Plain-words versions of getExerciseSuggestion() for the coral callout on
// the open exercise card. Suggestions only — she can always override.

function lastTime({ lastWeight, lastReps, unit }) {
  if (lastWeight == null) return ''
  return `Last time ${lastWeight} ${unit}${lastReps ? ` × ${lastReps}` : ''}. `
}

export function suggestionCallout(suggestion) {
  if (!suggestion) return null
  const { action, targetWeight: target, targetReps: reps, unit } = suggestion
  const last = lastTime(suggestion)
  switch (action) {
    case 'increase':
      return `${last}Try ${target} ${unit} today.`
    case 'decrease':
      return `${last}Drop to ${target} ${unit} today and aim for ${reps} reps.`
    case 'more-reps':
      return `${last}Same weight — aim for ${reps} reps.`
    case 'hold':
      return `${last}Stay at ${target} ${unit} today. Weight goes up once you've done ${HOLD_RULE.minSessions} workouts in ${HOLD_RULE.days} days.`
    case 'repeat-once':
      return `${last}That was all-out — repeat ${target} ${unit} today.`
    case 'deload':
      return target != null ? `Deload week — ${target} ${unit}, fewer sets. Keep it easy.` : 'Deload week — fewer sets. Keep it easy.'
    case 'calibrate':
      return 'Calibrating — pick a weight that leaves 2–3 reps in the tank.'
    case 'start':
      return target != null
        ? `Start at ${target} ${unit} and aim for ${reps} reps.`
        : 'First time on this one — pick a weight that leaves 2–3 reps.'
    default:
      return null
  }
}

export function goalLine(suggestion) {
  if (suggestion?.goalWeight == null) return null
  return `Goal ${suggestion.goalWeight} ${suggestion.unit} by week ${GOAL_WEEK}`
}
