import { CURRENT_BLOCK } from '@/data/program'

// The live workout's *draft*: unsaved weight/rep entries, swap choices, and
// the session effort pick. Anything logged lives in Supabase and wins on
// resume. localStorage, not sessionStorage — iOS Safari reclaims that
// readily when backgrounded.
//
// Format (unchanged since Block 01; don't change it — a draft written by the
// old screen must still resume):
//   key:   `block1:session-in-progress-<dayId>` (namespaced by block so
//          pilot-era drafts can never resume into Block 01)
//   value: JSON {"entries":{...},"swaps":{...},"sessionRpe":<n|null>}
//          entries: { [exerciseId]: [ { weight?, reps? } | undefined, ... ] }
//          swaps:   { [exerciseId]: { name, demoUrl } }

export function draftStorageKey(dayId) {
  return `block${CURRENT_BLOCK}:session-in-progress-${dayId}`
}

export const EMPTY_DRAFT = { entries: {}, swaps: {}, sessionRpe: null }

export function loadDraft(dayId) {
  try {
    const raw = localStorage.getItem(draftStorageKey(dayId))
    if (!raw) return EMPTY_DRAFT
    const parsed = JSON.parse(raw)
    return {
      entries: parsed.entries || {},
      swaps: parsed.swaps || {},
      sessionRpe: parsed.sessionRpe ?? null,
    }
  } catch {
    return EMPTY_DRAFT
  }
}

export function saveDraft(dayId, { entries, swaps, sessionRpe }) {
  try {
    localStorage.setItem(draftStorageKey(dayId), JSON.stringify({ entries, swaps, sessionRpe }))
  } catch {
    // storage unavailable — the draft just won't survive a reload
  }
}

export function clearDraft(dayId) {
  try {
    localStorage.removeItem(draftStorageKey(dayId))
  } catch {
    // storage unavailable — nothing to clear
  }
}
