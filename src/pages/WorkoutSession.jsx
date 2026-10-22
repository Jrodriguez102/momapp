import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Clock } from 'lucide-react'
import { findDayById, formatDuration } from '../data/helpers'
import { applyDeloadToSets, SESSIONS_PER_BLOCK } from '../data/program'
import { getRowCount } from '@/domain/workoutState'
import { useWorkoutSession } from '@/features/workout/useWorkoutSession'
import ExerciseCard from '../components/ExerciseCard'
import EffortTap from '../components/EffortTap'
import StatTile from '../components/StatTile'

function Screen({ children }) {
  return <div className="max-w-2xl mx-auto px-4 pt-10 pb-10 space-y-5 text-center">{children}</div>
}

export default function WorkoutSession() {
  const { dayId } = useParams()
  const navigate = useNavigate()
  const {
    day,
    ready,
    weekMeta,
    otherSession,
    session,
    logs,
    entries,
    swaps,
    difficulties,
    savingSets,
    sessionRpe,
    suggestions,
    result,
    finishing,
    confirmingFinish,
    elapsedSeconds,
    loggedCount,
    locked,
    prefillWeightsFor,
    changeEntry,
    logSet,
    removeSet,
    setDifficulty,
    swapExercise,
    setSessionRpe,
    requestFinish,
    finish,
    cancelFinish,
  } = useWorkoutSession(dayId)

  if (!day) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-8">
        <p className="text-base-400">Day not found.</p>
      </div>
    )
  }

  if (!ready) return null

  if (result?.kind === 'finished') {
    const isPartial = result.status === 'partial'
    return (
      <Screen>
        <span className="mx-auto w-16 h-16 rounded-full bg-[var(--color-back)]/12 flex items-center justify-center">
          <Check size={28} className="text-[var(--color-back)]" />
        </span>
        <div>
          <h1 className="font-display font-black text-3xl text-base-100">{isPartial ? 'Saved as Partial' : 'Workout Complete'}</h1>
          <p className="text-sm text-base-400 mt-1">{day.name}</p>
          {isPartial && (
            <p className="text-xs text-base-400 mt-2">
              Your sets are saved, but this won't count toward the block — {day.shortLabel} stays next.
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 text-left">
          <StatTile value={formatDuration(result.durationSeconds)} label="Duration" />
          <StatTile value={result.setsCompleted} label="Sets completed" />
          <StatTile value={result.totalVolume.toLocaleString()} unit="lb" label="Total volume" />
        </div>
        <button onClick={() => navigate('/')} className="w-full accent-gradient text-white font-bold rounded-full py-3.5">
          Back to Home
        </button>
      </Screen>
    )
  }

  if (result?.kind === 'auto-closed') {
    return (
      <Screen>
        <span className="mx-auto w-16 h-16 rounded-full bg-base-900 flex items-center justify-center">
          <Clock size={28} className="text-base-400" />
        </span>
        <div>
          <h1 className="font-display font-black text-3xl text-base-100">Workout Closed</h1>
          <p className="text-sm text-base-400 mt-2">
            This workout was closed automatically after a long break. Every set you logged is saved in History.
          </p>
        </div>
        <button onClick={() => navigate('/')} className="w-full accent-gradient text-white font-bold rounded-full py-3.5">
          Back to Home
        </button>
      </Screen>
    )
  }

  if (otherSession) {
    const otherDay = findDayById(otherSession.day_id)
    return (
      <Screen>
        <div>
          <h1 className="font-display font-black text-2xl text-base-100">Another workout is in progress</h1>
          <p className="text-sm text-base-400 mt-2">
            Finish {otherDay?.name ?? 'that workout'} before starting {day.name}.
          </p>
        </div>
        <button
          onClick={() => navigate(`/session/${otherSession.day_id}`)}
          className="w-full accent-gradient text-white font-bold rounded-full py-3.5 flex items-center justify-center gap-2"
        >
          Continue {otherDay?.shortLabel ?? 'workout'} <ArrowRight size={16} />
        </button>
      </Screen>
    )
  }

  if (weekMeta.isBlockComplete && !session) {
    return (
      <Screen>
        <span className="mx-auto w-16 h-16 rounded-full bg-[var(--color-back)]/12 flex items-center justify-center">
          <Check size={28} className="text-[var(--color-back)]" />
        </span>
        <div>
          <h1 className="font-display font-black text-3xl text-base-100">Block 01 complete</h1>
          <p className="text-sm text-base-400 mt-2">All {SESSIONS_PER_BLOCK} sessions are done. The next block will be built from this data.</p>
        </div>
        <button onClick={() => navigate('/')} className="w-full accent-gradient text-white font-bold rounded-full py-3.5">
          Back to Home
        </button>
      </Screen>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-10 space-y-4">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1 text-sm text-base-400 hover:text-base-100 transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base-400 text-sm">{weekMeta.label} · Session {weekMeta.sessionNumber} of {SESSIONS_PER_BLOCK}</p>
          <h1 className="font-display font-black text-2xl text-base-100">{day.name}</h1>
          {weekMeta.note && <p className="text-xs text-base-400 mt-1">{weekMeta.note}</p>}
        </div>
        {session && (
          <span className="card rounded-full px-3 py-1.5 text-xs font-semibold text-base-400 shrink-0">
            {formatDuration(elapsedSeconds)}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {day.exercises.map((ex) => {
          const prescribedSets = applyDeloadToSets(ex.sets, weekMeta.weekInBlock)
          const exLogs = logs[ex.id] || {}
          const rowCount = getRowCount(prescribedSets, exLogs)
          return (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              prescribedSets={prescribedSets}
              suggestion={suggestions[ex.id]}
              activeAlt={swaps[ex.id] || null}
              onSwap={(alt) => swapExercise(ex, alt)}
              entries={entries[ex.id] || []}
              logs={exLogs}
              prefillWeights={prefillWeightsFor(ex, rowCount)}
              onEntryChange={(index, field, value) => changeEntry(ex.id, index, field, value)}
              onSaveSet={(index, values) => logSet(ex, index, values)}
              onRemoveSet={(row) => removeSet(ex, row)}
              savingSets={savingSets[ex.id] || {}}
              difficulty={difficulties[ex.id] ?? null}
              onDifficulty={(value) => setDifficulty(ex, value)}
              locked={locked}
            />
          )
        })}
      </div>

      <div className="card rounded-[28px] p-4">
        <EffortTap value={sessionRpe} onChange={setSessionRpe} disabled={locked} />
      </div>

      {confirmingFinish ? (
        <div className="card rounded-[28px] p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-base-100">
              Only {loggedCount} {loggedCount === 1 ? 'set' : 'sets'} logged — count this as a workout?
            </p>
            <p className="text-xs text-base-400 mt-1">
              If not, it's saved as partial: your sets are kept, but it won't count toward the block and {day.shortLabel} stays next.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={finishing}
              onClick={() => finish(true)}
              className="accent-gradient text-white font-semibold text-sm rounded-full py-3 disabled:opacity-60"
            >
              Yes, count it
            </button>
            <button
              type="button"
              disabled={finishing}
              onClick={() => finish(false)}
              className="bg-base-900 text-base-200 font-semibold text-sm rounded-full py-3 disabled:opacity-60"
            >
              No, save as partial
            </button>
          </div>
          <button
            type="button"
            disabled={finishing}
            onClick={cancelFinish}
            className="w-full text-xs text-base-400 py-1"
          >
            Keep going
          </button>
        </div>
      ) : (
        <button
          onClick={requestFinish}
          disabled={loggedCount === 0 || finishing}
          className="w-full accent-gradient text-white font-bold rounded-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {finishing ? 'Saving...' : loggedCount === 0 ? 'Finish (log a set first)' : 'Finish Workout'}
        </button>
      )}
    </div>
  )
}
