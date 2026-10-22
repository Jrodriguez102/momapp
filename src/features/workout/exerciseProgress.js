import { applyDeloadToSets } from '@/data/program'

// Per-exercise progress for the workout screen (pure, display only).

export function prescribedSetsFor(exercise, weekMeta) {
  return applyDeloadToSets(exercise.sets, weekMeta.weekInBlock)
}

// Every prescribed set (1..prescribed) is logged. extraSetNumber counts a
// set that was just saved but isn't in `logsBySet` yet.
export function isExerciseComplete(prescribedSets, logsBySet = {}, extraSetNumber = null) {
  for (let n = 1; n <= prescribedSets; n++) {
    if (!logsBySet[n] && n !== extraSetNumber) return false
  }
  return true
}

// The first exercise (in program order) that still has prescribed sets to
// log — starting after `afterId` and wrapping around, skipping `afterId`.
export function nextIncompleteExercise(exercises, isComplete, afterId = null) {
  const start = afterId ? exercises.findIndex((ex) => ex.id === afterId) + 1 : 0
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[(start + i) % exercises.length]
    if (ex.id !== afterId && !isComplete(ex)) return ex
  }
  return null
}

// The set number to fill next: the first unlogged set after `afterSetNumber`,
// else the first unlogged one at all; null when every row is logged.
export function nextOpenSetNumber(rowCount, logsBySet, afterSetNumber = 0, extraSetNumber = null) {
  const open = (n) => !logsBySet[n] && n !== extraSetNumber
  for (let n = afterSetNumber + 1; n <= rowCount; n++) if (open(n)) return n
  for (let n = 1; n <= afterSetNumber; n++) if (open(n)) return n
  return null
}

// "8-10" -> "8–10 reps"; "12-15 / leg" -> "12–15 reps / leg".
export function formatRepRange(repRange) {
  const [range, per] = repRange.split('/').map((s) => s.trim())
  const reps = `${range.replace('-', '–')} reps`
  return per ? `${reps} / ${per}` : reps
}

// Typed-but-unsaved numbers for a slot (prefilled weights don't count).
export function hasUnsavedEntries(entries = []) {
  return entries.some((e) => e && ((e.weight !== undefined && e.weight !== '') || (e.reps !== undefined && e.reps !== '')))
}
