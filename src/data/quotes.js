// ============================================================================
// DASHBOARD QUOTES
// One rotates in on the Dashboard each day. Kept separate from program.js
// since this is presentation/motivation content, not program logic.
// ============================================================================

export const DAILY_QUOTES = [
  "Strong today, stronger tomorrow.",
  "Consistency beats intensity.",
  "Small sets, big changes.",
  "You don't have to be extreme, just consistent.",
  "Progress, not perfection.",
  "Showing up is half the work.",
  "Every rep counts.",
  "The only bad workout is the one that didn't happen.",
  "Trust the process — the plan is working even on quiet weeks.",
  "Discipline is choosing between what you want now and what you want most.",
  "You're not starting over, you're starting from experience.",
  "Strength is built one session at a time.",
  "A little progress each day adds up to big results.",
  "Take care of your body — it's the only place you have to live.",
  "Energy and persistence conquer all things.",
  "Push yourself, because no one else is going to do it for you.",
  "The body achieves what the mind believes.",
  "Today's effort is tomorrow's strength.",
  "Don't count the days, make the days count.",
  "Slow progress is still progress.",
  "You are one workout away from a better mood.",
  "Your only competition is who you were yesterday.",
  "Great things never come from comfort zones.",
  "Rest when you need to, but don't quit.",
  "Motivation gets you started, habit keeps you going.",
  "Every day is a chance to get stronger.",
  "Believe you can, and you're halfway there.",
  "Hard work beats talent when talent doesn't work hard.",
  "It never gets easier, you just get stronger.",
  "Fall in love with taking care of yourself.",
]

// Deterministic per calendar day — same quote all day, rotates at midnight,
// no network/state needed. Cycles through the list and repeats.
export function getDailyQuote(date = new Date()) {
  const startOfYear = new Date(date.getFullYear(), 0, 0)
  const diff = date - startOfYear
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24))
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length]
}
