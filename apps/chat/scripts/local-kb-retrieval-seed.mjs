import { randomBytes } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { encrypt } from '@klicker-uzh/util'
import pg from 'pg'

export const ISOLATED_KB_SERVER_NAME = 'KB'

// The shared seed deliberately parks the KB MCP server in its inert scoped
// shape (authType scope_token, no transport credential) so no runtime inherits
// a stale credential. The isolated local runtime reaches a provider-owned
// retrieval service that authorizes every call with the signed Doc Query scope
// token, so this step only supplies the transport credential the chat runtime
// requires next to it. It never enables a configuration, changes a knowledge
// base binding or touches any other MCP server.
export function assertIsolatedKbServer(server, expectedUrl) {
  if (!server || server.name !== ISOLATED_KB_SERVER_NAME) {
    throw new Error('Isolated KB retrieval server is missing')
  }
  if (server.url !== expectedUrl) {
    throw new Error('Isolated KB retrieval server URL drifted')
  }
  if (
    server.isActive !== true ||
    server.passChatbotId !== false ||
    server.chatbotIdHeader !== null
  ) {
    throw new Error('Isolated KB retrieval server contract drifted')
  }
  const parked = server.authType === 'scope_token' && !server.authSecret
  const normalized =
    server.authType === 'bearer' &&
    typeof server.authSecret === 'string' &&
    server.authSecret.length > 0
  if (!parked && !normalized) {
    throw new Error('Isolated KB retrieval server authentication is unexpected')
  }
}

// The caller owns the local-runtime boundary and the database connection.
export async function normalizeIsolatedKbRetrieval(
  db,
  expectedUrl,
  token,
  isInterrupted = () => false
) {
  if (typeof expectedUrl !== 'string' || expectedUrl.trim() === '') {
    throw new Error('Isolated KB retrieval URL is not configured')
  }
  if (typeof token !== 'string' || token.trim() === '') {
    throw new Error('Isolated KB transport credential is empty')
  }
  try {
    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
    await db.query("SET LOCAL lock_timeout = '5s'")
    await db.query("SET LOCAL statement_timeout = '10s'")
    const { rows } = await db.query(
      'SELECT * FROM "ChatbotMCPServer" WHERE name = $1 FOR UPDATE',
      [ISOLATED_KB_SERVER_NAME]
    )
    if (rows.length !== 1) {
      throw new Error('Isolated KB retrieval server is not unique')
    }
    assertIsolatedKbServer(rows[0], expectedUrl)
    if (isInterrupted()) {
      throw new Error('Isolated KB retrieval normalization interrupted')
    }
    await db.query(
      'UPDATE "ChatbotMCPServer" SET "authType" = $1, "authSecret" = $2, "updatedAt" = NOW() WHERE id = $3',
      ['bearer', encrypt(token), rows[0].id]
    )
    await db.query('COMMIT')
  } catch {
    await db.query('ROLLBACK').catch(() => {})
    throw new Error('Isolated KB retrieval normalization rejected')
  }
}

function requireSetting(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

async function main() {
  if (process.env.KLICKER_LOCAL_KB_RUNTIME_ONLY !== '1') {
    throw new Error(
      'Isolated KB retrieval normalization requires the local runtime'
    )
  }
  const expectedUrl = requireSetting('KLICKER_LOCAL_KB_RETRIEVAL_URL')
  const db = new pg.Client({
    connectionString: requireSetting('DATABASE_URL'),
    connectionTimeoutMillis: 10000,
  })
  // Avoid emitting driver errors or SQL parameters from this credential writer.
  db.on('error', () => {})
  try {
    await db.connect()
    await normalizeIsolatedKbRetrieval(
      db,
      expectedUrl,
      randomBytes(32).toString('hex')
    )
  } finally {
    await db.end()
  }
  console.log('[local-kb] KB retrieval transport credential normalized')
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await main()
  } catch {
    console.error(
      '[local-kb] KB retrieval normalization failed; no credentials logged'
    )
    process.exitCode = 1
  }
}
