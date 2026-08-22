// ============================================================================
// PROGRAM DATA
// Single source of truth for the training program. Nothing exercise-,
// rep-, or week-related should be hardcoded into components — it all reads
// from here. Add exercises/weeks/alternatives here only.
// ============================================================================

// ---- Personalization --------------------------------------------------------
export const USER_NAME = 'Arlene'

// ---- Muscle groups -------------------------------------------------------
// Keys used everywhere volume is tallied (body diagram, weekly volume tab).
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

// Weekly set-volume thresholds per muscle group, used to color the body
// diagram and volume tracker. Defaults follow common hypertrophy research
// ranges — adjust here if needed, nowhere else.
export const VOLUME_THRESHOLDS = {
  low: 8,   // < 8 sets/week -> 'low' (yellow)
  high: 20, // > 20 sets/week -> 'high' (red)
  // between low and high -> 'optimal' (green)
}

// Exercises that don't take an external weight (bodyweight movements).
// Drives conditional UI (hides the weight input) for any exercise, present
// or future, matched by name.
export const BODYWEIGHT_EXERCISES = new Set([
  // none in Block 1 — every current exercise is loaded
])

// ---- Seeded starting weights ----------------------------------------------
// Real numbers from her most recent lower-body session. Everything else
// starts blank and is self-calibrated in Week 1 (see getLastLogged in
// helpers.js) — the app never guesses a number for her.
export const SEEDED_WEIGHTS = {
  'single-leg-db-hip-thrust': { weight: 20, unit: 'lb' },
  'kb-sumo-deadlift': { weight: 70, unit: 'lb' },
  'reverse-lunge-smith': { weight: 25, unit: 'lb' }, // per side
  'lifted-heel-squat': { weight: 30, unit: 'lb' },
}

// ---- Rep range progression across a 4-week block --------------------------
// Week 4 is always an auto-applied deload — no toggle, no override.
// weekType: 'progressive' | 'deload'
export function getWeekMeta(weekInBlock) {
  switch (weekInBlock) {
    case 1:
      return { weekType: 'progressive', label: 'Week 1', volumeMultiplier: 1, rpeCap: 8, note: 'Baseline week.' }
    case 2:
      return { weekType: 'progressive', label: 'Week 2', volumeMultiplier: 1, rpeCap: 8, note: 'Add weight where last week felt controlled.' }
    case 3:
      return { weekType: 'progressive', label: 'Week 3', volumeMultiplier: 1, rpeCap: 8, note: 'Peak week — push another small jump.' }
    case 4:
      return { weekType: 'deload', label: 'Week 4 (Deload)', volumeMultiplier: 0.5, rpeCap: 6, note: 'Deload — sets and weight are automatically reduced. Trust it.' }
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

// ---- Effort / session-note options -----------------------------------------
// End-of-session quick tap. Logged for visibility only — no auto-adjustment.
export const EFFORT_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'hard', label: 'Hard' },
  { value: 'very_hard', label: 'Very Hard' },
]

// ---- RPE explainer copy -----------------------------------------------------
export const RPE_EXPLAINER = {
  title: 'What is RPE?',
  body:
    "RPE (Rate of Perceived Exertion) is a 1-10 scale for how hard a set felt. " +
    "10 means you couldn't have done another rep. An RPE of 7-8 means you had " +
    "about 2-3 reps left in the tank when you stopped. Logging RPE — not just " +
    "weight — helps track true effort day to day, since the same weight can " +
    "feel different depending on sleep, stress, or recovery.",
}

// ---- Weekly schedule ---------------------------------------------------------
// Fixed weekday assignment: Day 1-5 always fall on Mon-Fri, in program order.
// Weekdays use JS Date.getDay() convention (Sun=0...Sat=6). Weekends have no
// entry here and are treated as rest days everywhere this is consumed.
export const SCHEDULE_WEEKDAYS = [1, 2, 3, 4, 5] // Mon, Tue, Wed, Thu, Fri

export function getProgramDayForWeekday(weekday) {
  const index = SCHEDULE_WEEKDAYS.indexOf(weekday)
  return index === -1 ? null : PROGRAM_DAYS[index]
}

