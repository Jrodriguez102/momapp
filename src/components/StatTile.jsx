// dotColor: a CSS color value (hex or var()) for the small legend dot beside
// the label — mirrors the colored-bullet legend pattern from the reference.
export default function StatTile({ value, unit, label, dotColor }) {
  return (
    <div className="card rounded-[20px] p-3.5 flex flex-col gap-2">
      <div className="flex items-baseline gap-1">
        <span className="font-display font-extrabold text-xl text-base-100 leading-none">{value}</span>
        {unit && <span className="text-[10px] text-base-400">{unit}</span>}
      </div>
      <div className="flex items-center gap-1.5">
        {dotColor && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />}
        <span className="text-[11px] text-base-400 leading-tight">{label}</span>
      </div>
    </div>
  )
}
