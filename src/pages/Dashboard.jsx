import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame } from 'lucide-react'
import { USER_NAME } from '../data/program'
import {
  getCurrentBlockAndWeek,
  getCompletedSessionCount,
  getGreeting,
  getWeekSchedule,
  getNextScheduledDay,
  getWorkoutsThisMonth,
  getCurrentStreak,
  getAnyInProgressSession,
} from '../data/helpers'
import { getDailyQuote } from '../data/quotes'
import TodayWorkoutCard from '../components/TodayWorkoutCard'
import StatTile from '../components/StatTile'
import WeekStrip from '../components/WeekStrip'

export default function Dashboard() {
  const navigate = useNavigate()
  const [weekMeta, setWeekMeta] = useState(null)
  const [schedule, setSchedule] = useState(null)
  const [monthCount, setMonthCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [inProgressSession, setInProgressSession] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [sessionCount, sched, monthTotal, streakTotal, inProgress] = await Promise.all([
        getCompletedSessionCount(),
        getWeekSchedule(),
        getWorkoutsThisMonth(),
        getCurrentStreak(),
        getAnyInProgressSession(),
      ])
      if (cancelled) return
      setWeekMeta(getCurrentBlockAndWeek(sessionCount))
      setSchedule(sched)
      setMonthCount(monthTotal)
      setStreak(streakTotal)
      setInProgressSession(inProgress)
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (!weekMeta || !schedule) return null

  const today = new Date()
  const todayEntry = schedule.find((entry) => entry.date.toDateString() === today.toDateString())
  const nextEntry = getNextScheduledDay(schedule, today)
  const scheduledCount = schedule.filter((entry) => entry.programDay).length
  const completedThisWeek = schedule.filter((entry) => entry.status === 'completed').length

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-4 space-y-5">
      <div>
        <h1 className="font-display font-black text-4xl leading-[1.05] text-base-100">
          {getGreeting()}, {USER_NAME}
        </h1>
        <p className="text-xs text-base-400 mt-2">
          {today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <p className="text-xs text-base-400 italic mt-1">{getDailyQuote()}</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-base-400 card rounded-full px-3 py-1.5">
          Block {weekMeta.block} · {weekMeta.label}
        </span>
        {weekMeta.weekType === 'deload' && (
          <span className="flex items-center gap-1 text-xs font-medium text-accent-end card rounded-full px-3 py-1.5">
            <Flame size={12} /> Deload week
          </span>
        )}
      </div>

      <TodayWorkoutCard
        todayEntry={todayEntry}
        nextEntry={nextEntry}
        inProgressSession={inProgressSession}
        onStart={(dayId) => navigate(`/session/${dayId}`)}
      />

      <div className="grid grid-cols-3 gap-2">
        <StatTile value={monthCount} label="Workouts this month" dotColor="var(--color-base-400)" />
        <StatTile
          value={streak}
          unit={streak === 1 ? 'workout' : 'workouts'}
          label="Current streak"
          dotColor="var(--color-back)"
        />
        <StatTile
          value={`${completedThisWeek}/${scheduledCount}`}
          label="Training days this week"
          dotColor="var(--color-accent-start)"
        />
      </div>

      <div>
        <p className="text-xs font-medium text-base-400 mb-2">This week</p>
        <WeekStrip schedule={schedule} onSelectDay={(dayId) => navigate(`/session/${dayId}`)} />
      </div>
    </div>
  )
}