// ---- The program ------------------------------------------------------------
// Each exercise: id, name, sets, repRange, rpe, muscleGroups[], alternatives[],
// isCardio, supersetGroup (optional, pairs exercises done back-to-back).
export const PROGRAM_DAYS = [
  {
    id: 'day-1',
    name: 'Upper (Push Emphasis)',
    shortLabel: 'Push',
    hasCardio: true,
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
          { name: 'Smith Machine Bench Press', demoUrl: 'https://www.youtube.com/shorts/ZG4eV1yEq9A' },
          { name: 'Chest Press Machine', demoUrl: 'https://www.youtube.com/shorts/DgrjO44tWPs' },
          { name: 'Hammer Strength Chest Press', demoUrl: 'https://www.youtube.com/shorts/Nbh72taMf4w' },
        ],
      },
      {
        id: 'seated-db-shoulder-press',
        name: 'Seated DB Shoulder Press',
        demoUrl: 'https://www.youtube.com/shorts/2D0TyoHv_EY',
        sets: 3,
        repRange: '8-10',
        rpe: '7',
        muscleGroups: ['shoulders'],
        alternatives: [
          { name: 'Machine Shoulder Press', demoUrl: 'https://www.youtube.com/shorts/6v4nrRVySj0' },
          { name: 'Arnold Press', demoUrl: 'https://www.youtube.com/shorts/wRlIuexTowA' },
          { name: 'Smith Machine Overhead Press', demoUrl: 'https://www.youtube.com/shorts/kkNYgqvrAEc' },
        ],
      },
      {
        id: 'incline-db-press',
        name: 'Incline DB Press',
        demoUrl: 'https://www.youtube.com/shorts/8fXfwG4ftaQ',
        sets: 3,
        repRange: '10-12',
        rpe: '7',
        muscleGroups: ['chest'],
        alternatives: [
          { name: 'Incline Machine Press', demoUrl: 'https://www.youtube.com/shorts/o0Ud3RU59hw' },
          { name: 'Cable Incline Fly', demoUrl: 'https://www.youtube.com/shorts/8rjNPttLJcw' },
          { name: 'Low-to-High Cable Fly', demoUrl: 'https://www.youtube.com/shorts/62AIwPBj8v4' },
        ],
      },
      {
        id: 'cable-lateral-raise',
        name: 'Cable Lateral Raise',
        demoUrl: 'https://www.youtube.com/shorts/IcTyO2SyX14',
        sets: 3,
        repRange: '12-15',
        rpe: '7',
        muscleGroups: ['shoulders'],
        alternatives: [
          { name: 'DB Lateral Raise', demoUrl: 'https://www.youtube.com/shorts/Myim1WH6Qec' },
          { name: 'Machine Lateral Raise', demoUrl: 'https://www.youtube.com/shorts/AVPP4MJ6HeQ' },
          { name: 'Lean-Away Cable Raise', demoUrl: 'https://www.youtube.com/shorts/-_8jT_KQXbs' },
        ],
      },
      {
        id: 'tricep-rope-pushdown',
        name: 'Tricep Rope Pushdown',
        demoUrl: 'https://www.youtube.com/shorts/IVoL1BAEY6M',
        sets: 3,
        repRange: '10-12',
        rpe: '7',
        muscleGroups: ['triceps'],
        alternatives: [
          { name: 'Overhead Cable Tricep Ext', demoUrl: 'https://www.youtube.com/shorts/7hx0-DZgdl8' },
          { name: 'DB Skull Crusher', demoUrl: 'https://www.youtube.com/shorts/WLQizQXoeIg' },
          { name: 'Tricep Dip Machine', demoUrl: 'https://www.youtube.com/shorts/8CvOC9Db3Yw' },
        ],
      },
      {
        id: 'cardio-incline-walk-1',
        name: 'Incline Treadmill Walk',
        demoUrl: 'https://www.youtube.com/shorts/Y6CW8JFt3d8',
        isCardio: true,
        cardioType: 'steady-state',
        duration: '12 min',
        muscleGroups: [],
        alternatives: [
          { name: 'Stationary Bike', demoUrl: 'https://www.youtube.com/shorts/wywdVLIdvMg' },
          { name: 'StairMaster', demoUrl: 'https://www.youtube.com/shorts/2TCWTSuCC5I' },
          { name: 'Elliptical', demoUrl: 'https://www.youtube.com/shorts/KRxofTVbTbM' },
        ],
      },
    ],
  },
  {
    id: 'day-2',
    name: 'Lower (Glute / Hamstring Emphasis)',
    shortLabel: 'Lower',
    hasCardio: false,
    exercises: [
      {
        id: 'barbell-hip-thrust',
        name: 'Barbell Hip Thrust',
        demoUrl: 'https://www.youtube.com/shorts/-1cAnwFNBLg',
        sets: 4,
        repRange: '10-12',
        rpe: '7-8',
        muscleGroups: ['glutes'],
        alternatives: [
          { name: 'Single-Leg DB Hip Thrust', demoUrl: 'https://www.youtube.com/shorts/3suM3LwVlVM' },
          { name: 'Smith Machine Hip Thrust', demoUrl: 'https://www.youtube.com/shorts/9JftONhm6g4' },
          { name: 'Glute Bridge Machine', demoUrl: 'https://www.youtube.com/shorts/Mli3p6MHJCI' },
        ],
      },
      {
        id: 'single-leg-db-hip-thrust',
        name: 'Single-Leg DB Hip Thrust',
        demoUrl: 'https://www.youtube.com/shorts/3suM3LwVlVM',
        sets: 3,
        repRange: '10-12',
        rpe: '7',
        muscleGroups: ['glutes'],
        alternatives: [
          { name: 'Barbell Hip Thrust', demoUrl: 'https://www.youtube.com/shorts/-1cAnwFNBLg' },
          { name: 'Smith Machine Hip Thrust', demoUrl: 'https://www.youtube.com/shorts/9JftONhm6g4' },
          { name: 'Glute Bridge Machine', demoUrl: 'https://www.youtube.com/shorts/Mli3p6MHJCI' },
        ],
        note: 'Seeded from her last logged session.',
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
          { name: 'KB Sumo Deadlift', demoUrl: 'https://www.youtube.com/shorts/xW5bN8LnQjY' },
          { name: 'DB RDL', demoUrl: 'https://www.youtube.com/shorts/wiekN4aIJ0g' },
          { name: 'Cable Pull-Through', demoUrl: 'https://www.youtube.com/shorts/d3sH6fbCBP0' },
        ],
      },
      {
        id: 'bulgarian-split-squat',
        name: 'Bulgarian Split Squat',
        demoUrl: 'https://www.youtube.com/shorts/9p5e2BSvoLs',
        sets: 3,
        repRange: '10-12 / leg',
        rpe: '7',
        muscleGroups: ['glutes', 'quads'],
        alternatives: [
          { name: 'Reverse Lunge (Smith)', demoUrl: 'https://www.youtube.com/shorts/D26udvEstHk' },
          { name: 'Walking Lunge', demoUrl: 'https://www.youtube.com/shorts/2ea3_b9rFdM' },
          { name: 'Step-Up', demoUrl: 'https://www.youtube.com/shorts/8q9LVgN2RD4' },
        ],
      },
      {
        id: 'reverse-lunge-smith',
        name: 'Reverse Lunge (Smith)',
        demoUrl: 'https://www.youtube.com/shorts/D26udvEstHk',
        sets: 3,
        repRange: '10-12 / leg',
        rpe: '7',
        muscleGroups: ['glutes', 'quads'],
        alternatives: [
          { name: 'Bulgarian Split Squat', demoUrl: 'https://www.youtube.com/shorts/9p5e2BSvoLs' },
          { name: 'Walking Lunge', demoUrl: 'https://www.youtube.com/shorts/2ea3_b9rFdM' },
          { name: 'Step-Up', demoUrl: 'https://www.youtube.com/shorts/8q9LVgN2RD4' },
        ],
        note: 'Seeded from her last logged session.',
      },
      {
        id: 'kb-sumo-deadlift',
        name: 'KB Sumo Deadlift',
        demoUrl: 'https://www.youtube.com/shorts/xW5bN8LnQjY',
        sets: 3,
        repRange: '10-12',
        rpe: '7',
        muscleGroups: ['glutes', 'hamstrings'],
        alternatives: [
          { name: 'DB Sumo Deadlift', demoUrl: 'https://www.youtube.com/shorts/GKaXQB8291w' },
          { name: 'Barbell Sumo Deadlift', demoUrl: 'https://www.youtube.com/shorts/g-NddHVATPQ' },
          { name: 'Cable Pull-Through', demoUrl: 'https://www.youtube.com/shorts/d3sH6fbCBP0' },
        ],
        note: 'Seeded from her last logged session.',
      },
      {
        id: 'cable-kickback',
        name: 'Cable Kickback',
        demoUrl: 'https://www.youtube.com/shorts/hQKQZdCAntQ',
        sets: 3,
        repRange: '12-15 / leg',
        rpe: '7',
        muscleGroups: ['glutes'],
        alternatives: [
          { name: 'Glute Kickback Machine', demoUrl: 'https://www.youtube.com/shorts/3fBptAH0Rnw' },
          { name: 'Banded Kickback', demoUrl: 'https://www.youtube.com/shorts/9vm-MKquuEo' },
          { name: 'Donkey Kick (cable)', demoUrl: 'https://www.youtube.com/shorts/StQFsIfxrV4' },
        ],
      },
      {
        id: 'seated-leg-curl',
        name: 'Seated Leg Curl',
        demoUrl: 'https://www.youtube.com/shorts/xdbEG3xGLI8',
        sets: 3,
        repRange: '12-15',
        rpe: '7',
        muscleGroups: ['hamstrings'],
        alternatives: [
          { name: 'Lying Leg Curl', demoUrl: 'https://www.youtube.com/shorts/QwmpZXukkoQ' },
          { name: 'Standing Single-Leg Curl', demoUrl: 'https://www.youtube.com/shorts/idvJj2g3AzE' },
          { name: 'Stability Ball Curl', demoUrl: 'https://www.youtube.com/shorts/VwkY1XBD_XI' },
        ],
      },
    ],
  },
  {
    id: 'day-3',
    name: 'Upper (Pull Emphasis)',
    shortLabel: 'Pull',
    hasCardio: true,
    exercises: [
      {
        id: 'lat-pulldown',
        name: 'Lat Pulldown',
        demoUrl: 'https://www.youtube.com/shorts/bNmvKpJSWKM',
        sets: 4,
        repRange: '10-12',
        rpe: '7-8',
        muscleGroups: ['back'],
        alternatives: [
          { name: 'Assisted Pull-Up Machine', demoUrl: 'https://www.youtube.com/shorts/JcGwiiGyYFA' },
          { name: 'Close-Grip Pulldown', demoUrl: 'https://www.youtube.com/shorts/Buy_B0xBq1I' },
          { name: 'Straight-Arm Pulldown', demoUrl: 'https://www.youtube.com/shorts/zECTZHrvuMg' },
        ],
      },
      {
        id: 'seated-cable-row',
        name: 'Seated Cable Row',
        demoUrl: 'https://www.youtube.com/shorts/8QuMq1GMMng',
        sets: 3,
        repRange: '10-12',
        rpe: '7',
        muscleGroups: ['back'],
        alternatives: [
          { name: 'Chest-Supported Row Machine', demoUrl: 'https://www.youtube.com/shorts/FTwvmczf7bE' },
          { name: 'DB Row (bench-supported)', demoUrl: 'https://www.youtube.com/shorts/WkFX6_GxAs8' },
          { name: 'T-Bar Row', demoUrl: 'https://www.youtube.com/shorts/zAZQJYx9vrk' },
        ],
      },
      {
        id: 'db-single-arm-row',
        name: 'DB Single-Arm Row',
        demoUrl: 'https://www.youtube.com/shorts/H8jf3DwlIlo',
        sets: 3,
        repRange: '10-12 / side',
        rpe: '7',
        muscleGroups: ['back'],
        alternatives: [
          { name: 'Cable Single-Arm Row', demoUrl: 'https://www.youtube.com/shorts/bLVeOunB-c0' },
          { name: 'Machine Row (single-arm)', demoUrl: 'https://www.youtube.com/shorts/Y5fGGU0WuNQ' },
          { name: 'Kroc Row', demoUrl: 'https://www.youtube.com/shorts/NuYTR795PhY' },
        ],
      },
      {
        id: 'rear-delt-fly',
        name: 'Rear Delt Fly',
        demoUrl: 'https://www.youtube.com/shorts/9WpNWAM782Y',
        sets: 3,
        repRange: '12-15',
        rpe: '7',
        muscleGroups: ['shoulders'],
        alternatives: [
          { name: 'Reverse Pec Deck', demoUrl: 'https://www.youtube.com/shorts/BmJHBBZRpZg' },
          { name: 'Cable Rear Delt Fly', demoUrl: 'https://www.youtube.com/shorts/FeERX9UwspY' },
          { name: 'Face Pull', demoUrl: 'https://www.youtube.com/shorts/qEyoBOpvqR4' },
        ],
      },
      {
        id: 'db-bicep-curl',
        name: 'DB Bicep Curl',
        demoUrl: 'https://www.youtube.com/shorts/0OA-DqdTyZA',
        sets: 3,
        repRange: '10-12',
        rpe: '7',
        muscleGroups: ['biceps'],
        alternatives: [
          { name: 'Cable Curl', demoUrl: 'https://www.youtube.com/shorts/CrbTqNOlFgE' },
          { name: 'EZ-Bar Curl', demoUrl: 'https://www.youtube.com/shorts/d2r5TCqnR4Y' },
          { name: 'Preacher Curl Machine', demoUrl: 'https://www.youtube.com/shorts/Htw-s61mOw0' },
        ],
      },
      {
        id: 'cardio-incline-walk-2',
        name: 'Incline Treadmill Walk',
        demoUrl: null,
        isCardio: true,
        cardioType: 'steady-state',
        duration: '12 min',
        muscleGroups: [],
        alternatives: [
          { name: 'Stationary Bike', demoUrl: null },
          { name: 'StairMaster', demoUrl: null },
          { name: 'Elliptical', demoUrl: null },
        ],
      },
    ],
  },
  {
    id: 'day-4',
    name: 'Lower (Quad / Glute Emphasis)',
    shortLabel: 'Lower',
    hasCardio: false,
    exercises: [
      {
        id: 'lifted-heel-squat',
        name: 'Lifted Heel Squat',
        demoUrl: 'https://www.youtube.com/shorts/GtFJS_Bi39U',
        sets: 4,
        repRange: '10-12',
        rpe: '7-8',
        muscleGroups: ['quads', 'glutes'],
        alternatives: [
          { name: 'Smith Machine Squat', demoUrl: 'https://www.youtube.com/shorts/xU4cuTffVZc' },
          { name: 'Back Squat', demoUrl: 'https://www.youtube.com/shorts/ZaSetOZFo-k' },
          { name: 'Hack Squat Machine', demoUrl: 'https://www.youtube.com/shorts/g9i05umL5vc' },
        ],
        note: 'Seeded from her last logged session.',
      },
      {
        id: 'walking-lunge',
        name: 'Walking Lunge',
        demoUrl: 'https://www.youtube.com/shorts/2ea3_b9rFdM',
        sets: 3,
        repRange: '10-12 / leg',
        rpe: '7',
        muscleGroups: ['quads', 'glutes'],
        alternatives: [
          { name: 'Reverse Lunge (Smith)', demoUrl: 'https://www.youtube.com/shorts/D26udvEstHk' },
          { name: 'Step-Up', demoUrl: 'https://www.youtube.com/shorts/8q9LVgN2RD4' },
          { name: 'Curtsy Lunge', demoUrl: 'https://www.youtube.com/shorts/quIDO9QkuBQ' },
        ],
      },
      {
        id: 'leg-press',
        name: 'Leg Press',
        demoUrl: 'https://www.youtube.com/shorts/nDh_BlnLCGc',
        sets: 3,
        repRange: '10-12',
        rpe: '7',
        muscleGroups: ['quads'],
        alternatives: [
          { name: 'Hack Squat', demoUrl: 'https://www.youtube.com/shorts/g9i05umL5vc' },
          { name: 'Pendulum Squat Machine', demoUrl: 'https://www.youtube.com/shorts/89pJBhEAizI' },
          { name: 'Goblet Squat', demoUrl: 'https://www.youtube.com/shorts/t__Um6KjJkc' },
        ],
      },
      {
        id: 'hip-abduction-machine',
        name: 'Hip Abduction Machine',
        demoUrl: 'https://www.youtube.com/shorts/WOv7Aca6r-0',
        sets: 3,
        repRange: '15-20',
        rpe: '6-7',
        muscleGroups: ['glutes'],
        alternatives: [
          { name: 'Banded Lateral Walk', demoUrl: 'https://www.youtube.com/shorts/p55m0Hw7UoA' },
          { name: 'Cable Hip Abduction', demoUrl: 'https://www.youtube.com/shorts/_UYW5ym1YKE' },
          { name: 'Standing Cable Kickback', demoUrl: 'https://www.youtube.com/shorts/gHYh76AGPL8' },
        ],
      },
      {
        id: 'standing-calf-raise',
        name: 'Standing Calf Raise',
        demoUrl: 'https://www.youtube.com/shorts/B30JglFGx8Y',
        sets: 4,
        repRange: '12-15',
        rpe: '7',
        muscleGroups: ['calves'],
        alternatives: [
          { name: 'Seated Calf Raise', demoUrl: 'https://www.youtube.com/shorts/qJjqt0Q2WqU' },
          { name: 'Leg Press Calf Raise', demoUrl: 'https://www.youtube.com/shorts/DqT1h2_hQJ4' },
          { name: 'Single-Leg Calf Raise', demoUrl: 'https://www.youtube.com/shorts/AYzJdDk-DvQ' },
        ],
      },
    ],
  },
  {
    id: 'day-5',
    name: 'Full Body (Glutes + Arms)',
    shortLabel: 'Full',
    hasCardio: true,
    cardioOptional: true,
    exercises: [
      {
        id: 'cable-glute-kickback-2',
        name: 'Cable Glute Kickback',
        demoUrl: 'https://www.youtube.com/shorts/hQKQZdCAntQ',
        sets: 3,
        repRange: '12-15 / leg',
        rpe: '7',
        muscleGroups: ['glutes'],
        alternatives: [
          { name: 'Glute Kickback Machine', demoUrl: 'https://www.youtube.com/shorts/3fBptAH0Rnw' },
          { name: 'Donkey Kick', demoUrl: 'https://www.youtube.com/shorts/XRmrRiIdR2o' },
          { name: 'Banded Kickback', demoUrl: 'https://www.youtube.com/shorts/9vm-MKquuEo' },
        ],
      },
      {
        id: 'kb-sumo-deadlift-2',
        name: 'KB Sumo Deadlift',
        demoUrl: 'https://www.youtube.com/shorts/xW5bN8LnQjY',
        sets: 3,
        repRange: '10-12',
        rpe: '7',
        muscleGroups: ['glutes', 'hamstrings'],
        alternatives: [
          { name: 'DB Sumo Deadlift', demoUrl: 'https://www.youtube.com/shorts/GKaXQB8291w' },
          { name: 'Barbell Sumo Deadlift', demoUrl: 'https://www.youtube.com/shorts/g-NddHVATPQ' },
          { name: 'Cable Pull-Through', demoUrl: 'https://www.youtube.com/shorts/d3sH6fbCBP0' },
        ],
        note: 'Seeded from her last logged session.',
      },
      {
        id: 'db-curl-overhead-tricep-ext',
        name: 'DB Curl + Overhead Tricep Ext',
        demoUrl: 'https://www.youtube.com/shorts/gsTmzeGndt4',
        sets: 3,
        repRange: '10-12 each',
        rpe: '7',
        muscleGroups: ['biceps', 'triceps'],
        alternatives: [
          { name: 'Cable Curl + Rope Pushdown', demoUrl: 'https://www.youtube.com/watch?v=ILXttchI96k' },
          { name: 'EZ-Bar Curl + DB Skull Crusher', demoUrl: 'https://www.youtube.com/watch?v=-9iJtiEyMf8' },
        ],
        supersetGroup: 'day5-superset-1',
      },
      {
        id: 'hammer-curl-skull-crusher',
        name: 'Hammer Curl + Skull Crusher',
        demoUrl: 'https://www.youtube.com/watch?v=mGz8uyuA8YA',
        sets: 3,
        repRange: '10-12 each',
        rpe: '7',
        muscleGroups: ['biceps', 'triceps'],
        alternatives: [
          { name: 'Cross-Body Hammer Curl + Tricep Dip', demoUrl: 'https://www.youtube.com/watch?v=UepRb4X--WY' },
          { name: 'Cable Hammer Curl + Overhead Rope Ext', demoUrl: 'https://www.youtube.com/watch?v=dkbFWTMHRiU' },
        ],
        supersetGroup: 'day5-superset-2',
      },
      {
        id: 'cardio-intervals-1',
        name: 'Intervals (Bike or Row)',
        demoUrl: null,
        isCardio: true,
        cardioType: 'intervals',
        duration: '10 min (30s hard / 90s easy)',
        muscleGroups: [],
        alternatives: [
          { name: 'Treadmill Intervals', demoUrl: null },
          { name: 'StairMaster Intervals', demoUrl: null },
          { name: 'Steady-state (swap if fatigued)', demoUrl: null },
        ],
      },
    ],
  },
]
