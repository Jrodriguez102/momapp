// `npm run dev:fixture`: stands in for src/lib/supabase.js (vite.config.js
// aliases it only for `vite --mode fixture` dev serving — never in a build).
// An in-memory database seeded from ./seed.js answers every query; this
// module never imports supabase-js and never makes a network request.
// Everything resets on reload.
//
// URL switches (before the #): ?empty  no data at all
//                              ?blockDone  all 24 sessions done
//                              ?failEffort the first effort save fails
//                              ?nobanner   hide the "Fixture data" banner
import { createFakeSupabase } from '@/test/fakeSupabase'
import { createMemoryDb } from '@/test/memorySupabase'
import { buildFixtureDb } from './seed'

if (!import.meta.env.DEV) throw new Error('The fixture client must never be bundled into a build')

const params = new URLSearchParams(window.location.search)
const scenario = params.has('empty') ? 'empty' : params.has('blockDone') ? 'blockDone' : 'default'

// Reset: drop workout drafts / dismissals left on this origin by the last load.
for (const key of Object.keys(localStorage)) {
  if (key.startsWith('block')) localStorage.removeItem(key)
}

const db = createMemoryDb(buildFixtureDb({ scenario }))
const fake = createFakeSupabase()
let effortFailures = 0
fake.respond((query) => {
  const update = query.ops.find((op) => op.name === 'update')?.args[0]
  const effortOnly = query.table === 'workout_sessions' && update && 'session_rpe' in update && !('status' in update)
  if (params.has('failEffort') && effortOnly && effortFailures++ < 1) {
    return { data: null, error: new Error('fixture: simulated effort-save failure') }
  }
  return db.respond(query)
})

// Inspect from the console: __fixtureDb.tables.workout_sessions
window.__fixtureDb = db

if (!params.has('nobanner')) {
  const banner = document.createElement('div')
  banner.textContent = 'Fixture data · resets on reload'
  banner.setAttribute('aria-hidden', 'true')
  Object.assign(banner.style, {
    position: 'fixed', top: '4px', left: '50%', transform: 'translateX(-50%)', zIndex: '9999',
    padding: '2px 10px', borderRadius: '999px', background: '#2b1f1c', color: '#fff8f6',
    font: '600 11px/16px Inter, sans-serif', opacity: '0.85', pointerEvents: 'none',
  })
  document.body.append(banner)
}

export const supabase = fake.client
