import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Dumbbell } from 'lucide-react'
import { findDayById } from '@/domain/metrics'
import { getRowCount } from '@/domain/workoutState'
import { ActionBar } from '@/ui/action-bar'
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
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { EmptyState } from '@/ui/empty-state'
import { ErrorState } from '@/ui/error-state'
import { IconButton } from '@/ui/icon-button'
import { Page } from '@/ui/page'
import { LoadingState } from '@/ui/skeleton'
import { EffortPicker } from './EffortPicker'
import { ExerciseCard } from './ExerciseCard'
import { ExerciseRow } from './ExerciseRow'
import {
  hasUnsavedEntries,
  isExerciseComplete,
  nextIncompleteExercise,
  nextOpenSetNumber,
  prescribedSetsFor,
} from './exerciseProgress'
import { LegacyAutoClosedScreen, LegacyBlockCompleteScreen, LegacyFinishedScreen } from './LegacyResultScreens'
import { SwapSheet } from './SwapSheet'
import { useWorkoutSession } from './useWorkoutSession'
import { WorkoutTopBar } from './WorkoutTopBar'

// After the next render, so the row's input exists.
function focusInput(id) {
  const later = window.requestAnimationFrame?.bind(window) ?? ((cb) => setTimeout(cb, 0))
  later(() => document.getElementById(id)?.focus())
}

function BackOnly({ onBack }) {
  return (
    <IconButton label="Back to Home" variant="ghost" className="-ml-2 text-foreground" onClick={onBack}>
      <ArrowLeft />
    </IconButton>
  )
}

