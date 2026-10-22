import { useId } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts'

const AXIS = { stroke: 'var(--color-muted-foreground)', fontSize: 12, tickLine: false, axisLine: false }

// Coral area chart of body weight with a dot on the latest point.
// Decorative for screen readers — the caller pairs it with a text summary.
// points: [{ label, weight }] oldest first.
export function WeightChart({ points, height = 170 }) {
  const gradientId = useId()
  const lastIndex = points.length - 1
  return (
    <div aria-hidden="true" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" {...AXIS} minTickGap={24} />
          <YAxis {...AXIS} width={40} domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={(v) => Math.round(v)} />
          <Area
            type="monotone"
            dataKey="weight"
            stroke="var(--color-primary)"
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            activeDot={false}
            dot={({ cx, cy, index }) =>
              index === lastIndex ? (
                <circle key="last" cx={cx} cy={cy} r={6} fill="var(--color-primary)" stroke="var(--color-surface)" strokeWidth={3} />
              ) : (
                <g key={index} />
              )
            }
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
