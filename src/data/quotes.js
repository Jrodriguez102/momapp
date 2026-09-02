// ============================================================================
// DASHBOARD QUOTES
// One rotates in on the Dashboard each day. Kept separate from program.js
// since this is presentation/motivation content, not program logic.
// ============================================================================

export const DAILY_QUOTES = [
  "Don't wait for the waves to stop — build a stronger boat.",
  "Progress, not perfection.",
  "Showing up is half the work.",
  "Small sets, big changes.",
  "Don't count the days, make the days count.",
  "Believe you can, and you're halfway there.",
  "It never gets easier, you just get stronger.",
  "Stack the days.",
  "Make today count.",
  "Prove it to yourself.",
  "You don't need motivation, you need discipline.",
  "Push past comfortable.",
  "Take ownership.",
  "Results are built, not given.",
  "The work is yours.",
  "What you do today, builds tomorrow.",
  "Trust the process.",
  "Set the standard.",
  "Discomfort is the price of progress.",
  "No one's coming to do it for you.",
  "Consistency is a decision, not a feeling.",
  "Earn it today.",
  "Do the work you don't feel like doing.",
  "Strong is a habit, not an event.",
  "Show up even when it's inconvenient.",
  "The standard doesn't lower because you're tired.",
  "You're the only one keeping score.",
  "Effort compounds.",
  "Build the habit, not the excuse.",
  "Today's rep is tomorrow's proof.",
]

// Deterministic per calendar day — same quote all day, rotates at midnight,
// no network/state needed. Cycles through the list and repeats.
export function getDailyQuote(date = new Date()) {
  const startOfYear = new Date(date.getFullYear(), 0, 0)
  const diff = date - startOfYear
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24))
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length]
}
