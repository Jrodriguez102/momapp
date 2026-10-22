import { CloudOff, RotateCw } from 'lucide-react'
import { Button } from '@/ui/button'
import { EmptyState } from '@/ui/empty-state'

// Shown when a screen's data couldn't load (usually no connection), instead
// of a blank screen or empty-looking data.
export function ErrorState({ onRetry, title = "Couldn't load this", description = 'Check your connection and try again.', className }) {
  return (
    <EmptyState
      role="alert"
      icon={CloudOff}
      title={title}
      description={description}
      className={className}
      action={
        onRetry && (
          <Button variant="dark" size="sm" onClick={onRetry}>
            <RotateCw /> Try again
          </Button>
        )
      }
    />
  )
}
