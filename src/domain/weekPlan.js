import { SESSIONS_PER_BLOCK } from '../data/program'
import { getNextQueueDay } from './block'
import { findDayById } from './metrics'

// "Upper A (Chest / Back)" -> "Chest / Back"; null if the name has no focus.
export function getDayFocus(programDay) {
  return /\(([^)]+)\)/.exec(programDay?.name ?? '')?.[1] ?? null
}

// The first `count` exercise names of a day plus how many more there are.
export function getExercisePreview(programDay, count) {
  const names = programDay.exercises.map((ex) => ex.name)
  return { names: names.slice(0, count), more: Math.max(0, names.length - count) }
}

// ---- Home week card ---------------------------------------------------------
// One row per planned training day this Mon-Sun week (display only — the
// queue, not the weekday, decides what's next; nothing here is written):
//   completed — a completed session that day, showing the workout she
//               actually did. Any weekday counts, planned or not, and two
//               workouts on one day are two rows.
//   today     — today's planned day (or an in-progress workout on any day),
//               showing the in-progress workout or the next queue day.
//   upcoming  — later planned days, filled with the following queue days.
//   missed    — past planned days with nothing completed. No workout shown:
//               the queue waits, nothing is skipped.
// Projection never goes past the end of the block (no rows once it's done).
// trainingWeek: buildTrainingWeek(); blockState: buildBlockState();
// inProgressDayId: day_id of the open workout_sessions row, if any.
// Row: { kind, date, programDay, inProgress }
export function buildWeekRows({ trainingWeek, blockState, inProgressDayId = null }) {
  const rows = []
  let remaining = blockState.isBlockComplete ? 0 : SESSIONS_PER_BLOCK - blockState.completedSessionCount
  // The workout that finishes next decides what follows it in the queue.
  let nextDay = (inProgressDayId && findDayById(inProgressDayId)) || blockState.nextDay
  let inProgressPlaced = false

  function placeNext(day, kind) {
    if (remaining <= 0 || !nextDay) return
    const inProgress = kind === 'today' && !!inProgressDayId && !inProgressPlaced
    rows.push({ kind, date: day.date, programDay: nextDay, inProgress })
    if (inProgress) inProgressPlaced = true
    remaining -= 1
    nextDay = getNextQueueDay(nextDay.id)
  }

  for (const day of trainingWeek.days) {
    for (const dayId of day.completedDayIds) {
      rows.push({ kind: 'completed', date: day.date, programDay: findDayById(dayId), inProgress: false })
    }
    const inProgressToday = day.isToday && !!inProgressDayId
    if (day.completedDayIds.length && !inProgressToday) continue
    if (inProgressToday) placeNext(day, 'today')
    else if (!day.isPlanned) continue
    else if (day.status === 'missed') rows.push({ kind: 'missed', date: day.date, programDay: null, inProgress: false })
    else placeNext(day, day.isToday ? 'today' : 'upcoming')
  }
  return rows
}
