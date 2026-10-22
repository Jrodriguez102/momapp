import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'

const AXIS = { stroke: 'var(--color-muted-foreground)', fontSize: 12, tickLine: false, axisLine: false }

// A session's top set as a big tappable point (44px hit area) with its
// "weight×reps" riding above it — reps are part of the story, since rep
// ranges change on purpose. Tapping a point selects that session; the
// session chips under the chart do the same for keyboard/screen readers,
// so the chart itself is aria-hidden.
function TopSetDot({ cx, cy, payload, selectedId, onSelect }) {
  if (cx == null || cy == null) return <g />
  const selected = payload.sessionId === selectedId
  return (
    <g onClick={() => onSelect(payload.sessionId)} style={{ cursor: 'pointer' }}>
      <circle cx={cx} cy={cy} r={22} fill="transparent" />
      <circle
        cx={cx}
        cy={cy}
        r={selected ? 9 : 7}
        fill={selected ? 'var(--color-accent-deep)' : 'var(--color-primary)'}
        stroke="var(--color-surface)"
        strokeWidth={3}
      />
      <text x={cx} y={cy - 16} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--color-foreground)">
        {payload.top.weight}×{payload.top.reps}
      </text>
    </g>
  )
}

// sessions: exerciseSessions() output (oldest first) with a `label`.
export function TopSetChart({ sessions, selectedId, onSelect, height = 200 }) {
  return (
    <div aria-hidden="true" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={sessions} margin={{ top: 30, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" {...AXIS} padding={{ left: 20, right: 20 }} minTickGap={16} />
          <YAxis {...AXIS} width={40} dataKey={(s) => s.top.weight} domain={['dataMin - 5', 'dataMax + 5']} tickFormatter={(v) => Math.round(v)} />
          <Line
            type="monotone"
            dataKey={(s) => s.top.weight}
            stroke="var(--color-primary)"
            strokeWidth={2.5}
            isAnimationActive={false}
            activeDot={false}
            dot={(props) => <TopSetDot key={props.payload.sessionId} {...props} selectedId={selectedId} onSelect={onSelect} />}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
