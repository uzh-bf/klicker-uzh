// Restarts the chat dev server inside the workspace container with the
// load-test model registry (util/litellm/load-test.registry.json), which routes
// the fallback model through the chat-completions API. LiteLLM's mock cannot
// stream on the Responses API. Run it inside the container:
//   devrouter exec . -- node util/load-test/chat-mock-registry.mjs
// Extra KEY=VALUE arguments are added to the chat environment, for example
// CHAT_ASSESSMENT_MODE=true. It copies the running chat process's environment, so no secret is read from
// or written to a file. A later `devrouter ensure` or stop returns chat to the
// default registry.
import { connect } from 'node:net'
import { spawn } from 'node:child_process'
import { openSync, readdirSync, readFileSync, readlinkSync } from 'node:fs'

const chatDir = '/workspaces/klicker-uzh/apps/chat'
const registryFile =
  '/workspaces/klicker-uzh/util/litellm/load-test.registry.json'

const pids = readdirSync('/proc')
  .filter((entry) => /^\d+$/.test(entry))
  .map(Number)
  .filter((pid) => {
    try {
      return readlinkSync(`/proc/${pid}/cwd`) === chatDir
    } catch {
      return false
    }
  })
const server = pids.find((pid) =>
  readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes('next')
)
if (!server) throw new Error('No running chat dev server found')

const env = Object.fromEntries(
  readFileSync(`/proc/${server}/environ`, 'utf8')
    .split('\0')
    .filter((entry) => entry.includes('='))
    .map((entry) => [
      entry.slice(0, entry.indexOf('=')),
      entry.slice(entry.indexOf('=') + 1),
    ])
)
env.CHAT_MODEL_REGISTRY_JSON = JSON.stringify(
  JSON.parse(readFileSync(registryFile, 'utf8'))
)

for (const assignment of process.argv.slice(2)) {
  const separator = assignment.indexOf('=')
  if (separator < 1) throw new Error('Extra arguments must be KEY=VALUE')
  env[assignment.slice(0, separator)] = assignment.slice(separator + 1)
}

for (const pid of pids) {
  // The script may itself run from the chat directory.
  if (pid === process.pid) continue
  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    // already exited
  }
}

const portOpen = () =>
  new Promise((resolve) => {
    const socket = connect(3004, '127.0.0.1')
    socket.once('connect', () => (socket.destroy(), resolve(true)))
    socket.once('error', () => resolve(false))
  })
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
for (let i = 0; i < 20 && (await portOpen()); i++) await sleep(500)
if (await portOpen()) throw new Error('Port 3004 is still in use after SIGTERM')

const log = openSync('/tmp/chat-load.log', 'a')
const child = spawn(
  'pnpm',
  [
    'exec',
    'cross-env',
    'NODE_ENV=development',
    'next',
    'dev',
    '--turbopack',
    '--port',
    '3004',
  ],
  { cwd: chatDir, env, stdio: ['ignore', log, log], detached: true }
)
let exited = false
child.once('error', (error) => {
  throw error
})
child.once('exit', () => (exited = true))
for (let i = 0; i < 120 && !exited && !(await portOpen()); i++) await sleep(500)
if (exited || !(await portOpen())) {
  throw new Error('Chat did not start on port 3004; see /tmp/chat-load.log')
}
child.unref()
console.log(
  'chat restarted with the load-test registry; log: /tmp/chat-load.log'
)
