import { Check } from 'lucide-react'

// Status -> chip treatment. Display only: the queue (not the weekday)
// decides what's next, so chips aren't tappable. 'completed' is any day
// with a completed session (planned weekday or not); 'missed' is a soft
// tint of the same red used for high-volume warnings, kept gentle.
const CHIP_STYLES = {
  completed: 'bg-[var(--color-back)] text-white',
  planned: 'bg-base-900 text-base-400',
  missed: 'bg-[var(--color-glute)]/10 text-[var(--color-glute)]',
  rest: 'bg-transparent text-base-400/30',
}

function chipLabel(day) {
  if (day.status === 'completed') return <Check size={12} />
  if (day.status === 'planned') return day.isToday ? 'Today' : 'Train'
  if (day.status === 'missed') return 'Missed'
  return '–'
}

// days: getTrainingWeek().days, 7 entries Mon-Sun.
export default function WeekStrip({ days }) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((day) => {
        const isTodayPlanned = day.isToday && day.status === 'planned'
        return (
          <div key={day.date.toDateString()} className="flex flex-col items-center gap-1">
            <span className={`text-[10px] font-medium ${day.isToday ? 'text-base-100' : 'text-base-400'}`}>
              {day.date.toLocaleDateString(undefined, { weekday: 'narrow' })}
            </span>
            <span
              className={`w-full rounded-xl py-2 text-[10px] font-bold flex items-center justify-center ${
                isTodayPlanned ? 'accent-gradient text-white' : CHIP_STYLES[day.status]
              } ${day.isToday && !isTodayPlanned ? 'ring-1 ring-base-400/40' : ''}`}
            >
              {chipLabel(day)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
