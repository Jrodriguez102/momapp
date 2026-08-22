import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

// Shared plain trend line — body weight and estimated-strength charts both
// use this. The exercise progression chart doesn't (it needs custom
// per-point reps labels + click-to-select), so it builds its own.
export default function TrendLineChart({ data, xKey, yKey, color = 'var(--color-accent-start)', height = 180, yFormatter, tooltipFormatter }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-700)" vertical={false} />
        <XAxis dataKey={xKey} stroke="var(--color-base-400)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          stroke="var(--color-base-400)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={36}
          tickFormatter={yFormatter}
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
          formatter={tooltipFormatter}
        />
        <Line
          type="monotone"
          dataKey={yKey}
          stroke={color}
          strokeWidth={2.5}
          dot={{ r: 4, fill: color, strokeWidth: 2, stroke: 'var(--color-base-800)' }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
