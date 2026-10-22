import { useCallback, useEffect, useRef, useState } from 'react'
import { afterAutoClose, SESSIONS_AUTO_CLOSED_EVENT } from '@/services/autoClose'

// Loads data for a screen and tracks its state:
//   { status: 'loading' | 'success' | 'error', data, error, reload, setData }
// - `load` runs on mount and again whenever `key` changes (pass whatever
//   the load depends on, e.g. a dayId). The latest `load` is always used.
//   Only the latest request may update state: stale and post-unmount
//   results are dropped.
// - Data from a previous load stays in `data` while reloading and on a
//   failed reload, so a screen can keep showing it.
// - waitForAutoClose: await the auto-close check first, so a forgotten
//   session is closed and counted before anything is computed.
// - reloadOnAutoClose: reload when a foreground auto-close closes sessions.
// - setData(updater) patches data locally after a successful write.
export function useAsyncData(load, { key, waitForAutoClose = false, reloadOnAutoClose = false } = {}) {
  const [state, setState] = useState({ status: 'loading', data: undefined, error: null })
  const requestRef = useRef(0)
  const loadRef = useRef(load)

  // Declared before the load effect so a new `load` is in place first.
  useEffect(() => {
    loadRef.current = load
  })

  const reload = useCallback(() => {
    const request = ++requestRef.current
    setState((prev) => (prev.data === undefined && prev.status !== 'loading' ? { ...prev, status: 'loading' } : prev))
    ;(async () => {
      try {
        if (waitForAutoClose) await afterAutoClose()
        const data = await loadRef.current()
        if (request === requestRef.current) setState({ status: 'success', data, error: null })
      } catch (error) {
        if (request !== requestRef.current) return
        console.error('Failed to load:', error)
        setState((prev) => ({ status: 'error', data: prev.data, error }))
      }
    })()
  }, [waitForAutoClose])

  useEffect(() => {
    reload()
  }, [reload, key])

  // Invalidate any in-flight request on unmount.
  useEffect(
    () => () => {
      requestRef.current++
    },
    [],
  )

  useEffect(() => {
    if (!reloadOnAutoClose) return undefined
    window.addEventListener(SESSIONS_AUTO_CLOSED_EVENT, reload)
    return () => window.removeEventListener(SESSIONS_AUTO_CLOSED_EVENT, reload)
  }, [reloadOnAutoClose, reload])

  const setData = useCallback((updater) => {
    setState((prev) => ({ ...prev, data: typeof updater === 'function' ? updater(prev.data) : updater }))
  }, [])

  return { ...state, reload, setData }
}
