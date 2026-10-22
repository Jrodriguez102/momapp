import { HOLD_RULE } from './sessionRules'

// ---- Progression suggestions ---------------------------------------------------
// Suggestions only — she can always override. Reads block >= 1 sets only
// (pilot block 0 reps were pre-filled and can't be trusted), from both
// completed and partial sessions, tracked per exercise_name.
export function parseRepRange(repRange) {
  const match = /(\d+)\s*-\s*(\d+)/.exec(repRange || '')
  return match ? { min: Number(match[1]), max: Number(match[2]) } : null
}

// One entry per session for this exercise name, newest first:
// { sessionId, date, sets (by set_number), workingWeight, rpe }.
function groupProgressionSessions(logs, exerciseName) {
  const bySession = new Map()
  for (const log of logs) {
    if (log.exercise_name !== exerciseName || log.reps == null) continue
    if (!bySession.has(log.session_id)) bySession.set(log.session_id, [])
    bySession.get(log.session_id).push(log)
  }
  return [...bySession.values()]
    .map((sets) => {
      const sorted = [...sets].sort((a, b) => a.set_number - b.set_number)
      return {
        sessionId: sorted[0].session_id,
        date: sorted.reduce((latest, s) => (s.logged_at > latest ? s.logged_at : latest), sorted[0].logged_at),
        sets: sorted,
        workingWeight: Math.max(...sorted.map((s) => Number(s.weight) || 0)) || null,
        rpe: sorted.find((s) => s.rpe != null)?.rpe ?? null,
      }
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
}

function roundWeight(w) {
  return Math.round(w * 100) / 100
}

// Double progression for one exercise slot, given the name she's doing today
// (the base exercise or a swapped-in alternative). Returns:
//   prefillWeight — the weight input's starting value: the suggested target
//                   on increase/decrease days, otherwise the last logged
//                   block >= 1 weight for this name, else the base
//                   exercise's startWeight (alternatives: blank)
//   lastWeight    — last logged block >= 1 working weight for this name
//   lastReps      — best reps at lastWeight in that session (display only)
//   targetWeight  — today's suggested weight, or null for none
//   targetReps    — rep number to aim for, or null
//   action        — 'start' | 'calibrate' | 'deload' | 'increase' | 'hold' |
//                   'repeat-once' | 'decrease' | 'more-reps'
//   goalWeight    — block goal (base exercise only)
// Rules, against her last session of this name:
//   all sets at top of range, last set not "0 left" -> +increment, reps back to bottom
//   all sets at top, "0 left"                       -> repeat once (if the previous
//                                                      session was already that repeat, increase)
//   > half the sets below bottom in each of the last
//   2 sessions at the same weight                   -> -increment
//   otherwise                                       -> same weight, more reps
// Hold rule: < 3 completed sessions in 7 days -> no increases.
// Calibration: confidence 'low' with < 2 sessions logged -> no target.
// Deload week: target = last working weight, no suggestions.
export function getExerciseSuggestion(args) {
  const suggestion = getRawSuggestion(args)
  const changesWeight = suggestion.action === 'increase' || suggestion.action === 'decrease'
  return changesWeight ? { ...suggestion, prefillWeight: suggestion.targetWeight } : suggestion
}

function getRawSuggestion({ exercise, activeName, logs, weekMeta, recentCompletedCount }) {
  const isBase = activeName === exercise.name
  const range = parseRepRange(exercise.repRange)
  const { startWeight, goalWeight, increment, confidence, unit } = exercise.weight
  const sessions = groupProgressionSessions(logs, activeName)
  const last = sessions[0]
  const lastWeight = last?.workingWeight ?? null
  // Best reps at that working weight last time (for "Last time 35 lb × 10").
  const lastReps = lastWeight == null ? null : Math.max(...last.sets.filter((s) => Number(s.weight) === lastWeight).map((s) => s.reps))

  const base = {
    prefillWeight: lastWeight ?? (isBase ? startWeight : null),
    lastWeight,
    lastReps,
    goalWeight: isBase ? goalWeight : null,
    unit,
    repMin: range?.min ?? null,
    repMax: range?.max ?? null,
  }

  if (weekMeta.weekType === 'deload') return { ...base, action: 'deload', targetWeight: lastWeight, targetReps: null }
  if (confidence === 'low' && sessions.length < 2) return { ...base, action: 'calibrate', targetWeight: null, targetReps: null }
  if (!last || lastWeight == null || !range) {
    return { ...base, action: 'start', targetWeight: isBase ? startWeight : null, targetReps: range?.min ?? null }
  }

  const allAtTop = (s) => s.sets.every((set) => set.reps >= range.max)
  const missedBottom = (s) => s.sets.filter((set) => set.reps < range.min).length > s.sets.length / 2
  const holdIncreases = recentCompletedCount < HOLD_RULE.minSessions
  const increase = () =>
    holdIncreases
      ? { ...base, action: 'hold', targetWeight: lastWeight, targetReps: range.max }
      : { ...base, action: 'increase', targetWeight: roundWeight(lastWeight + increment), targetReps: range.min }

  if (allAtTop(last)) {
    if (Number(last.rpe) !== 10) return increase()
    const prev = sessions[1]
    const alreadyRepeated = prev && prev.workingWeight === lastWeight && allAtTop(prev) && Number(prev.rpe) === 10
    if (alreadyRepeated) return increase()
    return { ...base, action: 'repeat-once', targetWeight: lastWeight, targetReps: range.max }
  }

  const prev = sessions[1]
  if (prev && prev.workingWeight === lastWeight && missedBottom(last) && missedBottom(prev)) {
    return { ...base, action: 'decrease', targetWeight: roundWeight(Math.max(increment, lastWeight - increment)), targetReps: range.min }
  }

  const bestReps = Math.max(...last.sets.map((s) => s.reps))
  return { ...base, action: 'more-reps', targetWeight: lastWeight, targetReps: Math.min(range.max, Math.max(range.min, bestReps + 1)) }
}