// The live workout (full screen — AppShell hides the nav on /session/*).
// One exercise is open at a time; it auto-advances once all its prescribed
// sets are logged and the last set's feel is tapped.
export default function WorkoutPage() {
  const { dayId } = useParams()
  const navigate = useNavigate()
  const ws = useWorkoutSession(dayId)
  const [openChoice, setOpenChoice] = useState(undefined) // exercise id, null = all collapsed, undefined = not chosen yet
  const [swapTarget, setSwapTarget] = useState(null)
  const scrollToOpenRef = useRef(false)
  const goHome = () => navigate('/')

  const { day, weekMeta, logs } = ws
  const exercises = day?.exercises ?? []
  const prescribed = (ex) => prescribedSetsFor(ex, weekMeta)
  const complete = (ex) => isExerciseComplete(prescribed(ex), logs[ex.id])
  // On first load, open the first unfinished exercise — once. After that the
  // open card only changes by tapping a row or auto-advancing, so finishing
  // its last set doesn't snatch it away before the feel tap.
  if (ws.ready && openChoice === undefined) setOpenChoice(nextIncompleteExercise(exercises, complete)?.id ?? null)
  const openId = openChoice ?? null

  // Bring a newly opened exercise into view (below the sticky top bar).
  useEffect(() => {
    if (!scrollToOpenRef.current || !openId) return
    scrollToOpenRef.current = false
    document.getElementById(`exercise-${openId}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }, [openId])

  function open(id) {
    scrollToOpenRef.current = true
    setOpenChoice(id)
  }

  // Open the next unfinished exercise (after this one, wrapping); collapse
  // everything when none are left.
  function advanceFrom(ex) {
    open(nextIncompleteExercise(exercises, complete, ex.id)?.id ?? null)
  }

  async function handleLogSet(ex, index, values) {
    const setNumber = index + 1
    const ok = await ws.logSet(ex, index, values)
    if (!ok) return false
    const bySet = logs[ex.id] || {}
    if (isExerciseComplete(prescribed(ex), bySet, setNumber)) {
      // Done: move on once the last set's feel is known.
      if (ws.difficulties[ex.id]) advanceFrom(ex)
    } else {
      const next = nextOpenSetNumber(getRowCount(prescribed(ex), bySet), bySet, setNumber, setNumber)
      if (next) focusInput(`set-${ex.id}-${next}-reps`)
    }
    return true
  }

  async function handleDifficulty(ex, value) {
    const ok = await ws.setDifficulty(ex, value)
    if (ok && value && complete(ex)) advanceFrom(ex)
  }

  if (!day) {
    return (
      <Page tight>
        <BackOnly onBack={goHome} />
        <EmptyState icon={Dumbbell} title="Workout not found" description="That day isn't in the program." />
      </Page>
    )
  }

  if (ws.loadError) {
    return (
      <Page tight>
        <BackOnly onBack={goHome} />
        <ErrorState
          onRetry={ws.retryLoad}
          title="Couldn't load this workout"
          description="Check your connection and try again. Nothing was lost — logged sets are saved."
        />
      </Page>
    )
  }

  if (!ws.ready) {
    return (
      <Page tight>
        <LoadingState label="Loading your workout…" />
      </Page>
    )
  }

  if (ws.result?.kind === 'finished') return <LegacyFinishedScreen day={day} result={ws.result} onHome={goHome} />
  if (ws.result?.kind === 'auto-closed') return <LegacyAutoClosedScreen onHome={goHome} />

  if (ws.otherSession) {
    const otherDay = findDayById(ws.otherSession.day_id)
    return (
      <Page tight>
        <BackOnly onBack={goHome} />
        <EmptyState
          icon={Dumbbell}
          title="Another workout is in progress"
          description={`Finish ${otherDay?.shortLabel ?? 'that workout'} before starting ${day.shortLabel}.`}
          action={
            <Button onClick={() => navigate(`/session/${ws.otherSession.day_id}`)}>
              Continue {otherDay?.shortLabel ?? 'workout'} <ArrowRight />
            </Button>
          }
        />
      </Page>
    )
  }

  if (weekMeta.isBlockComplete && !ws.session) return <LegacyBlockCompleteScreen onHome={goHome} />

  const totalSets = exercises.reduce((sum, ex) => sum + prescribed(ex), 0)
  const swapExercise = swapTarget && exercises.find((ex) => ex.id === swapTarget)

  return (
    <div className="pb-action-bar-clearance">
      <Page tight className="space-y-4 pt-0">
        <WorkoutTopBar
          day={day}
          weekMeta={weekMeta}
          elapsedSeconds={ws.elapsedSeconds}
          loggedCount={ws.loggedCount}
          totalSets={totalSets}
          onBack={goHome}
        />
        {weekMeta.note && <p className="text-caption text-muted-foreground">{weekMeta.note}</p>}

        <ol className="space-y-2">
          {exercises.map((ex) => {
            const bySet = logs[ex.id] || {}
            const prescribedSets = prescribed(ex)
            const exComplete = isExerciseComplete(prescribedSets, bySet)
            const activeAlt = ws.swaps[ex.id] || null
            return (
              <li key={ex.id} id={`exercise-${ex.id}`} className="scroll-mt-36">
                {ex.id === openId ? (
                  <ExerciseCard
                    exercise={ex}
                    activeAlt={activeAlt}
                    prescribedSets={prescribedSets}
                    rowCount={getRowCount(prescribedSets, bySet)}
                    supersetPartner={
                      ex.supersetGroup
                        ? exercises.find((other) => other.supersetGroup === ex.supersetGroup && other.id !== ex.id)?.name
                        : null
                    }
                    suggestion={ws.suggestions[ex.id]}
                    entries={ws.entries[ex.id] || []}
                    logs={bySet}
                    prefillWeights={ws.prefillWeightsFor(ex, getRowCount(prescribedSets, bySet))}
                    savingSets={ws.savingSets[ex.id] || {}}
                    difficulty={ws.difficulties[ex.id] ?? null}
                    locked={ws.locked}
                    isComplete={exComplete}
                    isOnlySetInWorkout={ws.loggedCount === 1}
                    onEntryChange={(index, field, value) => ws.changeEntry(ex.id, index, field, value)}
                    onLogSet={(index, values) => handleLogSet(ex, index, values)}
                    onRemoveSet={(row) => ws.removeSet(ex, row)}
                    onRequestSwap={() => setSwapTarget(ex.id)}
                    onDifficulty={(value) => handleDifficulty(ex, value)}
                    onNext={() => advanceFrom(ex)}
                  />
                ) : (
                  <ExerciseRow
                    name={activeAlt?.name ?? ex.name}
                    loggedCount={Object.keys(bySet).length}
                    prescribedSets={prescribedSets}
                    isComplete={exComplete}
                    onOpen={() => open(ex.id)}
                  />
                )}
              </li>
            )
          })}
        </ol>

        {/* Temporary home for the session effort until the Workout complete
            screen takes it over (saved at Finish, as before). */}
        <Card className="p-4">
          <EffortPicker value={ws.sessionRpe} onChange={ws.setSessionRpe} disabled={ws.locked} />
        </Card>
      </Page>

      <ActionBar>
        <Button block size="md" onClick={ws.requestFinish} disabled={ws.loggedCount === 0 || ws.finishing}>
          {ws.finishing ? 'Saving…' : ws.loggedCount === 0 ? 'Log a set to finish' : `Finish workout · ${ws.loggedCount} ${ws.loggedCount === 1 ? 'set' : 'sets'}`}
        </Button>
      </ActionBar>

      <SwapSheet
        exercise={swapExercise ?? null}
        activeAlt={swapExercise ? ws.swaps[swapExercise.id] || null : null}
        hasUnsaved={swapExercise ? hasUnsavedEntries(ws.entries[swapExercise.id]) : false}
        onSwap={(alt) => ws.swapExercise(swapExercise, alt)}
        onClose={() => setSwapTarget(null)}
      />

      <AlertDialog open={ws.confirmingFinish} onOpenChange={(isOpen) => !isOpen && ws.cancelFinish()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Only {ws.loggedCount} {ws.loggedCount === 1 ? 'set' : 'sets'} logged
            </AlertDialogTitle>
            <AlertDialogDescription>
              Count this as a workout? If not, it’s saved as partial: your sets are kept, but it won’t count toward the
              block and {day.shortLabel} stays next.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => ws.finish(true)}>Count it</AlertDialogAction>
            <AlertDialogAction variant="outline" onClick={() => ws.finish(false)}>
              Save as partial
            </AlertDialogAction>
            <AlertDialogCancel>Keep going</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
