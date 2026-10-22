// Calendar math (week starts, streaks, edit windows) runs on local time, so
// pin the zone the app is used in to keep date-based tests deterministic.
process.env.TZ = 'America/Los_Angeles'
