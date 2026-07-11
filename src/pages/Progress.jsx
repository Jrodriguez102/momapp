import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import { findExerciseById } from '../data/helpers'

export default function Progress() {
  const [logs, setLogs] = useState([])
  const [selectedExerciseId, setSelectedExerciseId] = useState(null)

  useEffect(() => {
    async function loadLogs() {
      try {
        const { data, error } = await supabase
          .from('exercise_logs')
          .select('*')
          .eq('is_cardio', false)
          .order('logged_at', { ascending: true })
        if (!error && data) setLogs(data)
      } catch {
        // Supabase not configured yet.
      }
    }
    loadLogs()
  }, [])

  // Distinct exercises actually logged — never hardcoded, so this stays
  // accurate even as program.js changes.
  const loggedExerciseIds = useMemo(
    () => [...new Set(logs.map((l) => l.exercise_id))],
    [logs]
  )

  useEffect(() => {
    if (!selectedExerciseId && loggedExerciseIds.length) {
      setSelectedExerciseId(loggedExerciseIds[0])
    }
  }, [loggedExerciseIds, selectedExerciseId])

  const chartData = useMemo(() => {
    return logs
      .filter((l) => l.exercise_id === selectedExerciseId)
      .map((l) => ({
        date: new Date(l.logged_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        weight: l.weight,
        reps: l.reps,
        rpe: l.rpe,
      }))
  }, [logs, selectedExerciseId])

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 space-y-6">
      <h1 className="font-display text-3xl text-base-100">Progress</h1>

      {loggedExerciseIds.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-center text-base-400 text-sm">
          No sessions logged yet — trends will show up here once workouts are completed.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {loggedExerciseIds.map((id) => {
              const ex = findExerciseById(id)
              return (
                <button
                  key={id}
                  onClick={() => setSelectedExerciseId(id)}
                  className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                    selectedExerciseId === id
                      ? 'accent-gradient text-base-950'
                      : 'bg-base-800 text-base-200 hover:bg-base-700'
                  }`}
                >
                  {ex?.name || id}
                </button>
              )
            })}
          </div>

          <div className="glass rounded-2xl p-4">
            <h3 className="font-display text-base text-base-100 mb-3">Weight over time</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-700)" />
                <XAxis dataKey="date" stroke="var(--color-base-400)" fontSize={11} />
                <YAxis stroke="var(--color-base-400)" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: 'var(--color-base-800)', border: 'none', borderRadius: 8 }}
                />
                <Line type="monotone" dataKey="weight" stroke="var(--color-accent-start)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="glass rounded-2xl p-4">
            <h3 className="font-display text-base text-base-100 mb-3">RPE over time</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-700)" />
                <XAxis dataKey="date" stroke="var(--color-base-400)" fontSize={11} />
                <YAxis domain={[0, 10]} stroke="var(--color-base-400)" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: 'var(--color-base-800)', border: 'none', borderRadius: 8 }}
                />
                <Line type="monotone" dataKey="rpe" stroke="var(--color-back)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
