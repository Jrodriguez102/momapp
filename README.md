# Strength & Tone — Workout App

React + Vite + Tailwind + Supabase workout tracker, built from the same
template pattern as the previous app (HashRouter, data-driven program,
gh-pages deploy).

## What's in Phase 1

- Full Block 1 program (`src/data/program.js`) — 5-day Upper/Lower x2 +
  Full Body split, seeded starting weights from her real lower-body
  session, 2-3 alternatives per exercise, 4-week block with auto-deload
  logic
- Supabase schema (`supabase/schema.sql`) — `workout_sessions`,
  `exercise_logs`, `personal_records`, RLS enabled
- App shell: Dashboard, Workout Session flow, Progress/analytics tab
- Body diagram (front/back SVG) color-coded by weekly training volume
  per muscle group
- RPE logging with an explainer tooltip, end-of-session effort tap,
  "last time you lifted X" reminders, exercise swap/alternatives,
  sessionStorage persistence for in-progress sessions

## Setup

1. **Create a Supabase project** at supabase.com, then run
   `supabase/schema.sql` in the SQL editor.
2. **Add your credentials** in `src/lib/supabase.js`:
   ```js
   const SUPABASE_URL = 'https://xxxx.supabase.co'
   const SUPABASE_ANON_KEY = 'your-anon-key'
   ```
3. **Set the program start date** in `src/pages/Dashboard.jsx` and
   `src/pages/WorkoutSession.jsx` (`PROGRAM_START_DATE`) to whatever
   Monday she starts.
4. **Install and run locally**:
   ```bash
   npm install
   npm run dev
   ```

## Deploying to GitHub Pages

1. Update `base` in `vite.config.js` to match your repo name, e.g.
   `base: '/mom-workout-app/'`.
2. Push this repo to GitHub.
3. Run:
   ```bash
   npm run deploy
   ```
   This builds and pushes to the `gh-pages` branch only — it does **not**
   commit your source changes to `main`. Commit/push those separately.
4. Enable GitHub Pages in repo settings, pointing at the `gh-pages` branch.

## Still to build (Phase 2/3 per our plan)

- Weekly volume tracker as its own numbers view (diagram is done, a
  supporting list view could be added)
- Block 2+ program data (exercise/rep-range rotation to avoid staleness)
- Any additional polish pass on mobile responsiveness / animations
