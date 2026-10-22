import { ChevronRight, Shuffle } from 'lucide-react'
import { PROGRAM_DAYS } from '@/data/program'
import { getDayFocus } from '@/domain/weekPlan'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/ui/sheet'

// "Choose a different day": start any day instead of the next in queue.
// The queue then continues from whichever day she completes.
export function ChooseDaySheet({ nextDay, onStart }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" block>
          <Shuffle /> Choose a different day
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Choose a workout</SheetTitle>
          <SheetDescription>The queue picks up from whichever day you finish.</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <ul className="space-y-2">
            {PROGRAM_DAYS.map((day) => (
              <li key={day.id}>
                <button
                  type="button"
                  onClick={() => onStart(day.id)}
                  className="focus-ring flex min-h-input w-full items-center gap-3 rounded-row-lg border border-border bg-surface px-4 py-3 text-left hover:bg-surface-muted"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-title font-extrabold text-foreground">{day.shortLabel}</span>
                    <span className="block text-caption text-muted-foreground">
                      {getDayFocus(day)} · {day.exercises.length} exercises · about {day.estimatedMinutes} min
                    </span>
                  </span>
                  {day.id === nextDay.id && <Badge variant="accent">Next up</Badge>}
                  <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
