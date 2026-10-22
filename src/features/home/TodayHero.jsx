import { Check, Play } from 'lucide-react'
import { SESSIONS_PER_BLOCK } from '@/data/program'
import { findDayById } from '@/domain/metrics'
import { formatBlockLabel } from '@/domain/format'
import { getDayFocus, getExercisePreview } from '@/domain/weekPlan'
import { Button } from '@/ui/button'
import { HeroCard, HeroChip, HeroEyebrow } from '@/ui/hero-card'

const HERO_CHIP_COUNT = 3

function ExerciseChips({ programDay }) {
  const { names, more } = getExercisePreview(programDay, HERO_CHIP_COUNT)
  return (
    <ul aria-label="Exercises" className="mt-4 flex flex-wrap gap-1.5">
      {names.map((name) => (
        <li key={name}>
          <HeroChip>{name}</HeroChip>
        </li>
      ))}
      {more > 0 && (
        <li>
          <HeroChip>+{more} more</HeroChip>
        </li>
      )}
    </ul>
  )
}

// "Upper A" at hero size with its focus ("Chest / Back") under it — the full
// "Upper A (Chest / Back)" would wrap to three lines at 38px.
function DayTitle({ programDay }) {
  const focus = getDayFocus(programDay)
  return (
    <>
      <h2 className="mt-1 font-display text-hero font-black text-primary-foreground">{programDay.shortLabel}</h2>
      {focus && <p className="font-display text-title font-extrabold text-primary-foreground">{focus}</p>}
    </>
  )
}

// The Home hero, in one of three states:
//   in progress     — an open workout takes priority: "Continue workout"
//   block complete  — all 24 sessions done; nothing new starts
//   next up         — the next queue day: "Start workout"
// trainedToday switches the label from "Today's workout" to "Next up".
export function TodayHero({ blockState, inProgressSession, trainedToday, onStart }) {
  if (inProgressSession) {
    const programDay = findDayById(inProgressSession.day_id)
    const startedAt = new Date(inProgressSession.started_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    return (
      <HeroCard aria-label="Workout in progress">
        <HeroEyebrow>Workout in progress</HeroEyebrow>
        {programDay ? <DayTitle programDay={programDay} /> : <h2 className="mt-1 font-display text-hero font-black">Workout</h2>}
        <p className="mt-1 text-body-sm text-primary-foreground">
          Session {blockState.sessionNumber} of {SESSIONS_PER_BLOCK} · started {startedAt}
        </p>
        {programDay && <ExerciseChips programDay={programDay} />}
        <Button variant="light" size="lg" block className="mt-5" onClick={() => onStart(inProgressSession.day_id)}>
          <Play fill="currentColor" /> Continue workout
        </Button>
      </HeroCard>
    )
  }

  if (blockState.isBlockComplete) {
    return (
      <HeroCard aria-label="Block complete">
        <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-primary-foreground/18">
          <Check className="size-6" strokeWidth={3} />
        </span>
        <HeroEyebrow className="mt-4">{formatBlockLabel(blockState.block)}</HeroEyebrow>
        <h2 className="mt-1 font-display text-hero font-black">Complete</h2>
        <p className="mt-2 text-body-sm text-primary-foreground">
          All {SESSIONS_PER_BLOCK} sessions are done. The next block will be built from this data.
        </p>
      </HeroCard>
    )
  }

  const { nextDay } = blockState
  const label = trainedToday ? 'Next up' : "Today's workout"
  return (
    <HeroCard aria-label={label}>
      <HeroEyebrow>{label}</HeroEyebrow>
      <DayTitle programDay={nextDay} />
      <p className="mt-1 text-body-sm text-primary-foreground">
        Session {blockState.sessionNumber} of {SESSIONS_PER_BLOCK} · {nextDay.exercises.length} exercises · about{' '}
        {nextDay.estimatedMinutes} min
      </p>
      <ExerciseChips programDay={nextDay} />
      <Button variant="light" size="lg" block className="mt-5" onClick={() => onStart(nextDay.id)}>
        <Play fill="currentColor" /> Start workout
      </Button>
    </HeroCard>
  )
}
