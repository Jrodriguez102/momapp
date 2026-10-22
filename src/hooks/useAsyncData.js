import { useCallback, useEffect, useRef, useState } from 'react'
import { afterAutoClose, SESSIONS_AUTO_CLOSED_EVENT } from '@/services/autoClose'

// supabase-js retries failed reads with backoff (~7s per query) and pages
// wait for the auto-close check first, so offline a load can take 15s+ to
// fail on its own. Give up on waiting after this long and show the error.
export const LOAD_TIMEOUT_MS = 8000

export class LoadTimeoutError extends Error {
  constructor(ms) {
    super(`Load took longer than ${ms}ms`)
    this.name = 'LoadTimeoutError'
  }
}

export function withTimeout(promise, ms) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new LoadTimeoutError(ms)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

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
// - timeoutMs: the whole load (including the auto-close wait) errors with
//   LoadTimeoutError after this long (null = no limit). The requests keep
//   going; if they still succeed, their data replaces the error.
// - setData(updater) patches data locally after a successful write.
export function useAsyncData(
  load,
  { key, waitForAutoClose = false, reloadOnAutoClose = false, timeoutMs = LOAD_TIMEOUT_MS } = {},
) {
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
    const isCurrent = () => request === requestRef.current
    const work = (async () => {
      if (waitForAutoClose) await afterAutoClose()
      return loadRef.current()
    })()
    ;(async () => {
      try {
        const data = await (timeoutMs == null ? work : withTimeout(work, timeoutMs))
        if (isCurrent()) setState({ status: 'success', data, error: null })
      } catch (error) {
        if (!isCurrent()) return
        console.error('Failed to load:', error)
        setState((prev) => ({ status: 'error', data: prev.data, error }))
        if (error instanceof LoadTimeoutError) {
          work.then(
            (data) => {
              if (isCurrent()) setState({ status: 'success', data, error: null })
            },
            () => {}, // already showing the error
          )
        }
      }
    })()
  }, [waitForAutoClose, timeoutMs])

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
