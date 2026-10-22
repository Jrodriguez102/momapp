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

// "Remove set N?" confirmation, shared by the workout and History.
// row: the exercise_logs row to remove (null = closed); note: an extra
// sentence about what removing it also does.
export function RemoveSetDialog({ row, unit = 'lb', note, onConfirm, onCancel }) {
  return (
    <AlertDialog open={!!row} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove set {row?.set_number}?</AlertDialogTitle>
          <AlertDialogDescription>
            {row?.weight ?? '—'} {unit} × {row?.reps} will be deleted.{note && ` ${note}`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Remove set
          </AlertDialogAction>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
