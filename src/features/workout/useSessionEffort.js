import { useRef, useState } from 'react'
import { updateSessionRpe } from '@/services/sessionsApi'
import { toast } from '@/ui/toast'

const TOAST_ID = 'effort-save'

// Whole-session effort picked on the Workout complete screen, after Finish.
// Saved straight away with updateSessionRpe (the same session_rpe write
// History uses); null clears it. Skipping it leaves session_rpe empty.
// Saves run one at a time so the latest pick always lands last. A failed
// save never touches the finished workout: it shows a toast with Retry.
// status: 'idle' | 'saving' | 'saved' | 'error'
export function useSessionEffort(sessionId, initialValue = null) {
  const [value, setValue] = useState(initialValue)
  const [status, setStatus] = useState('idle')
  const latestRef = useRef(initialValue)
  const queueRef = useRef(Promise.resolve())
  const requestRef = useRef(0)

  function save(next) {
    const request = ++requestRef.current
    const isLatest = () => request === requestRef.current
    setStatus('saving')
    queueRef.current = queueRef.current.then(async () => {
      try {
        await updateSessionRpe(sessionId, next)
        if (!isLatest()) return
        setStatus('saved')
        toast.dismiss(TOAST_ID)
      } catch (err) {
        console.error('Failed to save session effort:', err)
        if (!isLatest()) return // a newer pick is queued and reports for itself
        setStatus('error')
        toast.error("Couldn't save how hard it was", {
          id: TOAST_ID,
          description: 'Your workout is saved. Only the effort is missing.',
          duration: Infinity,
          action: { label: 'Retry', onClick: () => save(latestRef.current) },
        })
      }
    })
    return queueRef.current
  }

  function choose(next) {
    latestRef.current = next
    setValue(next)
    return save(next)
  }

  function retry() {
    return save(latestRef.current)
  }

  return { value, status, choose, retry }
}
