// ============================================================================
// PROGRAM DATA
// Single source of truth for the training program. Nothing exercise-,
// rep-, or week-related should be hardcoded into components — it all reads
// from here. Add exercises/weeks/alternatives here only.
// ============================================================================

// ---- Personalization --------------------------------------------------------
export const USER_NAME = 'Arlene'

// ---- Block structure ----------------------------------------------------------
// Block 01: 4 training days run as a queue (no fixed weekdays), 24 completed
// sessions per block. Sessions 1-20 are progressive (weeks 1-5), sessions
// 21-24 are the deload (week 6). Old pilot sessions are block 0 in Supabase;
// every new session writes CURRENT_BLOCK.
export const CURRENT_BLOCK = 1
export const SESSIONS_PER_WEEK = 4
export const WEEKS_PER_BLOCK = 6
export const SESSIONS_PER_BLOCK = SESSIONS_PER_WEEK * WEEKS_PER_BLOCK // 24
export const DELOAD_WEEK = 6
export const GOAL_WEEK = 5 // goalWeight below is the target by the end of this week

// Planned training weekdays (JS Date.getDay(): Sun=0...Sat=6) — Mon, Tue,
// Thu, Fri. Display only (week strip highlighting): the queue, not the
// weekday, decides what's next. A workout on any other day still counts,
// and a missed planned day never skips content.
export const PLANNED_WEEKDAYS = [1, 2, 4, 5]

// ---- Muscle groups -------------------------------------------------------
// Keys used everywhere volume is tallied.
export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'glutes',
  'hamstrings',
  'quads',
  'calves',
]

// Weekly set-volume thresholds per muscle group, used for any volume
// coloring. Groups without their own entry use `default`. Adjust here only.
export const VOLUME_THRESHOLDS_BY_GROUP = {
  default:   { low: 8, high: 20 },
  biceps:    { low: 4, high: 14 },
  triceps:   { low: 4, high: 14 },
  calves:    { low: 4, high: 16 },
  shoulders: { low: 6, high: 18 },
}

export function getVolumeThresholds(muscleGroup) {
  return VOLUME_THRESHOLDS_BY_GROUP[muscleGroup] || VOLUME_THRESHOLDS_BY_GROUP.default
}

// Exercises that don't take an external weight (bodyweight movements).
// Drives conditional UI (hides the weight input) for any exercise, present
// or future, matched by name.
export const BODYWEIGHT_EXERCISES = new Set([
  // none in Block 01 — every current exercise is loaded
])

// ---- Week metadata across a 6-week block ------------------------------------
// Week 6 is always an auto-applied deload — no toggle, no override.
// weekType: 'progressive' | 'deload'
export function getWeekMeta(weekInBlock) {
  switch (weekInBlock) {
    case 1:
      return { weekType: 'progressive', label: 'Week 1', volumeMultiplier: 1, rpeCap: 8, note: 'Calibration week — find honest working weights.' }
    case 2:
      return { weekType: 'progressive', label: 'Week 2', volumeMultiplier: 1, rpeCap: 8, note: 'Add reps first, then weight once you hit the top of the range.' }
    case 3:
      return { weekType: 'progressive', label: 'Week 3', volumeMultiplier: 1, rpeCap: 8, note: 'Keep building — small jumps where the top of the range felt controlled.' }
    case 4:
      return { weekType: 'progressive', label: 'Week 4', volumeMultiplier: 1, rpeCap: 8, note: 'Keep building — small jumps where the top of the range felt controlled.' }
    case 5:
      return { weekType: 'progressive', label: 'Week 5', volumeMultiplier: 1, rpeCap: 8, note: 'Goal week — aim for your block goal weights.' }
    case DELOAD_WEEK:
      return { weekType: 'deload', label: 'Week 6 (Deload)', volumeMultiplier: 0.5, rpeCap: 6, note: 'Deload — sets are automatically halved. Trust it.' }
    default:
      return { weekType: 'progressive', label: `Week ${weekInBlock}`, volumeMultiplier: 1, rpeCap: 8, note: '' }
  }
}

