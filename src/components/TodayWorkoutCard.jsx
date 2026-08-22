import { ArrowRight, Check, Dumbbell, Moon, Play } from 'lucide-react'
import { getDaySummary, findDayById } from '../data/helpers'

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// todayEntry/nextEntry are entries from getWeekSchedule(): { date, programDay, status }.
// inProgressSession, if present, is a workout_sessions row with status
// 'in_progress' — takes priority over todayEntry's own state, since it may
// belong to a different (abandoned) day than today.
export default function TodayWorkoutCard({ todayEntry, nextEntry, inProgressSession, onStart }) {
  if (inProgressSession) {
    const day = findDayById(inProgressSession.day_id)
    return (
      <div className="accent-gradient rounded-[28px] p-5 relative overflow-hidden shadow-[0_10px_28px_rgba(194,69,58,0.28)]">
        <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full border border-white/15" />
        <div className="absolute -right-2 -top-2 w-24 h-24 rounded-full border border-white/15" />

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
      </div>
    )
  }

  if (todayEntry.status === 'rest') {
    return (
      <div className="card rounded-[28px] p-5 flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-base-900 flex items-center justify-center shrink-0">
          <Moon size={18} className="text-base-400" />
        </span>
        <div>
          <h3 className="font-display font-extrabold text-lg text-base-100">Rest day</h3>
          <p className="text-xs text-base-400 mt-0.5">Recovery is part of the program.</p>
        </div>
      </div>
    )
  }

  if (todayEntry.status === 'completed') {
    return (
      <div className="card rounded-[28px] p-5">
        <div className="flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-full bg-[var(--color-back)]/12 flex items-center justify-center shrink-0">
            <Check size={18} className="text-[var(--color-back)]" />
          </span>
          <span className="font-display font-extrabold text-lg text-base-100">Today's workout complete</span>
        </div>
        {nextEntry?.programDay && (
          <button
            type="button"
            onClick={() => onStart(nextEntry.programDay.id)}
            className="mt-4 flex items-center justify-between w-full text-left group"
          >
            <div>
              <p className="text-xs text-base-400">
                Next up · {nextEntry.date.toLocaleDateString(undefined, { weekday: 'long' })}
              </p>
              <p className="text-sm font-semibold text-base-100 mt-0.5">{nextEntry.programDay.name}</p>
            </div>
            <ArrowRight size={16} className="text-base-400 group-hover:text-accent-start transition-colors" />
          </button>
        )}
      </div>
    )
  }

  const { exerciseCount, muscles, hasCardio } = getDaySummary(todayEntry.programDay)

  return (
    <div className="accent-gradient rounded-[28px] p-5 relative overflow-hidden shadow-[0_10px_28px_rgba(194,69,58,0.28)]">
      <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full border border-white/15" />
      <div className="absolute -right-2 -top-2 w-24 h-24 rounded-full border border-white/15" />

      <span className="relative w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
        <Dumbbell size={18} className="text-white" />
      </span>

      <p className="relative text-xs text-white/70 mt-3">Today's workout</p>
      <h2 className="relative font-display font-extrabold text-2xl text-white mt-0.5">{todayEntry.programDay.name}</h2>
      <p className="relative text-xs text-white/80 mt-1.5">
        {exerciseCount} exercises{hasCardio ? ' + cardio' : ''} · {muscles.map(capitalize).join(', ')}
      </p>
      <button
        type="button"
        onClick={() => onStart(todayEntry.programDay.id)}
        className="relative mt-4 w-full bg-white text-accent-end font-bold rounded-full py-3 flex items-center justify-center gap-2"
      >
        Start workout <ArrowRight size={16} />
      </button>
    </div>
  )
}
