import { useEffect } from 'react'
import { BODY_WEIGHT_LOGGED_EVENT, fetchWeighInDue } from '@/services/bodyWeightApi'
import { useAsyncData } from '@/hooks/useAsyncData'

// Whether the weekly weigh-in is due (no body_weight_logs entry in 7 days).
// Re-checked whenever `key` changes (pass the route) and right after a
// weigh-in is logged. A failed check counts as "not due" — never nag.
export function useWeighInDue(key) {
  const { data, reload } = useAsyncData(() => fetchWeighInDue().catch(() => false), { key, timeoutMs: null })

  useEffect(() => {
    window.addEventListener(BODY_WEIGHT_LOGGED_EVENT, reload)
    return () => window.removeEventListener(BODY_WEIGHT_LOGGED_EVENT, reload)
  }, [reload])

  return data === true
}
