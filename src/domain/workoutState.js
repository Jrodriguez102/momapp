import { MIN_SETS_FOR_COMPLETED, rpeToDifficulty } from './sessionRules'

// Pure pieces of the live workout's state (used by useWorkoutSession).
// logs shape everywhere: { [exerciseId]: { [setNumber]: exercise_logs row } }

// Rebuilds per-slot state from a session's saved rows: logs by set number,
// the last-set difficulty (from whichever row carries rpe), and the active
// swap per slot (the alternative whose name was logged, or null when the
// base exercise was logged).
export function restoreFromSessionLogs(day, rows) {
  const logs = {}
  const difficulties = {}
  const swaps = {}
  for (const row of rows) {
    logs[row.exercise_id] = { ...logs[row.exercise_id], [row.set_number]: row }
    if (row.rpe != null) difficulties[row.exercise_id] = rpeToDifficulty(row.rpe)
  }
  for (const ex of day.exercises) {
    const loggedName = Object.values(logs[ex.id] || {})[0]?.exercise_name
    if (!loggedName) continue
    const alt = ex.alternatives.find((a) => a.name === loggedName)
    swaps[ex.id] = alt || null
  }
  return { logs, difficulties, swaps }
}

// What was logged wins over the draft's swap choice: a slot logged as an
// alternative uses it, a slot logged as the base exercise drops any draft
// swap, untouched slots keep the draft's choice.
export function applyRestoredSwaps(draftSwaps, restoredSwaps) {
  const next = { ...draftSwaps }
  for (const [exId, alt] of Object.entries(restoredSwaps)) {
    if (alt) next[exId] = alt
    else delete next[exId]
  }
  return next
}

// Mirrors syncExerciseRpe for the screen's copy of one slot's rows: the
// highest-numbered set carries `rpe`, every other set carries null. Keeps
// the local rows' rpe equal to the DB, which removeLiveSet relies on to
// move the tap when the set holding it is removed.
export function withRpeOnTopSet(logsBySet, rpe) {
  const setNumbers = Object.keys(logsBySet ?? {}).map(Number)
  if (!setNumbers.length) return logsBySet ?? {}
  const top = Math.max(...setNumbers)
  return Object.fromEntries(setNumbers.map((n) => [n, { ...logsBySet[n], rpe: n === top ? rpe : null }]))
}

export function allLoggedRows(logs) {
  return Object.values(logs).flatMap((bySet) => Object.values(bySet))
}

// Starting weight for each set row: the previous logged set's weight in
// this session if there is one, else the suggestion's prefill.
// logsBySet: { [setNumber]: row } for one slot.
export function prefillWeights({ logsBySet, prefillWeight, rowCount }) {
  let carry = prefillWeight ?? ''
  return Array.from({ length: rowCount }, (_, i) => {
    const value = carry
    if (logsBySet[i + 1]?.weight != null) carry = logsBySet[i + 1].weight
    return value
  })
}

// Rows to show for a slot: the prescribed sets, or more if extra were logged.
export function getRowCount(prescribedSets, logsBySet) {
  return Math.max(prescribedSets, ...Object.keys(logsBySet).map(Number), 0)
}

// The Finish tap: nothing to finish without a saved set; under the minimum,
// ask "count this as a workout?"; otherwise finish as completed.
// Returns 'blocked' | 'confirm' | 'finish'.
export function getFinishAction(loggedCount, hasSession) {
  if (loggedCount === 0 || !hasSession) return 'blocked'
  return loggedCount < MIN_SETS_FOR_COMPLETED ? 'confirm' : 'finish'
}
