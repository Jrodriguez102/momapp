import { useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/alert-dialog'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/ui/sheet'

// Pick the base exercise or one of its two alternatives. Alternatives are
// for equipment or comfort problems; each is tracked under its own name.
// If the slot has typed-but-unsaved numbers, confirm before clearing them.
// exercise: the program slot (null = closed); activeAlt: current swap or null.
export function SwapSheet({ exercise, activeAlt, hasUnsaved, onSwap, onClose }) {
  const [pending, setPending] = useState(undefined) // alt (or null for the base) awaiting confirmation
  const options = exercise ? [null, ...exercise.alternatives] : []
  const activeName = activeAlt?.name ?? exercise?.name

  function choose(alt) {
    const name = alt?.name ?? exercise.name
    if (name === activeName) return onClose()
    if (hasUnsaved) setPending(alt)
    else {
      onSwap(alt)
      onClose()
    }
  }

  return (
    <>
      <Sheet open={!!exercise} onOpenChange={(open) => !open && onClose()}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Swap exercise</SheetTitle>
            <SheetDescription>Only for equipment or comfort problems. Each option keeps its own history.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <ul className="space-y-2">
              {options.map((alt) => {
                const name = alt?.name ?? exercise.name
                const selected = name === activeName
                return (
                  <li key={name}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => choose(alt)}
                      className={cn(
                        'focus-ring flex min-h-input w-full items-center gap-3 rounded-row-lg border px-4 py-3 text-left',
                        selected ? 'border-primary bg-accent' : 'border-border bg-surface hover:bg-surface-muted',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-title font-extrabold text-foreground">{name}</span>
                        <span className="block text-caption text-muted-foreground">{alt ? 'Alternative' : 'Program exercise'}</span>
                      </span>
                      {selected && <Check aria-hidden="true" className="size-5 shrink-0 text-accent-foreground" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </SheetBody>
        </SheetContent>
      </Sheet>

      <AlertDialog open={pending !== undefined} onOpenChange={(open) => !open && setPending(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear the numbers you typed?</AlertDialogTitle>
            <AlertDialogDescription>
              Switching to {pending?.name ?? exercise?.name} clears the unsaved weights and reps for {activeName}. Logged sets are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                onSwap(pending)
                setPending(undefined)
                onClose()
              }}
            >
              Switch exercise
            </AlertDialogAction>
            <AlertDialogCancel onClick={onClose}>Keep {activeName}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
