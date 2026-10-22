import { buildWeekRows, getExercisePreview } from '@/domain/weekPlan'
import { Card, CardTitle } from '@/ui/card'
import { DayRow } from '@/ui/day-row'

const PREVIEW_COUNT = 2

// ["DB Bench Press", "Lat Pulldown", "+4"]
function previewParts(programDay) {
  const { names, more } = getExercisePreview(programDay, PREVIEW_COUNT)
  return [...names, ...(more ? [`+${more}`] : [])]
}

function rowProps(row) {
  const base = {
    weekday: row.date.toLocaleDateString(undefined, { weekday: 'short' }),
    dateNumber: row.date.getDate(),
    status: row.kind,
  }
  if (row.kind === 'missed') return { ...base, title: 'No workout', detail: 'The queue waits — nothing is skipped' }
  if (!row.programDay) return { ...base, title: 'Workout' } // pilot-era day id
  return {
    ...base,
    title: row.programDay.shortLabel,
    detail: previewParts(row.programDay),
    todayLabel: row.inProgress ? 'In progress' : 'Today',
  }
}

// This week's training days as rows — see buildWeekRows for the rules.
export function WeekCard({ trainingWeek, blockState, inProgressDayId }) {
  const rows = buildWeekRows({ trainingWeek, blockState, inProgressDayId })
  return (
    <Card as="section" aria-labelledby="week-card-title" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <CardTitle id="week-card-title">This week</CardTitle>
        <p className="text-body-sm font-semibold text-muted-foreground">
          {trainingWeek.completedCount} of {trainingWeek.plannedCount} done
        </p>
      </div>
      {rows.length ? (
        <ol className="space-y-2">
          {rows.map((row, i) => (
            <li key={`${row.date.toDateString()}-${i}`}>
              <DayRow {...rowProps(row)} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-body-sm text-muted-foreground">Nothing planned for the rest of this week.</p>
      )}
    </Card>
  )
}