// Given a raw set count and the current week, return the actual prescribed
// set count after deload reduction is applied.
export function applyDeloadToSets(baseSets, weekInBlock) {
  const { weekType } = getWeekMeta(weekInBlock)
  if (weekType !== 'deload') return baseSets
  return Math.max(2, Math.round(baseSets * 0.5))
}

// ---- Effort / difficulty options ---------------------------------------------
// End-of-session effort, 1-10, written to workout_sessions.session_rpe.
// Anchors are display-only labels for ranges of the scale.
export const SESSION_RPE_ANCHORS = [
  { min: 1, max: 3, label: 'Easy' },
  { min: 4, max: 6, label: 'Moderate' },
  { min: 7, max: 8, label: 'Hard' },
  { min: 9, max: 10, label: 'Max' },
]

// Last-set difficulty tap, shown per exercise. `rpe` is what gets written to
// exercise_logs.rpe — only ever on the highest-numbered logged set of that
// exercise in the session.
export const LAST_SET_DIFFICULTY_OPTIONS = [
  { value: '3+', label: '3+ left', rpe: 7 },
  { value: '1-2', label: '1–2 left', rpe: 8.5 },
  { value: '0', label: '0 left', rpe: 10 },
]

// Legacy (pilot) session effort tap. No longer written — kept only so
// History can label the old workout_sessions.effort values.
export const EFFORT_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'hard', label: 'Hard' },
  { value: 'very_hard', label: 'Very Hard' },
]

// ---- Set effort copy ----------------------------------------------------------
// `cue` is the one-line target shown on every exercise card (the program's
// rpe '7-8', in plain words); the explainer sits behind the info icon.
export const RPE_EXPLAINER = {
  cue: 'Finish each set with ~2–3 reps left',
  title: 'How hard should sets feel?',
  body:
    "Stop each set when you have about 2–3 good reps left in the tank — hard, " +
    "but with clean form. After the last set of each exercise, tap how many " +
    "reps you had left: 3+, 1–2, or 0. That tap (not just the weight) is what " +
    "the app uses to decide when to suggest adding weight.",
}

// ---- The program ------------------------------------------------------------
// Days run as a queue in array order: Upper A -> Lower A -> Upper B -> Lower B.
// Exercise order = priority (last items get dropped first if short on time).
// estimatedMinutes is a fixed, display-only "about N min" for Home (sets x
// ~2.5 min incl. rest, rounded to 5); it never changes what's saved.
//
// Each exercise: id (stable kebab-case of the name — the same movement on two
// days shares an id), name, demoUrl, sets, repRange, rpe (display only),
// muscleGroups[], alternatives[] (exactly 2, { name, demoUrl }),
// supersetGroup (optional, pairs exercises done back-to-back), and
// weight: { unit, startWeight, goalWeight, increment, confidence }.
// Weights are per hand / per side for DB and unilateral movements.
// confidence 'low' = no weight suggestion until she's logged it in 2 sessions.
//
// The 21 movements are locked for the block. Alternatives are only for
// equipment or comfort problems; logs (and weights) are tracked per name.
const LEG_PRESS_CALF_RAISE = {
  id: 'leg-press-calf-raise',
  name: 'Leg Press Calf Raise',
  demoUrl: 'https://www.youtube.com/shorts/DqT1h2_hQJ4',
  sets: 3,
  repRange: '12-15',
  rpe: '7-8',
  muscleGroups: ['calves'],
  alternatives: [
    { name: 'Seated Calf Raise', demoUrl: 'https://www.youtube.com/shorts/qJjqt0Q2WqU' },
    { name: 'Standing Calf Raise', demoUrl: 'https://www.youtube.com/shorts/B30JglFGx8Y' },
  ],
  weight: { unit: 'lb', startWeight: 60, goalWeight: 80, increment: 10, confidence: 'low' },
}

