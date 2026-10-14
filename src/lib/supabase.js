import { createClient } from '@supabase/supabase-js'

// Shared Supabase project (workout-app). This app's tables live in the "momapp" schema.
const SUPABASE_URL = 'https://glzpjrmwrraxeldwyanq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsenBqcm13cnJheGVsZHd5YW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MzE0MzQsImV4cCI6MjA5NzIwNzQzNH0.mZyLeWySwlFvVuDUTBrnhp9Lea1M52l68JGGcumK0Ns'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: 'momapp' },
})