import { Check, Clock } from 'lucide-react'
import { SESSIONS_PER_BLOCK } from '@/data/program'
import { formatDuration } from '@/domain/format'
import StatTile from '@/components/StatTile'

// TEMPORARY: the pre-redesign result screens, moved here unchanged from
// pages/WorkoutSession.jsx. Replaced by the Workout complete step (finished,
// closed, block complete) — don't build on these.

function Screen({ children }) {
  return <div className="max-w-2xl mx-auto px-4 pt-10 pb-10 space-y-5 text-center">{children}</div>
}

export function LegacyFinishedScreen({ day, result, onHome }) {
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
      <button onClick={onHome} className="w-full accent-gradient text-white font-bold rounded-full py-3.5">
        Back to Home
      </button>
    </Screen>
  )
}

export function LegacyAutoClosedScreen({ onHome }) {
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
      <button onClick={onHome} className="w-full accent-gradient text-white font-bold rounded-full py-3.5">
        Back to Home
      </button>
    </Screen>
  )
}

export function LegacyBlockCompleteScreen({ onHome }) {
  return (
    <Screen>
      <span className="mx-auto w-16 h-16 rounded-full bg-[var(--color-back)]/12 flex items-center justify-center">
        <Check size={28} className="text-[var(--color-back)]" />
      </span>
      <div>
        <h1 className="font-display font-black text-3xl text-base-100">Block 01 complete</h1>
        <p className="text-sm text-base-400 mt-2">All {SESSIONS_PER_BLOCK} sessions are done. The next block will be built from this data.</p>
      </div>
      <button onClick={onHome} className="w-full accent-gradient text-white font-bold rounded-full py-3.5">
        Back to Home
      </button>
    </Screen>
  )
}
