import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// A collapsed exercise: 64px, name + "N of M sets", tap to open it.
export function ExerciseRow({ name, loggedCount, prescribedSets, isComplete, onOpen }) {
  return (
    <button
      type="button"
      aria-expanded={false}
      onClick={onOpen}
      className={cn(
        'focus-ring flex min-h-row w-full items-center gap-3 rounded-row-lg border px-4 py-2 text-left',
        isComplete ? 'border-success-border bg-success-tint' : 'border-border bg-surface hover:bg-surface-muted',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-title font-extrabold text-foreground">{name}</span>
        <span className="block text-caption text-muted-foreground">
          {loggedCount} of {prescribedSets} sets
        </span>
      </span>
      {isComplete ? (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success text-primary-foreground">
          <Check aria-hidden="true" className="size-4" strokeWidth={3} />
          <span className="sr-only">Done</span>
        </span>
      ) : (
        <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      )}
    </button>
  )
}
