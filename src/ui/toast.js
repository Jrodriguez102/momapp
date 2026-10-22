import { toast } from 'sonner'

// Toasts render through <Toaster /> (src/ui/sonner.jsx), mounted once in App.
export { toast }

// A failed save/remove: log the cause, tell her in plain words.
export function notifyError(message, error) {
  if (error) console.error(message, error)
  toast.error(message)
}
