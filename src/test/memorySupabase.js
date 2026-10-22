// A tiny in-memory stand-in for the momapp tables, answering the queries
// recorded by fakeSupabase.js. Supports exactly what the app uses: select
// (with count/head, the workout_sessions!inner join), insert, upsert with
// onConflict, update, delete; eq / in / gt / gte / lt filters; order, limit,
// single, maybeSingle. Use: fake.respond(createMemoryDb(seed).respond)

const DEFAULTS = {
  workout_sessions: () => ({
    started_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    completed_at: null,
    duration_seconds: null,
    session_rpe: null,
    closed_by: null,
    effort: null,
  }),
  exercise_logs: () => ({ logged_at: new Date().toISOString(), rpe: null, weight_unit: 'lb', is_cardio: false }),
  body_weight_logs: () => ({ logged_at: new Date().toISOString(), created_at: new Date().toISOString(), weight_unit: 'lb' }),
}

export function createMemoryDb(seed = {}) {
  const tables = {
    workout_sessions: [...(seed.workout_sessions ?? [])],
    exercise_logs: [...(seed.exercise_logs ?? [])],
    body_weight_logs: [...(seed.body_weight_logs ?? [])],
  }
  let seq = 0
  const newRow = (table, values) => ({ id: `${table}-${++seq}`, ...DEFAULTS[table](), ...values })

  function column(table, row, col) {
    if (col.startsWith('workout_sessions.') && table === 'exercise_logs') {
      const session = tables.workout_sessions.find((s) => s.id === row.session_id)
      return session?.[col.split('.')[1]]
    }
    return row[col]
  }

  function filtered(query) {
    const tests = query.ops.filter((op) => ['eq', 'in', 'gt', 'gte', 'lt'].includes(op.name))
    return tables[query.table].filter((row) =>
      tests.every(({ name, args: [col, value] }) => {
        const v = column(query.table, row, col)
        if (name === 'eq') return v === value
        if (name === 'in') return value.includes(v)
        if (v == null) return false
        if (name === 'gt') return v > value
        if (name === 'gte') return v >= value
        return v < value
      }),
    )
  }

  function shape(query, rows) {
    const op = (name) => query.ops.find((o) => o.name === name)
    let out = [...rows]
    const order = op('order')
    if (order) {
      const [col, { ascending = true } = {}] = order.args
      out.sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (ascending ? 1 : -1))
    }
    if (op('limit')) out = out.slice(0, op('limit').args[0])
    const columns = op('select')?.args[0] ?? '*'
    if (query.table === 'exercise_logs' && columns.includes('workout_sessions!inner')) {
      out = out.map((row) => {
        const s = tables.workout_sessions.find((w) => w.id === row.session_id)
        return { ...row, workout_sessions: { block: s?.block, status: s?.status } }
      })
    }
    out = out.map((row) => ({ ...row }))
    if (op('single')) return { data: out[0] ?? null, error: out[0] ? null : new Error('No rows') }
    if (op('maybeSingle')) return { data: out[0] ?? null }
    return { data: out }
  }

  function respond(query) {
    const op = (name) => query.ops.find((o) => o.name === name)
    const table = tables[query.table]

    if (op('insert')) {
      const values = op('insert').args[0]
      const rows = (Array.isArray(values) ? values : [values]).map((v) => newRow(query.table, v))
      table.push(...rows)
      return shape(query, rows)
    }

    if (op('upsert')) {
      const [values, { onConflict }] = op('upsert').args
      const keys = onConflict.split(',')
      const existing = table.find((row) => keys.every((k) => row[k] === values[k]))
      if (existing) Object.assign(existing, values)
      const row = existing ?? newRow(query.table, values)
      if (!existing) table.push(row)
      return shape(query, [row])
    }

    if (op('update')) {
      const rows = filtered(query)
      for (const row of rows) Object.assign(row, op('update').args[0])
      return op('select') ? shape(query, rows) : { data: null }
    }

    if (op('delete')) {
      const rows = new Set(filtered(query))
      tables[query.table] = table.filter((row) => !rows.has(row))
      return { data: null }
    }

    const rows = filtered(query)
    if (op('select')?.args[1]?.head) return { count: rows.length, data: null }
    return shape(query, rows)
  }

  return { tables, respond }
}
