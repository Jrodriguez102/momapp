import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import ExerciseSelect from './ExerciseSelect'
import TrendLineChart from './TrendLineChart'
import { groupLogsBySession, getTopSet, estimate1RM, getSetsVolume } from '../data/helpers'

function formatDateLabel(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Custom point: a click target plus a "weight×reps" label riding the mark,
// since reps (not just weight) is the story of this chart — rep ranges
// change intentionally week to week, so the number needs to travel with
// the point, not live in a legend.
function ExerciseDot(props) {
  const { cx, cy, payload, isSelected, onSelect } = props
  if (cx == null || cy == null) return null
  const color = isSelected ? 'var(--color-accent-end)' : 'var(--color-accent-start)'
  return (
    <g onClick={() => onSelect(payload.sessionId)} style={{ cursor: 'pointer' }}>
      <circle cx={cx} cy={cy} r={14} fill="transparent" />
      <circle cx={cx} cy={cy} r={isSelected ? 6 : 5} fill={color} stroke="var(--color-base-800)" strokeWidth={2} />
      <text x={cx} y={cy - 14} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--color-base-100)">
        {payload.weight}×{payload.reps}
      </text>
    </g>
  )
}

// exercises: [{ id, name }] of everything logged so far. exerciseLogs: raw
// exercise_logs rows (all exercises) — filtered down to the selected one
// internally so the panel stays self-contained.
export default function ExerciseProgressPanel({ exercises, exerciseLogs, selectedExerciseId, onSelectExercise }) {
  const sessions = useMemo(() => {
    return groupLogsBySession(exerciseLogs, selectedExerciseId).map((session) => {
      const topSet = getTopSet(session.sets)
      return {
        ...session,
        weight: topSet.weight,
        reps: topSet.reps,
        estimated1RM: estimate1RM(topSet.weight, topSet.reps),
        volume: getSetsVolume(session.sets),
        dateLabel: formatDateLabel(session.date),
      }
    })
  }, [exerciseLogs, selectedExerciseId])

  const [manualSessionId, setManualSessionId] = useState(null)
  useEffect(() => {
    setManualSessionId(null)
  }, [selectedExerciseId])

  const latestSession = sessions.length ? sessions[sessions.length - 1] : null
  const firstSession = sessions.length ? sessions[0] : null
  const selectedSession = sessions.find((s) => s.sessionId === manualSessionId) ?? latestSession

  const strengthChange =
    latestSession && firstSession ? latestSession.estimated1RM - firstSession.estimated1RM : null

  return (
    <div className="space-y-4">
      <ExerciseSelect exercises={exercises} selectedId={selectedExerciseId} onChange={onSelectExercise} />

      {!latestSession ? (
        <div className="card rounded-[28px] p-6 text-center text-sm text-base-400">
          No sets logged for this exercise yet.
        </div>
      ) : (
        <>
          <div className="card rounded-[28px] p-5">
            <p className="text-xs text-base-400">Current performance</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-display font-black text-3xl text-base-100">{latestSession.weight}</span>
              <span className="text-sm text-base-400">lb ×</span>
              <span className="font-display font-black text-3xl text-base-100">{latestSession.reps}</span>
              <span className="text-sm text-base-400">reps</span>
            </div>

            {sessions.length > 1 ? (
              <div className="mt-5">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={sessions} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-700)" vertical={false} />
                    <XAxis dataKey="dateLabel" stroke="var(--color-base-400)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="var(--color-base-400)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={36}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--color-base-800)',
                        border: 'none',
                        borderRadius: 12,
                        boxShadow: '0 2px 16px rgba(43,31,28,0.12)',
                      }}
                      labelStyle={{ color: 'var(--color-base-400)', fontSize: 11 }}
                      formatter={(value, key, { payload }) => [`${payload.weight} lb × ${payload.reps} reps`, 'Top set']}
                    />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="var(--color-accent-start)"
                      strokeWidth={2.5}
                      isAnimationActive={false}
                      dot={(dotProps) => (
                        <ExerciseDot
                          key={dotProps.payload.sessionId}
                          {...dotProps}
                          isSelected={dotProps.payload.sessionId === selectedSession?.sessionId}
                          onSelect={setManualSessionId}
                        />
                      )}
                      activeDot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-base-400 mt-4">Log a second session to see a progression chart.</p>
            )}
          </div>

          <div className="card rounded-[28px] p-5">
            <p className="text-xs text-base-400">Estimated strength</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-display font-black text-3xl text-base-100">{latestSession.estimated1RM}</span>
              <span className="text-sm text-base-400">lb (est. 1RM)</span>
            </div>
            {strengthChange !== null && sessions.length > 1 && (
              <p className="text-xs text-base-400 mt-1">
                {strengthChange === 0 ? 'No change' : `${strengthChange > 0 ? '+' : ''}${strengthChange} lb`} since first logged
              </p>
            )}
            {sessions.length > 1 && (
              <div className="mt-4">
                <TrendLineChart
                  data={sessions}
                  xKey="dateLabel"
                  yKey="estimated1RM"
                  color="var(--color-back)"
                  height={140}
                />
              </div>
            )}
          </div>

          <div className="card rounded-[28px] p-5">
            <div className="flex items-baseline justify-between">
              <p className="text-xs text-base-400">
                {selectedSession.sessionId === latestSession.sessionId ? 'Most recent workout' : 'Selected workout'}
              </p>
              <p className="text-xs text-base-400">{formatDateLabel(selectedSession.date)}</p>
            </div>

            <div className="mt-3 space-y-1.5">
              {selectedSession.sets.map((set) => (
                <div key={set.id} className="flex items-center justify-between text-sm">
                  <span className="text-base-400">Set {set.set_number}</span>
                  <span className="text-base-100 font-medium">
                    {set.weight} lb × {set.reps}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-base-700">
              <div>
                <p className="text-[11px] text-base-400">Estimated strength</p>
                <p className="text-sm font-semibold text-base-100 mt-0.5">{selectedSession.estimated1RM} lb</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-base-400">Volume</p>
                <p className="text-sm font-semibold text-base-100 mt-0.5">{selectedSession.volume.toLocaleString()} lb</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
