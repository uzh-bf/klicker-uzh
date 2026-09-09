import { spawn, spawnSync } from 'node:child_process'
import { generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto'
import { realpathSync } from 'node:fs'
import pg from 'pg'
import { loadLocalMcpDocuments } from './local-mcp-documents.mjs'
import { loadLocalMcpFixture } from './local-mcp-fixture.mjs'
import { repairLocalMcpSeed } from './local-mcp-seed.mjs'

const ROOT = '/workspaces/klicker-uzh'
let child
let interrupted = false
let ownsProcesses = false
let interruptionTimer
const helper = process.env.DEVROUTER_PROCESS_HELPER

function stopOwnedProcesses() {
  let failed = false
  for (const name of ['klicker-dev', 'klicker-local-mcp']) {
    const result = spawnSync(helper, ['stop', '--name', name], {
      stdio: 'ignore',
      timeout: 30000,
    })
    if (result.status !== 0) failed = true
  }
  if (failed) throw new Error('Local MCP process stop failed')
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    interrupted = true
    child?.kill(signal)
    interruptionTimer ??= setTimeout(() => child?.kill('SIGKILL'), 5000)
    interruptionTimer.unref()
  })
}

try {
  const database = new URL(process.env.DATABASE_URL)
  if (
    realpathSync(process.cwd()) !== ROOT ||
    !['postgres:', 'postgresql:'].includes(database.protocol) ||
    !['postgres', 'localhost', '127.0.0.1', '[::1]'].includes(
      database.hostname
    ) ||
    database.search !== '' ||
    !helper ||
    spawnSync('bash', ['./util/dev-runtime.sh', 'require-bootstrap'], {
      stdio: 'ignore',
    }).status !== 0 ||
    spawnSync(
      'bash',
      ['-c', '. ./util/profile-resolver.sh; profile_wants klicker-local-mcp'],
      {
        stdio: 'ignore',
      }
    ).status !== 0
  )
    throw new Error('Local MCP runtime boundary rejected')

  const fixture = loadLocalMcpFixture(process.env)
  if (fixture)
    loadLocalMcpDocuments(
      { LOCAL_MCP_DOCUMENTS_FILE: fixture.documentsFile },
      []
    )
  ownsProcesses = true
  stopOwnedProcesses()
  if (interrupted) throw new Error('Local MCP startup interrupted')
  const generation = randomUUID()
  const token = randomBytes(32).toString('hex')
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  })
  const db = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
  })
  // Avoid emitting driver errors or SQL parameters from this credential writer.
  db.on('error', () => {})
  try {
    await db.connect()
    await repairLocalMcpSeed(db, token, () => interrupted, fixture)
  } finally {
    await db.end()
  }
  if (interrupted) throw new Error('Local MCP startup interrupted')
  const status = await new Promise((resolve, reject) => {
    child = spawn('bash', ['./.devcontainer/post-start.sh'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        LOCAL_MCP_BOOTSTRAPPED: '1',
        LOCAL_MCP_GENERATION: generation,
        LOCAL_MCP_TRANSPORT_TOKEN: token,
        LOCAL_MCP_PUBLIC_KEY: publicKey,
        DOC_QUERY_SCOPE_PRIVATE_KEY: privateKey,
        DOC_QUERY_SCOPE_KID: generation,
        DOC_QUERY_SCOPE_ISSUER: 'klicker-local-chat',
        DOC_QUERY_SCOPE_AUDIENCE: 'klicker-local-doc-query',
      },
    })
    child.once('error', reject)
    child.once('exit', (code) => resolve(code ?? 1))
  })
  if (status !== 0 || interrupted) throw new Error('Local MCP startup failed')
} catch {
  if (ownsProcesses) {
    try {
      stopOwnedProcesses()
    } catch {
      console.error('[local-mcp] Owned process cleanup failed')
    }
  }
  console.error(
    '[local-mcp] Authenticated fixture startup failed; no credentials logged'
  )
  process.exitCode = 1
}
