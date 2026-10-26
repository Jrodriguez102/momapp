# Strength & Tone

A mobile web app for one person's lifting program: Arlene's Block 01, four
workouts run as a queue (Upper A → Lower A → Upper B → Lower B), 24 sessions
per block with an automatic deload in week 6. It suggests each lift's weight
from her last session, logs every set, keeps her history editable for 48
hours, and tracks body weight and strength trends. It's built for her phone,
added to the Home Screen.

Single user, no login: the Supabase anon key in `src/lib/supabase.js` is
public by design, and the app lives at an unlisted URL.

## Stack

- React 19 + Vite, `HashRouter` (works on GitHub Pages without rewrites)
- Tailwind CSS v4 (`@tailwindcss/vite`) with design tokens in
  `src/ui/tokens.css`
- shadcn/ui components on Radix, restyled in `src/ui/`; Sonner toasts;
  lucide icons; Recharts for the Progress charts
- Supabase (Postgres, `momapp` schema of a shared project)
- Vitest + Testing Library; oxlint

## Scripts

Run from this folder (`momapp/`, the repo root).

| Command | What it does |
|---|---|
| `npm run dev` | Dev server against the **real** Supabase data |
| `npm run dev:fixture` | The app on fake in-memory data at `http://<this-machine>:5199/momapp/` (open it on a phone on the same Wi-Fi). Never contacts Supabase and resets on reload. Use it for anything that writes. URL switches before the `#`: `?empty`, `?blockDone`, `?failEffort`, `?nobanner` |
| `npm test` | Unit and component tests |
| `npm run lint` | oxlint |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the build locally at `/momapp/` |
| `npm run deploy` | Build, then publish `dist/` to the `gh-pages` branch (the live site) |

## Deploying

Deploying is manual:

1. Commit your changes on `main` and run `npm run lint`, `npm test` and
   `npm run build`.
2. Check the build with `npm run preview` at `http://localhost:4173/momapp/`.
3. Run `npm run deploy`.

**Pushing to `main` does not update the live site.** Only `npm run deploy`
does, and it publishes whatever is in your working copy — it doesn't push
your source to `main` either, so push that separately. Avoid deploying
while a workout is in progress on her phone.

`base` in `vite.config.js` must match the GitHub repo name (`/momapp/`).

## Data

Tables (`workout_sessions`, `exercise_logs`, `body_weight_logs`) are
described in `supabase/schema.sql`. Schema changes are hand-run SQL in the
Supabase SQL editor, never from the app. What the app writes is a fixed
contract — see `CLAUDE.md` before changing anything that saves data.

## Code layout

- `src/data/program.js` — the program itself (days, exercises, sets, rep
  ranges, alternatives, weights). Change the program only here.
- `src/domain/` — pure rules (block and queue math, progression, session
  rules, calendar, metrics)
- `src/services/` — all Supabase reads and writes
- `src/features/` — the screens: `home`, `workout`, `history`, `progress`
- `src/ui/` — design-system components and tokens
- `src/dev/fixture/` — fake data for `npm run dev:fixture` and tests

`CLAUDE.md` has the detailed rules (queue, progression, auto-close, edit
window, styling).
