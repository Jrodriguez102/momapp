import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { difficultyToRpe, isWithinEditWindow } from '@/domain/sessionRules'
import { findDayById, groupSessionLogsByExercise, isValidReps, isValidWeight } from '@/domain/metrics'
import { removeHistorySet, saveSet, syncExerciseRpe } from '@/services/setsApi'
import { updateSessionRpe } from '@/services/sessionsApi'
import { cn } from '@/lib/utils'
import { EffortPicker } from '@/features/common/EffortPicker'
import { LastSetFeelChips } from '@/features/common/LastSetFeelChips'
import { LAST_SET_FEEL_QUESTION, lastSetFeelText } from '@/features/common/lastSetFeel'
import { RemoveSetDialog } from '@/features/common/RemoveSetDialog'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { SetRow, SetRowHeader } from '@/ui/set-row'
import { notifyError } from '@/ui/toast'
import { editHoursLeft, effortText, sessionSummaryParts } from './historyFormat'

const PREVIEW_EXERCISES = 3

function SetChip({ set }) {
  return (
    <span className="inline-flex h-8 items-center rounded-full bg-surface-muted px-3 text-body-sm font-semibold text-foreground tabular-nums">
      {set.weight ?? '—'} × {set.reps ?? '—'}
    </span>
  )
}

function ExerciseHeading({ group }) {
  return (
    <>
      <h3 className="font-display text-title font-extrabold text-foreground">{group.displayName}</h3>
      {group.originalName && <p className="text-caption text-muted-foreground">Swapped from {group.originalName}</p>}
    </>
  )
}

