// ============================================================================
// PROGRAM DATA
// Single source of truth for the training program. Nothing exercise-,
// rep-, or week-related should be hardcoded into components — it all reads
// from here. Add exercises/weeks/alternatives here only.
// ============================================================================

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

// ---- The program ------------------------------------------------------------
// Each exercise: id, name, sets, repRange, rpe, muscleGroups[], alternatives[],
// isCardio, supersetGroup (optional, pairs exercises done back-to-back).
export const PROGRAM_DAYS = [
  {
    id: 'day-1',
    name: 'Upper (Push Emphasis)',
    hasCardio: true,
    exercises: [
      {
        id: 'db-bench-press',
        name: 'DB Bench Press',
        sets: 4,
        repRange: '8-10',
        rpe: '7-8',
        muscleGroups: ['chest'],
        alternatives: ['Smith Machine Bench Press', 'Chest Press Machine', 'Hammer Strength Chest Press'],
      },
      {
        id: 'seated-db-shoulder-press',
        name: 'Seated DB Shoulder Press',
        sets: 3,
        repRange: '8-10',
        rpe: '7',
        muscleGroups: ['shoulders'],
        alternatives: ['Machine Shoulder Press', 'Arnold Press', 'Smith Machine Overhead Press'],
      },
      {
        id: 'incline-db-press',
        name: 'Incline DB Press',
        sets: 3,
        repRange: '10-12',
        rpe: '7',
        muscleGroups: ['chest'],
        alternatives: ['Incline Machine Press', 'Cable Incline Fly', 'Low-to-High Cable Fly'],
      },
      {
        id: 'cable-lateral-raise',
        name: 'Cable Lateral Raise',
        sets: 3,
        repRange: '12-15',
        rpe: '7',
        muscleGroups: ['shoulders'],
        alternatives: ['DB Lateral Raise', 'Machine Lateral Raise', 'Lean-Away Cable Raise'],
      },
      {
        id: 'tricep-rope-pushdown',
        name: 'Tricep Rope Pushdown',
        sets: 3,
        repRange: '10-12',
        rpe: '7',
        muscleGroups: ['triceps'],
        alternatives: ['Overhead Cable Tricep Ext', 'DB Skull Crusher', 'Tricep Dip Machine'],
      },
      {
        id: 'cardio-incline-walk-1',
        name: 'Incline Treadmill Walk',
        isCardio: true,
        cardioType: 'steady-state',
        duration: '12 min',
        muscleGroups: [],
        alternatives: ['Stationary Bike', 'StairMaster', 'Elliptical'],
      },
    ],
  },
  {
    id: 'day-2',
    name: 'Lower (Glute / Hamstring Emphasis)',
    hasCardio: false,
    exercises: [
      {
        id: 'barbell-hip-thrust',
        name: 'Barbell Hip Thrust',
        sets: 4,
        repRange: '10-12',
        rpe: '7-8',
        muscleGroups: ['glutes'],
        alternatives: ['Single-Leg DB Hip Thrust', 'Smith Machine Hip Thrust', 'Glute Bridge Machine'],
      },
      {
        id: 'single-leg-db-hip-thrust',
        name: 'Single-Leg DB Hip Thrust',
        sets: 3,
        repRange: '10-12',
        rpe: '7',
        muscleGroups: ['glutes'],
        alternatives: ['Barbell Hip Thrust', 'Smith Machine Hip Thrust', 'Glute Bridge Machine'],
        note: 'Seeded from her last logged session.',
      },
      {
        id: 'romanian-deadlift',
        name: 'Romanian Deadlift',
        sets: 4,
        repRange: '10-12',
        rpe: '7-8',
        muscleGroups: ['hamstrings', 'glutes'],
        alternatives: ['KB Sumo Deadlift', 'DB RDL', 'Cable Pull-Through'],
      },
      {
        id: 'bulgarian-split-squat',
        name: 'Bulgarian Split Squat',
        sets: 3,
        repRange: '10-12 / leg',
        rpe: '7',
        muscleGroups: ['glutes', 'quads'],
        alternatives: ['Reverse Lunge (Smith)', 'Walking Lunge', 'Step-Up'],
      },
      {
        id: 'reverse-lunge-smith',
        name: 'Reverse Lunge (Smith)',
        sets: 3,
        repRange: '10-12 / leg',
        rpe: '7',
        muscleGroups: ['glutes', 'quads'],
        alternatives: ['Bulgarian Split Squat', 'Walking Lunge', 'Step-Up'],
        note: 'Seeded from her last logged session.',
      },
      {
        id: 'kb-sumo-deadlift',
        name: 'KB Sumo Deadlift',
        sets: 3,
        repRange: '10-12',
        rpe: '7',
        muscleGroups: ['glutes', 'hamstrings'],
        alternatives: ['DB Sumo Deadlift', 'Barbell Sumo Deadlift', 'Cable Pull-Through'],
        note: 'Seeded from her last logged session.',
      },
      {
        id: 'cable-kickback',
        name: 'Cable Kickback',
        sets: 3,
        repRange: '12-15 / leg',
        rpe: '7',
        muscleGroups: ['glutes'],
        alternatives: ['Glute Kickback Machine', 'Banded Kickback', 'Donkey Kick (cable)'],
      },
      {
        id: 'seated-leg-curl',
        name: 'Seated Leg Curl',
        sets: 3,
        repRange: '12-15',
        rpe: '7',
        muscleGroups: ['hamstrings'],
        alternatives: ['Lying Leg Curl', 'Standing Single-Leg Curl', 'Stability Ball Curl'],
      },
    ],
  },
  {
    id: 'day-3',
    name: 'Upper (Pull Emphasis)',
    hasCardio: true,
    exercises: [
      {
        id: 'lat-pulldown',
        name: 'Lat Pulldown',
        sets: 4,
        repRange: '10-12',
        rpe: '7-8',
        muscleGroups: ['back'],
        alternatives: ['Assisted Pull-Up Machine', 'Close-Grip Pulldown', 'Straight-Arm Pulldown'],
      },
      {
        id: 'seated-cable-row',
        name: 'Seated Cable Row',
        sets: 3,
        repRange: '10-12',
        rpe: '7',
        muscleGroups: ['back'],
        alternatives: ['Chest-Supported Row Machine', 'DB Row (bench-supported)', 'T-Bar Row'],
      },
      {
        id: 'db-single-arm-row',
        name: 'DB Single-Arm Row',
        sets: 3,
        repRange: '10-12 / side',
        rpe: '7',
        muscleGroups: ['back'],
        alternatives: ['Cable Single-Arm Row', 'Machine Row (single-arm)', 'Kroc Row'],
      },
      {
        id: 'rear-delt-fly',
        name: 'Rear Delt Fly',
        sets: 3,
        repRange: '12-15',
        rpe: '7',
        muscleGroups: ['shoulders'],
        alternatives: ['Reverse Pec Deck', 'Cable Rear Delt Fly', 'Face Pull'],
      },
      {
        id: 'db-bicep-curl',
        name: 'DB Bicep Curl',
        sets: 3,
        repRange: '10-12',
        rpe: '7',
        muscleGroups: ['biceps'],
        alternatives: ['Cable Curl', 'EZ-Bar Curl', 'Preacher Curl Machine'],
      },
      {
        id: 'cardio-incline-walk-2',
        name: 'Incline Treadmill Walk',
        isCardio: true,
        cardioType: 'steady-state',
        duration: '12 min',
        muscleGroups: [],
        alternatives: ['Stationary Bike', 'StairMaster', 'Elliptical'],
      },
    ],
  },
  {
    id: 'day-4',
    name: 'Lower (Quad / Glute Emphasis)',
    hasCardio: false,
    exercises: [
      {
        id: 'lifted-heel-squat',
        name: 'Lifted Heel Squat',
        sets: 4,
        repRange: '10-12',
        rpe: '7-8',
        muscleGroups: ['quads', 'glutes'],
        alternatives: ['Smith Machine Squat', 'Back Squat', 'Hack Squat Machine'],
        note: 'Seeded from her last logged session.',
      },
      {
        id: 'walking-lunge',
        name: 'Walking Lunge',
        sets: 3,
        repRange: '10-12 / leg',
        rpe: '7',
        muscleGroups: ['quads', 'glutes'],
        alternatives: ['Reverse Lunge (Smith)', 'Step-Up', 'Curtsy Lunge'],
      },
      {
        id: 'leg-press',
        name: 'Leg Press',
        sets: 3,
        repRange: '10-12',
        rpe: '7',
        muscleGroups: ['quads'],
        alternatives: ['Hack Squat', 'Pendulum Squat Machine', 'Goblet Squat'],
      },
      {
        id: 'hip-abduction-machine',
        name: 'Hip Abduction Machine',
        sets: 3,
        repRange: '15-20',
        rpe: '6-7',
        muscleGroups: ['glutes'],
        alternatives: ['Banded Lateral Walk', 'Cable Hip Abduction', 'Standing Cable Kickback'],
      },
      {
        id: 'standing-calf-raise',
        name: 'Standing Calf Raise',
        sets: 4,
        repRange: '12-15',
        rpe: '7',
        muscleGroups: ['calves'],
        alternatives: ['Seated Calf Raise', 'Leg Press Calf Raise', 'Single-Leg Calf Raise'],
      },
    ],
  },
  {
    id: 'day-5',
    name: 'Full Body (Glutes + Arms)',
    hasCardio: true,
    cardioOptional: true,
    exercises: [
      {
        id: 'cable-glute-kickback-2',
        name: 'Cable Glute Kickback',
        sets: 3,
        repRange: '12-15 / leg',
        rpe: '7',
        muscleGroups: ['glutes'],
        alternatives: ['Glute Kickback Machine', 'Donkey Kick', 'Banded Kickback'],
      },
      {
        id: 'kb-sumo-deadlift-2',
        name: 'KB Sumo Deadlift',
        sets: 3,
        repRange: '10-12',
        rpe: '7',
        muscleGroups: ['glutes', 'hamstrings'],
        alternatives: ['DB Sumo Deadlift', 'Barbell Sumo Deadlift', 'Cable Pull-Through'],
        note: 'Seeded from her last logged session.',
      },
      {
        id: 'db-curl-overhead-tricep-ext',
        name: 'DB Curl + Overhead Tricep Ext',
        sets: 3,
        repRange: '10-12 each',
        rpe: '7',
        muscleGroups: ['biceps', 'triceps'],
        alternatives: ['Cable Curl + Rope Pushdown', 'EZ-Bar Curl + DB Skull Crusher'],
        supersetGroup: 'day5-superset-1',
      },
      {
        id: 'hammer-curl-skull-crusher',
        name: 'Hammer Curl + Skull Crusher',
        sets: 3,
        repRange: '10-12 each',
        rpe: '7',
        muscleGroups: ['biceps', 'triceps'],
        alternatives: ['Cross-Body Hammer Curl + Tricep Dip', 'Cable Hammer Curl + Overhead Rope Ext'],
        supersetGroup: 'day5-superset-2',
      },
      {
        id: 'cardio-intervals-1',
        name: 'Intervals (Bike or Row)',
        isCardio: true,
        cardioType: 'intervals',
        duration: '10 min (30s hard / 90s easy)',
        muscleGroups: [],
        alternatives: ['Treadmill Intervals', 'StairMaster Intervals', 'Steady-state (swap if fatigued)'],
      },
    ],
  },
]