export const PROGRAM_DAYS = [
  {
    id: 'day-1',
    name: 'Upper A (Chest / Back)',
    shortLabel: 'Upper A',
    estimatedMinutes: 50,
    exercises: [
      {
        id: 'db-bench-press',
        name: 'DB Bench Press',
        demoUrl: 'https://www.youtube.com/shorts/q--6_PuEV_c',
        sets: 4,
        repRange: '8-10',
        rpe: '7-8',
        muscleGroups: ['chest'],
        alternatives: [
          { name: 'Chest Press Machine', demoUrl: 'https://www.youtube.com/shorts/DgrjO44tWPs' },
          { name: 'Smith Machine Bench Press', demoUrl: 'https://www.youtube.com/shorts/ZG4eV1yEq9A' },
        ],
        weight: { unit: 'lb', startWeight: 35, goalWeight: 40, increment: 5, confidence: 'high' },
      },
      {
        id: 'lat-pulldown',
        name: 'Lat Pulldown',
        demoUrl: 'https://www.youtube.com/shorts/bNmvKpJSWKM',
        sets: 3,
        repRange: '10-12',
        rpe: '7-8',
        muscleGroups: ['back'],
        alternatives: [
          { name: 'Assisted Pull-Up Machine', demoUrl: 'https://www.youtube.com/shorts/JcGwiiGyYFA' },
          { name: 'Close-Grip Pulldown', demoUrl: 'https://www.youtube.com/shorts/Buy_B0xBq1I' },
        ],
        weight: { unit: 'lb', startWeight: 90, goalWeight: 100, increment: 5, confidence: 'high' },
      },
      {
        id: 'seated-db-shoulder-press',
        name: 'Seated DB Shoulder Press',
        demoUrl: 'https://www.youtube.com/shorts/2D0TyoHv_EY',
        sets: 3,
        repRange: '8-10',
        rpe: '7-8',
        muscleGroups: ['shoulders'],
        alternatives: [
          { name: 'Machine Shoulder Press', demoUrl: 'https://www.youtube.com/shorts/6v4nrRVySj0' },
          { name: 'Smith Machine Overhead Press', demoUrl: 'https://www.youtube.com/shorts/kkNYgqvrAEc' },
        ],
        weight: { unit: 'lb', startWeight: 15, goalWeight: 20, increment: 2.5, confidence: 'low' },
      },
      {
        id: 'seated-cable-row',
        name: 'Seated Cable Row',
        demoUrl: 'https://www.youtube.com/shorts/8QuMq1GMMng',
        sets: 3,
        repRange: '10-12',
        rpe: '7-8',
        muscleGroups: ['back'],
        alternatives: [
          { name: 'DB Row (bench-supported)', demoUrl: 'https://www.youtube.com/shorts/WkFX6_GxAs8' },
          { name: 'Chest-Supported Row Machine', demoUrl: 'https://www.youtube.com/shorts/FTwvmczf7bE' },
        ],
        weight: { unit: 'lb', startWeight: 55, goalWeight: 65, increment: 5, confidence: 'low' },
      },
      {
        id: 'tricep-rope-pushdown',
        name: 'Tricep Rope Pushdown',
        demoUrl: 'https://www.youtube.com/shorts/IVoL1BAEY6M',
        sets: 3,
        repRange: '10-12',
        rpe: '7-8',
        muscleGroups: ['triceps'],
        alternatives: [
          { name: 'DB Skull Crusher', demoUrl: 'https://www.youtube.com/shorts/WLQizQXoeIg' },
          { name: 'Tricep Dip Machine', demoUrl: 'https://www.youtube.com/shorts/8CvOC9Db3Yw' },
        ],
        supersetGroup: 'day1-superset-a',
        weight: { unit: 'lb', startWeight: 35, goalWeight: 40, increment: 5, confidence: 'high' },
      },
      {
        id: 'db-bicep-curl',
        name: 'DB Bicep Curl',
        demoUrl: 'https://www.youtube.com/shorts/0OA-DqdTyZA',
        sets: 3,
        repRange: '10-12',
        rpe: '7-8',
        muscleGroups: ['biceps'],
        alternatives: [
          { name: 'EZ-Bar Curl', demoUrl: 'https://www.youtube.com/shorts/d2r5TCqnR4Y' },
          { name: 'Preacher Curl Machine', demoUrl: 'https://www.youtube.com/shorts/Htw-s61mOw0' },
        ],
        supersetGroup: 'day1-superset-a',
        weight: { unit: 'lb', startWeight: 15, goalWeight: 20, increment: 2.5, confidence: 'high' },
      },
    ],
  },
  {
    id: 'day-2',
    name: 'Lower A (Quad / Glute)',
    shortLabel: 'Lower A',
    estimatedMinutes: 50,
    exercises: [
      {
        id: 'hack-squat-machine',
        name: 'Hack Squat Machine',
        demoUrl: 'https://www.youtube.com/shorts/g9i05umL5vc',
        sets: 4,
        repRange: '10-12',
        rpe: '7-8',
        muscleGroups: ['quads'],
        alternatives: [
          { name: 'Pendulum Squat Machine', demoUrl: 'https://www.youtube.com/shorts/89pJBhEAizI' },
          { name: 'Goblet Squat', demoUrl: 'https://www.youtube.com/shorts/t__Um6KjJkc' },
        ],
        weight: { unit: 'lb', startWeight: 110, goalWeight: 130, increment: 10, confidence: 'high' },
      },
      {
        id: 'step-up',
        name: 'Step-Up',
        demoUrl: 'https://www.youtube.com/shorts/8q9LVgN2RD4',
        sets: 3,
        repRange: '10-12 / leg',
        rpe: '7-8',
        muscleGroups: ['quads', 'glutes'],
        alternatives: [
          { name: 'Reverse Lunge (Smith)', demoUrl: 'https://www.youtube.com/shorts/D26udvEstHk' },
          { name: 'Bulgarian Split Squat', demoUrl: 'https://www.youtube.com/shorts/9p5e2BSvoLs' },
        ],
        weight: { unit: 'lb', startWeight: 30, goalWeight: 40, increment: 5, confidence: 'low' },
      },
      {
        id: 'seated-leg-curl',
        name: 'Seated Leg Curl',
        demoUrl: 'https://www.youtube.com/shorts/xdbEG3xGLI8',
        sets: 3,
        repRange: '12-15',
        rpe: '7-8',
        muscleGroups: ['hamstrings'],
        alternatives: [
          { name: 'Lying Leg Curl', demoUrl: 'https://www.youtube.com/shorts/QwmpZXukkoQ' },
          { name: 'Standing Single-Leg Curl', demoUrl: 'https://www.youtube.com/shorts/idvJj2g3AzE' },
        ],
        weight: { unit: 'lb', startWeight: 145, goalWeight: 160, increment: 5, confidence: 'high' },
      },
      {
        id: 'cable-hip-abduction',
        name: 'Cable Hip Abduction',
        demoUrl: 'https://www.youtube.com/shorts/_UYW5ym1YKE',
        sets: 3,
        repRange: '15-20',
        rpe: '7-8',
        muscleGroups: ['glutes'],
        alternatives: [
          { name: 'Hip Abduction Machine', demoUrl: 'https://www.youtube.com/shorts/WOv7Aca6r-0' },
          { name: 'Banded Lateral Walk', demoUrl: 'https://www.youtube.com/shorts/p55m0Hw7UoA' },
        ],
        weight: { unit: 'lb', startWeight: 30, goalWeight: 40, increment: 5, confidence: 'high' },
      },
      LEG_PRESS_CALF_RAISE,
    ],
  },
  {
    id: 'day-3',
    name: 'Upper B (Back / Shoulder / Arm)',
    shortLabel: 'Upper B',
    estimatedMinutes: 50,
    exercises: [
      {
        id: 'incline-machine-press',
        name: 'Incline Machine Press',
        demoUrl: 'https://www.youtube.com/shorts/o0Ud3RU59hw',
        sets: 4,
        repRange: '10-12',
        rpe: '7-8',
        muscleGroups: ['chest'],
        alternatives: [
          { name: 'Incline DB Press', demoUrl: 'https://www.youtube.com/shorts/8fXfwG4ftaQ' },
          { name: 'Cable Incline Fly', demoUrl: 'https://www.youtube.com/shorts/8rjNPttLJcw' },
        ],
        weight: { unit: 'lb', startWeight: 30, goalWeight: 35, increment: 5, confidence: 'low' },
      },
      {
        id: 'db-single-arm-row',
        name: 'DB Single-Arm Row',
        demoUrl: 'https://www.youtube.com/shorts/H8jf3DwlIlo',
        sets: 3,
        repRange: '10-12 / side',
        rpe: '7-8',
        muscleGroups: ['back'],
        alternatives: [
          { name: 'Cable Single-Arm Row', demoUrl: 'https://www.youtube.com/shorts/bLVeOunB-c0' },
          { name: 'Machine Row (single-arm)', demoUrl: 'https://www.youtube.com/shorts/Y5fGGU0WuNQ' },
        ],
        weight: { unit: 'lb', startWeight: 45, goalWeight: 50, increment: 5, confidence: 'high' },
      },
      {
        id: 'rear-delt-fly',
        name: 'Rear Delt Fly',
        demoUrl: 'https://www.youtube.com/shorts/9WpNWAM782Y',
        sets: 3,
        repRange: '12-15',
        rpe: '7-8',
        muscleGroups: ['shoulders'],
        alternatives: [
          { name: 'Reverse Pec Deck', demoUrl: 'https://www.youtube.com/shorts/BmJHBBZRpZg' },
          { name: 'Cable Rear Delt Fly', demoUrl: 'https://www.youtube.com/shorts/FeERX9UwspY' },
        ],
        weight: { unit: 'lb', startWeight: 10, goalWeight: 15, increment: 2.5, confidence: 'high' },
      },
      {
        id: 'cable-lateral-raise',
        name: 'Cable Lateral Raise',
        demoUrl: 'https://www.youtube.com/shorts/IcTyO2SyX14',
        sets: 3,
        repRange: '12-15',
        rpe: '7-8',
        muscleGroups: ['shoulders'],
        alternatives: [
          { name: 'DB Lateral Raise', demoUrl: 'https://www.youtube.com/shorts/Myim1WH6Qec' },
          { name: 'Machine Lateral Raise', demoUrl: 'https://www.youtube.com/shorts/AVPP4MJ6HeQ' },
        ],
        weight: { unit: 'lb', startWeight: 10, goalWeight: 12.5, increment: 2.5, confidence: 'high' },
      },
      {
        id: 'overhead-cable-tricep-ext',
        name: 'Overhead Cable Tricep Ext',
        demoUrl: 'https://www.youtube.com/shorts/7hx0-DZgdl8',
        sets: 3,
        repRange: '10-12',
        rpe: '7-8',
        muscleGroups: ['triceps'],
        alternatives: [
          { name: 'DB Skull Crusher', demoUrl: 'https://www.youtube.com/shorts/WLQizQXoeIg' },
          { name: 'Tricep Dip Machine', demoUrl: 'https://www.youtube.com/shorts/8CvOC9Db3Yw' },
        ],
        supersetGroup: 'day3-superset-b',
        weight: { unit: 'lb', startWeight: 25, goalWeight: 30, increment: 5, confidence: 'low' },
      },
      {
        id: 'cable-curl',
        name: 'Cable Curl',
        demoUrl: 'https://www.youtube.com/shorts/CrbTqNOlFgE',
        sets: 3,
        repRange: '10-12',
        rpe: '7-8',
        muscleGroups: ['biceps'],
        alternatives: [
          { name: 'EZ-Bar Curl', demoUrl: 'https://www.youtube.com/shorts/d2r5TCqnR4Y' },
          { name: 'Preacher Curl Machine', demoUrl: 'https://www.youtube.com/shorts/Htw-s61mOw0' },
        ],
        supersetGroup: 'day3-superset-b',
        weight: { unit: 'lb', startWeight: 20, goalWeight: 25, increment: 5, confidence: 'low' },
      },
    ],
  },
  {
    id: 'day-4',
    name: 'Lower B (Glute / Hamstring)',
    shortLabel: 'Lower B',
    estimatedMinutes: 45,
    exercises: [
      {
        id: 'smith-machine-hip-thrust',
        name: 'Smith Machine Hip Thrust',
        demoUrl: 'https://www.youtube.com/shorts/9JftONhm6g4',
        sets: 3,
        repRange: '10-12',
        rpe: '7-8',
        muscleGroups: ['glutes'],
        alternatives: [
          { name: 'Single-Leg DB Hip Thrust', demoUrl: 'https://www.youtube.com/shorts/3suM3LwVlVM' },
          { name: 'Glute Bridge Machine', demoUrl: 'https://www.youtube.com/shorts/Mli3p6MHJCI' },
        ],
        weight: { unit: 'lb', startWeight: 90, goalWeight: 110, increment: 10, confidence: 'low' },
      },
      {
        id: 'romanian-deadlift',
        name: 'Romanian Deadlift',
        demoUrl: 'https://www.youtube.com/shorts/qBbB4pgOSS0',
        sets: 4,
        repRange: '10-12',
        rpe: '7-8',
        muscleGroups: ['hamstrings', 'glutes'],
        alternatives: [
          { name: 'DB RDL', demoUrl: 'https://www.youtube.com/shorts/wiekN4aIJ0g' },
          { name: 'Cable Pull-Through', demoUrl: 'https://www.youtube.com/shorts/d3sH6fbCBP0' },
        ],
        weight: { unit: 'lb', startWeight: 95, goalWeight: 115, increment: 5, confidence: 'high' },
      },
      {
        id: 'leg-press',
        name: 'Leg Press',
        demoUrl: 'https://www.youtube.com/shorts/nDh_BlnLCGc',
        sets: 3,
        repRange: '10-12',
        rpe: '7-8',
        muscleGroups: ['quads'],
        alternatives: [
          { name: 'Hack Squat Machine', demoUrl: 'https://www.youtube.com/shorts/g9i05umL5vc' },
          { name: 'Pendulum Squat Machine', demoUrl: 'https://www.youtube.com/shorts/89pJBhEAizI' },
        ],
        weight: { unit: 'lb', startWeight: 290, goalWeight: 320, increment: 10, confidence: 'high' },
      },
      {
        id: 'cable-glute-kickback',
        name: 'Cable Glute Kickback',
        demoUrl: 'https://www.youtube.com/shorts/hQKQZdCAntQ',
        sets: 3,
        repRange: '12-15 / leg',
        rpe: '7-8',
        muscleGroups: ['glutes'],
        alternatives: [
          { name: 'Glute Kickback Machine', demoUrl: 'https://www.youtube.com/shorts/3fBptAH0Rnw' },
          { name: 'Donkey Kick', demoUrl: 'https://www.youtube.com/shorts/XRmrRiIdR2o' },
        ],
        weight: { unit: 'lb', startWeight: 50, goalWeight: 60, increment: 5, confidence: 'high' },
      },
      LEG_PRESS_CALF_RAISE,
    ],
  },
]
