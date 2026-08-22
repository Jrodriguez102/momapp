import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

// exercises: [{ id, name }]. Any logged exercise is selectable — not
// limited to a predetermined list of "key lifts".
export default function ExerciseSelect({ exercises, selectedId, onChange }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const selected = exercises.find((ex) => ex.id === selectedId)

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="card rounded-2xl px-4 py-3.5 flex items-center justify-between w-full"
      >
        <span className="font-display font-extrabold text-base text-base-100 text-left">
          {selected?.name ?? 'Select exercise'}
        </span>
        <ChevronDown size={18} className={`text-base-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-10 mt-2 w-full card rounded-2xl p-2 max-h-64 overflow-y-auto">
          {exercises.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => {
                onChange(ex.id)
                setOpen(false)
              }}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${
                ex.id === selectedId ? 'bg-accent-start/10 text-accent-end font-semibold' : 'text-base-200 hover:bg-base-900'
              }`}
            >
              {ex.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
