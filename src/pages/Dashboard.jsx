import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Flame } from 'lucide-react'
import { PROGRAM_DAYS } from '../data/program'
import { getCurrentBlockAndWeek, getCompletedSessionCount, getPlannedWeeklyVolume } from '../data/helpers'
import BodyDiagram from '../components/BodyDiagram'

export default function Dashboard() {
  const navigate = useNavigate()
  const [weekMeta, setWeekMeta] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function loadWeek() {
      const count = await getCompletedSessionCount()
      if (!cancelled) setWeekMeta(getCurrentBlockAndWeek(count))
    }
    loadWeek()
    return () => { cancelled = true }
  }, [])

  if (!weekMeta) return null

  const volumeByGroup = getPlannedWeeklyVolume(weekMeta.weekInBlock)

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 space-y-6">
      <div>
        <p className="text-base-400 text-sm">Block {weekMeta.block}</p>
        <h1 className="font-display text-3xl text-base-100">{weekMeta.label}</h1>
        <p className="text-sm text-base-400 mt-1">{weekMeta.note}</p>
        {weekMeta.weekType === 'deload' && (
          <div className="mt-3 flex items-center gap-2 text-xs text-accent-start glass rounded-xl px-3 py-2 w-fit">
            <Flame size={14} />
            Deload week — sets and intensity are automatically reduced.
          </div>
        )}
      </div>

      <div className="space-y-3">
        {PROGRAM_DAYS.map((day) => (
          <button
            key={day.id}
            onClick={() => navigate(`/session/${day.id}`)}
            className="w-full glass rounded-2xl p-4 flex items-center justify-between text-left hover:border-accent-start/40 transition-colors"
          >
            <div>
              <h3 className="font-display text-lg text-base-100">{day.name}</h3>
              <p className="text-xs text-base-400 mt-0.5">
                {day.exercises.filter((e) => !e.isCardio).length} lifts
                {day.hasCardio ? (day.cardioOptional ? ' · optional cardio' : ' · + cardio') : ''}
              </p>
            </div>
            <ChevronRight size={18} className="text-base-400" />
          </button>
        ))}
      </div>

      <BodyDiagram volumeByGroup={volumeByGroup} />
    </div>
  )
}
