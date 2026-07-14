import { useEffect, useState } from 'react'
import { getCurrentBlockAndWeek, getCompletedSessionCount } from '../data/helpers'

const SESSIONS_PER_BLOCK = 20 // 5/week x 4 weeks, matches deload cadence

export default function History() {
  const [weekMeta, setWeekMeta] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const count = await getCompletedSessionCount()
      if (!cancelled) setWeekMeta(getCurrentBlockAndWeek(count))
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (!weekMeta) return null

  const completedInBlock = weekMeta.completedSessionCount - (weekMeta.block - 1) * SESSIONS_PER_BLOCK

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 space-y-6">
      <h1 className="font-display text-3xl text-base-100">History</h1>

      <div className="glass rounded-2xl p-5">
        <p className="text-base-400 text-sm">Block {weekMeta.block}</p>
        <p className="font-display text-2xl text-base-100 mt-1">
          {completedInBlock} / {SESSIONS_PER_BLOCK} workouts
        </p>
      </div>

      <p className="text-sm text-base-400">
        Past block history is coming in the next pass — this will scroll back through completed blocks once it's built.
      </p>
    </div>
  )
}