// One finished session: a summary row that expands in place. Within 48h of
// completed_at, "Edit sets" switches it to the same SetRow / feel chips /
// effort grid as the workout screen. Edits only touch exercise_logs and
// session_rpe — never status, completed_at or closed_by — except removing
// every set, which marks the session partial (removeHistorySet).
// onChanged(sessionId, patch): refetch this session's sets and apply patch.
export function SessionCard({ session, logs, onChanged, now }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [draft, setDraft] = useState(null) // { setId, weight, reps } — the set being edited
  const [confirmRemove, setConfirmRemove] = useState(null) // exercise_logs row
  const [busy, setBusy] = useState(false)

  const day = findDayById(session.day_id)
  const groups = useMemo(() => groupSessionLogsByExercise(logs), [logs])
  const editable = isWithinEditWindow(session, now)
  const isEditing = editable && editing
  const visibleGroups = isEditing || showAll ? groups : groups.slice(0, PREVIEW_EXERCISES)
  const hiddenCount = groups.length - visibleGroups.length
  const effort = effortText(session)
  const title = day?.shortLabel ?? (session.block === 0 ? 'Pilot workout' : 'Workout')
  const panelId = `session-${session.id}-details`

  async function run(action, patch) {
    setBusy(true)
    try {
      const result = await action()
      await onChanged(session.id, typeof patch === 'function' ? patch(result) : patch)
      return true
    } catch (err) {
      console.error('Failed to save History edit:', err)
      notifyError('Could not save that change — check your connection and try again.')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function saveDraft(set) {
    const ok = await run(() =>
      saveSet({
        sessionId: session.id,
        exerciseId: set.exercise_id,
        exerciseName: set.exercise_name,
        setNumber: set.set_number,
        weight: draft.weight,
        reps: draft.reps,
        weightUnit: set.weight_unit || 'lb',
      }),
    )
    if (ok) setDraft(null)
  }

  async function removeConfirmed() {
    const row = confirmRemove
    setConfirmRemove(null)
    const ok = await run(
      () => removeHistorySet(row),
      ({ remaining }) => (remaining === 0 ? { status: 'partial' } : null),
    )
    if (ok) setDraft(null)
  }

  return (
    <Card as="article" aria-label={`${title}, ${sessionSummaryParts(session, logs)[0]}`} className="overflow-hidden p-0">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((e) => !e)}
        className="focus-ring flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-display text-title font-extrabold text-foreground">{title}</span>
          <span className="block text-caption text-muted-foreground">{sessionSummaryParts(session, logs).join(' · ')}</span>
        </span>
        <Badge variant={session.status === 'partial' ? 'warning' : 'success'}>
          {session.status === 'partial' ? 'Partial' : 'Completed'}
        </Badge>
        <ChevronDown aria-hidden="true" className={cn('size-5 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div id={panelId} className="space-y-4 border-t border-border px-4 pt-3 pb-4">
          {editable && (
            <div className="flex items-center justify-between gap-3 rounded-row border border-accent-border bg-accent py-1.5 pr-1.5 pl-3.5">
              <p className="text-body-sm font-semibold text-accent-deep">
                {isEditing ? 'Tap a set to change it' : `Editable for ${editHoursLeft(session, now)} more ${editHoursLeft(session, now) === 1 ? 'hour' : 'hours'}`}
              </p>
              <Button variant="dark" size="sm" disabled={busy} onClick={() => { setEditing((e) => !e); setDraft(null) }}>
                {isEditing ? 'Done' : 'Edit sets'}
              </Button>
            </div>
          )}

          {groups.length === 0 && <p className="text-body-sm text-muted-foreground">No sets logged for this session.</p>}

          {visibleGroups.map((group) =>
            isEditing ? (
              <section key={group.exerciseId} className="space-y-2">
                <ExerciseHeading group={group} />
                <SetRowHeader unit={group.sets[0]?.weight_unit || 'lb'} />
                {group.sets.map((set) =>
                  draft?.setId === set.id ? (
                    <SetRow
                      key={set.id}
                      mode="editing"
                      id={`history-${set.id}`}
                      setNumber={set.set_number}
                      unit={set.weight_unit || 'lb'}
                      weight={draft.weight}
                      reps={draft.reps}
                      onWeightChange={(weight) => setDraft((d) => ({ ...d, weight }))}
                      onRepsChange={(reps) => setDraft((d) => ({ ...d, reps }))}
                      canSubmit={isValidWeight(draft.weight) && isValidReps(draft.reps)}
                      saving={busy}
                      onSubmit={() => saveDraft(set)}
                      onRemove={() => setConfirmRemove(set)}
                      onCancel={() => setDraft(null)}
                    />
                  ) : (
                    <SetRow
                      key={set.id}
                      mode="logged"
                      setNumber={set.set_number}
                      unit={set.weight_unit || 'lb'}
                      weight={set.weight}
                      reps={set.reps}
                      disabled={busy}
                      onEdit={() => setDraft({ setId: set.id, weight: set.weight ?? '', reps: set.reps ?? '' })}
                    />
                  ),
                )}
                <div className="space-y-2 rounded-row bg-surface-muted p-3">
                  <p className="text-body-sm font-semibold text-foreground">{LAST_SET_FEEL_QUESTION}</p>
                  <LastSetFeelChips
                    label={`${group.displayName}: ${LAST_SET_FEEL_QUESTION}`}
                    value={group.difficulty}
                    disabled={busy}
                    onChange={(value) => run(() => syncExerciseRpe(session.id, group.exerciseId, difficultyToRpe(value)))}
                  />
                </div>
              </section>
            ) : (
              <section key={group.exerciseId}>
                <ExerciseHeading group={group} />
                <ul aria-label={`${group.displayName} sets`} className="mt-2 flex flex-wrap gap-1.5">
                  {group.sets.map((set) => (
                    <li key={set.id}>
                      <SetChip set={set} />
                    </li>
                  ))}
                </ul>
                {group.difficulty && <p className="mt-1.5 text-caption text-muted-foreground">Last set: {lastSetFeelText(group.difficulty)}</p>}
              </section>
            ),
          )}

          {isEditing ? (
            <div className="border-t border-border pt-4">
              <EffortPicker
                value={session.session_rpe ?? null}
                disabled={busy}
                onChange={(value) => run(() => updateSessionRpe(session.id, value), { session_rpe: value })}
              />
            </div>
          ) : (
            (hiddenCount > 0 || groups.length > 0) && (
              <p className="flex flex-wrap items-center gap-x-1.5 text-body-sm text-muted-foreground">
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="focus-ring inline-flex min-h-tap items-center rounded-row font-semibold text-accent-foreground"
                  >
                    +{hiddenCount} more {hiddenCount === 1 ? 'exercise' : 'exercises'}
                  </button>
                )}
                <span className="whitespace-nowrap">
                  {hiddenCount > 0 && '· '}
                  {effort ?? 'No effort logged'}
                </span>
              </p>
            )
          )}
        </div>
      )}

      <RemoveSetDialog
        row={confirmRemove}
        unit={confirmRemove?.weight_unit || 'lb'}
        note={logs.length === 1 ? 'It’s the last set in this workout, so the workout will be marked partial.' : null}
        onConfirm={removeConfirmed}
        onCancel={() => setConfirmRemove(null)}
      />
    </Card>
  )
}
