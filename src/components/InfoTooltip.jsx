import { useState } from 'react'
import { Info } from 'lucide-react'

export default function InfoTooltip({ title, body }) {
  const [open, setOpen] = useState(false)

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={title}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        className="text-base-400 hover:text-accent-start transition-colors"
      >
        <Info size={14} />
      </button>
      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 top-6 z-50 w-64 card rounded-xl p-3 text-xs text-base-200">
          <p className="font-semibold text-base-100 mb-1">{title}</p>
          <p>{body}</p>
        </div>
      )}
    </span>
  )
}
