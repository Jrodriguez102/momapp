import { useEffect, useState } from 'react'
import { getCurrentBlockAndWeek, getCompletedSessionCount, getPlannedWeeklyVolume } from '../data/helpers'
import BodyDiagram from '../components/BodyDiagram'

export default function VolumeTracker() {
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
      <h1 className="font-display text-3xl text-base-100">Volume Tracker</h1>
      <BodyDiagram volumeByGroup={volumeByGroup} />
    </div>
  )
}
