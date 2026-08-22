import { Check } from 'lucide-react'

// Status -> chip treatment. 'completed' and 'today' reuse existing app
// tokens (volume-status green, accent gradient) rather than new hues;
// 'missed' is a soft tint of the same red used for high-volume warnings
// elsewhere, kept gentle rather than alarming.
const CHIP_STYLES = {
  completed: 'bg-[var(--color-back)] text-white',
  today: 'accent-gradient text-white',
  upcoming: 'bg-base-900 text-base-400',
  missed: 'bg-[var(--color-glute)]/10 text-[var(--color-glute)]',
  rest: 'bg-transparent text-base-400/30',
}

// schedule: getWeekSchedule() output, 7 entries Mon-Sun.
export default function WeekStrip({ schedule, onSelectDay }) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {schedule.map((entry) => {
        const clickable = !!entry.programDay
        const weekdayLabel = entry.date.toLocaleDateString(undefined, { weekday: 'narrow' })

        return (
          <button
            key={entry.date.toDateString()}
            type="button"
            disabled={!clickable}
            onClick={() => clickable && onSelectDay(entry.programDay.id)}
            className="flex flex-col items-center gap-1 disabled:cursor-default"
          >
            <span className="text-[10px] text-base-400 font-medium">{weekdayLabel}</span>
            <span
              className={`w-full rounded-xl py-2 text-[10px] font-bold flex items-center justify-center transition-opacity ${CHIP_STYLES[entry.status]} ${clickable ? 'hover:opacity-80' : ''}`}
            >
              {entry.status === 'completed' ? <Check size={12} /> : entry.programDay?.shortLabel ?? '–'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
