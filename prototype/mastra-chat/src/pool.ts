// Standalone PG pool, decoupled from the model-provider env so DB-only scripts
// (branch-path checks, schema setup, measurement) can run without Infisical
// injecting OPENAI_*/MCP_* — they only need DATABASE_URL on the environment.
// The server path still gets DATABASE_URL from Infisical; offline scripts pass
// the documented local dev DSN inline.
import pg from 'pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL not set (Infisical for the server; inline DSN for offline scripts)')
}

export const pool = new pg.Pool({ connectionString })
