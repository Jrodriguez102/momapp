// body_weight_logs reads and writes. Reads throw on error.
import { supabase } from '../lib/supabase'
import { isWeighInDue } from '../domain/calendar'

// Oldest first.
export async function fetchBodyWeightLogs() {
  const { data, error } = await supabase
    .from('body_weight_logs')
    .select('*')
    .order('logged_at', { ascending: true })
  if (error) throw error
  return data || []
}

// True when there's no body_weight_logs entry in the last 7 days.
export async function fetchWeighInDue(now = new Date()) {
  const { data, error } = await supabase
    .from('body_weight_logs')
    .select('logged_at')
    .order('logged_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return isWeighInDue(data?.logged_at, now)
}

export async function logBodyWeight(weight, loggedAt = new Date()) {
  const { error } = await supabase
    .from('body_weight_logs')
    .insert({ weight, logged_at: loggedAt.toISOString() })
  if (error) throw error
}
