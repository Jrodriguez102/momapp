import { createClient } from '@supabase/supabase-js'

// Swap these two values per deployment/client.
const SUPABASE_URL = 'https://mwbvobghqcrnjnxnlvik.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13YnZvYmdocWNybmpueG5sdmlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MzQwNjYsImV4cCI6MjA5OTMxMDA2Nn0.Qo76o9Q5Vg6j6b0lMucpNp7hXPuXHg6QNT4JzHOwBcA' 

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
