// Minimal stand-in for the supabase-js query builder. Every chained call is
// recorded on the query, and awaiting the builder resolves to whatever the
// test's responder returns for that query ({ data, count, error }).
//
// Usage in a test file:
//   vi.mock('../lib/supabase', async () => ({ supabase: (await import('../test/fakeSupabase')).fake.client }))
//   fake.respond((q) => (q.table === 'workout_sessions' ? { data: [] } : { data: null }))

const METHODS = [
  'select', 'insert', 'update', 'upsert', 'delete',
  'eq', 'in', 'gt', 'gte', 'lt', 'order', 'limit', 'single', 'maybeSingle',
]

export function createFakeSupabase() {
  const queries = []
  let responder = () => ({ data: null, error: null })

  function from(table) {
    const query = { table, ops: [] }
    queries.push(query)
    const builder = {}
    for (const name of METHODS) {
      builder[name] = (...args) => {
        query.ops.push({ name, args })
        return builder
      }
    }
    builder.then = (resolve, reject) =>
      Promise.resolve()
        .then(() => ({ data: null, error: null, ...responder(query) }))
        .then(resolve, reject)
    return builder
  }

  return {
    client: { from },
    queries,
    respond(fn) {
      responder = fn
    },
    reset() {
      queries.length = 0
      responder = () => ({ data: null, error: null })
    },
  }
}

// The args of the first `name` call on a recorded query, or undefined.
export function opArgs(query, name) {
  return query.ops.find((op) => op.name === name)?.args
}

export function hasOp(query, name) {
  return query.ops.some((op) => op.name === name)
}

export const fake = createFakeSupabase()
