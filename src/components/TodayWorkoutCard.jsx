import { useState } from 'react'
import { ArrowRight, Check, Dumbbell, Play } from 'lucide-react'
import { getDaySummary, findDayById } from '../data/helpers'
import { PROGRAM_DAYS, SESSIONS_PER_BLOCK } from '../data/program'

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function GradientCard({ children }) {
  return (
    <div className="accent-gradient rounded-[28px] p-5 relative overflow-hidden shadow-[0_10px_28px_rgba(194,69,58,0.28)]">
      <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full border border-white/15" />
      <div className="absolute -right-2 -top-2 w-24 h-24 rounded-full border border-white/15" />
      {children}
    </div>
  )
}

// blockState: getBlockState() — nextDay is always the next day in the queue.
// inProgressSession, if present, is a workout_sessions row with status
// 'in_progress' and takes priority (only one workout at a time).
// trainedToday: a session was already completed today, so the card reads
// "Next up" rather than "Today's workout".
export default function TodayWorkoutCard({ blockState, inProgressSession, trainedToday, onStart }) {
  const [choosing, setChoosing] = useState(false)

  if (inProgressSession) {
    const day = findDayById(inProgressSession.day_id)
    return (
      <GradientCard>
        <span className="relative w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
          <Play size={16} className="text-white" fill="currentColor" />
        </span>
        <p className="relative text-xs text-white/70 mt-3">Workout in progress</p>
        <h2 className="relative font-display font-extrabold text-2xl text-white mt-0.5">{day?.name ?? 'Workout'}</h2>
        <button
          type="button"
          onClick={() => onStart(inProgressSession.day_id)}
          className="relative mt-4 w-full bg-white text-accent-end font-bold rounded-full py-3 flex items-center justify-center gap-2"
        >
          Continue workout <ArrowRight size={16} />
        </button>
      </GradientCard>
    )
  }

  if (blockState.isBlockComplete) {
    return (
      <div className="card rounded-[28px] p-5">
        <div className="flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-full bg-[var(--color-back)]/12 flex items-center justify-center shrink-0">
            <Check size={18} className="text-[var(--color-back)]" />
          </span>
          <span className="font-display font-extrabold text-lg text-base-100">Block 01 complete</span>
        </div>
        <p className="text-xs text-base-400 mt-3">
          All {SESSIONS_PER_BLOCK} sessions are done. The next block will be built from this data.
        </p>
      </div>
    )
  }

  const { nextDay } = blockState
  const { exerciseCount, muscles } = getDaySummary(nextDay)

  return (
    <div className="space-y-2">
      <GradientCard>
        <span className="relative w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
          <Dumbbell size={18} className="text-white" />
        </span>
        <p className="relative text-xs text-white/70 mt-3">{trainedToday ? 'Next up' : "Today's workout"}</p>
        <h2 className="relative font-display font-extrabold text-2xl text-white mt-0.5">{nextDay.name}</h2>
        <p className="relative text-xs text-white/80 mt-1.5">
          {exerciseCount} exercises · {muscles.map(capitalize).join(', ')}
        </p>
        <button
          type="button"
          onClick={() => onStart(nextDay.id)}
          className="relative mt-4 w-full bg-white text-accent-end font-bold rounded-full py-3 flex items-center justify-center gap-2"
        >
          Start workout <ArrowRight size={16} />
        </button>
      </GradientCard>

      <button
        type="button"
        onClick={() => setChoosing((c) => !c)}
        className="w-full text-xs font-medium text-base-400 hover:text-accent-end py-1"
      >
        {choosing ? 'Cancel' : 'Choose a different day'}
      </button>

      {choosing && (
        <div className="card rounded-[24px] p-2">
          {PROGRAM_DAYS.map((day) => (
            <button
              key={day.id}
              type="button"
              onClick={() => onStart(day.id)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left hover:bg-base-900"
            >
              <span className="text-sm text-base-100 font-medium">
                {day.name}
                {day.id === nextDay.id && <span className="text-[11px] text-accent-end ml-1.5">next in queue</span>}
              </span>
              <ArrowRight size={14} className="text-base-400 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
