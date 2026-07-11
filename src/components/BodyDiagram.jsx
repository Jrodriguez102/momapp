import { getVolumeStatus, VOLUME_STATUS_COLORS } from '../data/helpers'

// Simple stylized front/back silhouette. Each muscle group is a shape
// (or set of shapes) filled according to its weekly volume status.
// Kept intentionally minimal/geometric rather than photorealistic —
// legible at a glance is the goal, not anatomical accuracy.

function regionFill(volumeByGroup, group) {
  const sets = volumeByGroup[group] ?? 0
  const status = getVolumeStatus(sets)
  return VOLUME_STATUS_COLORS[status]
}

function Legend() {
  const items = [
    { label: 'Low volume', color: VOLUME_STATUS_COLORS.low },
    { label: 'Optimal', color: VOLUME_STATUS_COLORS.optimal },
    { label: 'High volume', color: VOLUME_STATUS_COLORS.high },
  ]
  return (
    <div className="flex gap-4 justify-center text-xs text-base-400 mt-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </div>
      ))}
    </div>
  )
}

export default function BodyDiagram({ volumeByGroup }) {
  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="font-display text-lg mb-4 text-base-100">Weekly Volume by Muscle Group</h3>
      <div className="flex justify-center gap-8">
        {/* FRONT VIEW */}
        <div className="flex flex-col items-center gap-1">
          <svg viewBox="0 0 120 240" width="110" className="overflow-visible">
            {/* head */}
            <circle cx="60" cy="18" r="14" fill="var(--color-base-700)" />
            {/* neck */}
            <rect x="54" y="30" width="12" height="10" fill="var(--color-base-700)" />
            {/* shoulders */}
            <path d="M30 42 Q60 34 90 42 L90 58 Q60 50 30 58 Z" fill={regionFill(volumeByGroup, 'shoulders')} />
            {/* chest */}
            <rect x="38" y="50" width="44" height="34" rx="8" fill={regionFill(volumeByGroup, 'chest')} />
            {/* torso base (neutral) */}
            <rect x="42" y="84" width="36" height="30" fill="var(--color-base-700)" />
            {/* biceps (upper arms) */}
            <rect x="18" y="46" width="14" height="40" rx="6" fill={regionFill(volumeByGroup, 'biceps')} />
            <rect x="88" y="46" width="14" height="40" rx="6" fill={regionFill(volumeByGroup, 'biceps')} />
            {/* forearms (neutral) */}
            <rect x="16" y="86" width="12" height="34" rx="5" fill="var(--color-base-700)" />
            <rect x="92" y="86" width="12" height="34" rx="5" fill="var(--color-base-700)" />
            {/* quads */}
            <rect x="40" y="118" width="17" height="52" rx="7" fill={regionFill(volumeByGroup, 'quads')} />
            <rect x="63" y="118" width="17" height="52" rx="7" fill={regionFill(volumeByGroup, 'quads')} />
            {/* shins (neutral) */}
            <rect x="41" y="172" width="14" height="50" rx="5" fill="var(--color-base-700)" />
            <rect x="65" y="172" width="14" height="50" rx="5" fill="var(--color-base-700)" />
          </svg>
          <span className="text-xs text-base-400">Front</span>
        </div>

        {/* BACK VIEW */}
        <div className="flex flex-col items-center gap-1">
          <svg viewBox="0 0 120 240" width="110" className="overflow-visible">
            <circle cx="60" cy="18" r="14" fill="var(--color-base-700)" />
            <rect x="54" y="30" width="12" height="10" fill="var(--color-base-700)" />
            <path d="M30 42 Q60 34 90 42 L90 58 Q60 50 30 58 Z" fill={regionFill(volumeByGroup, 'shoulders')} />
            {/* back */}
            <rect x="36" y="50" width="48" height="48" rx="8" fill={regionFill(volumeByGroup, 'back')} />
            {/* triceps */}
            <rect x="18" y="46" width="14" height="40" rx="6" fill={regionFill(volumeByGroup, 'triceps')} />
            <rect x="88" y="46" width="14" height="40" rx="6" fill={regionFill(volumeByGroup, 'triceps')} />
            <rect x="16" y="86" width="12" height="34" rx="5" fill="var(--color-base-700)" />
            <rect x="92" y="86" width="12" height="34" rx="5" fill="var(--color-base-700)" />
            {/* glutes */}
            <rect x="40" y="100" width="40" height="24" rx="10" fill={regionFill(volumeByGroup, 'glutes')} />
            {/* hamstrings */}
            <rect x="40" y="126" width="17" height="44" rx="7" fill={regionFill(volumeByGroup, 'hamstrings')} />
            <rect x="63" y="126" width="17" height="44" rx="7" fill={regionFill(volumeByGroup, 'hamstrings')} />
            {/* calves */}
            <rect x="41" y="172" width="14" height="50" rx="5" fill={regionFill(volumeByGroup, 'calves')} />
            <rect x="65" y="172" width="14" height="50" rx="5" fill={regionFill(volumeByGroup, 'calves')} />
          </svg>
          <span className="text-xs text-base-400">Back</span>
        </div>
      </div>
      <Legend />
    </div>
  )
}
