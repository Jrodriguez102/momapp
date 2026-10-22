// ============================================================================
// COMPATIBILITY BARREL
// The logic that used to live here is split into:
//   src/domain/*   — pure rules (block math, progression, session rules,
//                    calendar, metrics, formatting). No React, no Supabase.
//   src/services/* — the only Supabase access. Reads THROW on error.
// This file re-exports everything under its original names so existing
// screens keep working unchanged. Its Supabase reads keep their original
// "never reject" behavior via withFallback (0 / [] / null / a fresh-block
// state when Supabase is unreachable). New code should import from
// domain/ and services/ directly and handle errors (see useAsyncData).
// ============================================================================
import { buildBlockState } from '../domain/block'
import { buildTrainingWeek } from '../domain/calendar'
import * as sessionsApi from '../services/sessionsApi'
import * as setsApi from '../services/setsApi'
import * as bodyWeightApi from '../services/bodyWeightApi'

export * from '../domain/block'
export * from '../domain/sessionRules'
export * from '../domain/progression'
export * from '../domain/metrics'
export * from '../domain/format'
export { filterByTimeframe } from '../domain/calendar'
export { SESSIONS_AUTO_CLOSED_EVENT, runAutoClose, afterAutoClose } from '../services/autoClose'
export { createSession, finishSession, updateSessionRpe } from '../services/sessionsApi'
export {
  saveSet,
  syncExerciseRpe,
  renameExerciseInSession,
  removeLiveSet,
  removeHistorySet,
} from '../services/setsApi'
export { logBodyWeight } from '../services/bodyWeightApi'

// Wraps a throwing read so it resolves to `fallback` (a value, or a function
// of the same arguments) instead of rejecting.
function withFallback(read, fallback) {
  return async (...args) => {
    try {
      return await read(...args)
    } catch {
      return typeof fallback === 'function' ? fallback(...args) : fallback
    }
  }
}

export const getCompletedSessionCount = withFallback(sessionsApi.fetchCompletedSessionCount, 0)
export const getBlockState = withFallback(sessionsApi.fetchBlockState, () => buildBlockState([]))
export const getRecentCompletedSessionCount = withFallback(sessionsApi.fetchRecentCompletedSessionCount, 0)
export const getTrainingWeek = withFallback(sessionsApi.fetchTrainingWeek, (referenceDate = new Date()) =>
  buildTrainingWeek([], referenceDate),
)
export const getWeeklyStreak = withFallback(sessionsApi.fetchWeeklyStreak, 0)
export const getWorkoutsThisMonth = withFallback(sessionsApi.fetchWorkoutsThisMonth, 0)
export const getFinishedSessions = withFallback(sessionsApi.fetchFinishedSessions, [])
export const findInProgressSession = withFallback(sessionsApi.fetchInProgressSession, null)
export const getAnyInProgressSession = withFallback(sessionsApi.fetchAnyInProgressSession, null)

export const getProgressionLogs = withFallback(setsApi.fetchProgressionLogs, [])
export const getSessionExerciseLogs = withFallback(setsApi.fetchSessionExerciseLogs, [])
export const getExerciseLogsForSessions = withFallback(setsApi.fetchExerciseLogsForSessions, [])
export const getAllStrengthLogs = withFallback(setsApi.fetchAllStrengthLogs, [])

// Don't nag about a weigh-in on a failed read.
export const needsWeighIn = withFallback(bodyWeightApi.fetchWeighInDue, false)
export const getBodyWeightLogs = withFallback(bodyWeightApi.fetchBodyWeightLogs, [])
