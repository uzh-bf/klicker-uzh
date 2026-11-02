import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  cpSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const app = process.argv[2]
assert(
  ['frontend-pwa', 'frontend-manage'].includes(app),
  'Pass frontend-pwa or frontend-manage'
)
const root = process.cwd()
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
    ...options,
  })
  if (result.error) throw result.error
  assert.equal(result.status, 0, `${command} failed: ${result.status}`)
  return result.stdout
}
const head = run('git', ['rev-parse', 'HEAD'], { stdio: 'pipe' }).trim()
const dirty =
  run('git', ['status', '--porcelain'], { stdio: 'pipe' }).trim() !== ''
if (process.argv[3]) {
  assert.equal(head, process.argv[3])
  assert(!dirty, 'CI candidate source must be clean')
}
const context = mkdtempSync(join(tmpdir(), `klicker-intl-${app}-`))
const image = `klicker-intl-smoke-${app}:${head.slice(0, 12)}-${process.pid}`
const files = run('git', ['ls-files', '-z'], { stdio: 'pipe' })
  .split('\0')
  .filter(Boolean)
for (const file of files) {
  // Copy candidate source, never local dependencies, ignored receipts or credentials.
  if (file.includes('/.env') || file.startsWith('.env')) continue
  if (lstatSync(join(root, file)).isDirectory()) continue
  mkdirSync(dirname(join(context, file)), { recursive: true })
  if (lstatSync(join(root, file)).isSymbolicLink()) {
    symlinkSync(readlinkSync(join(root, file)), join(context, file))
  } else {
    cpSync(join(root, file), join(context, file))
  }
}
const fixtures = join(root, '.github/fixtures/intl-production')
copyFileSync(
  join(fixtures, 'context.tsx'),
  join(context, `apps/${app}/src/pages/intl-context-probe.tsx`)
)
copyFileSync(
  join(root, 'util/test-intl-resolution.mjs'),
  join(context, 'intl-resolution.mjs')
)
const harnessHash = createHash('sha256')
  .update(readFileSync(new URL(import.meta.url)))
  .digest('hex')
const env = [
  'COOKIE_DOMAIN=127.0.0.1',
  'API_DOMAIN=127.0.0.1',
  'NEXT_PUBLIC_API_URL=http://127.0.0.1:3000/graphql',
  'NEXT_PUBLIC_API_URL_SSR=http://127.0.0.1:3000/graphql',
  'NEXT_PUBLIC_PWA_URL=http://127.0.0.1:3001',
  'NEXT_PUBLIC_MANAGE_URL=http://127.0.0.1:3002',
  'NEXT_PUBLIC_CHAT_URL=$APP_ORIGIN_CHAT',
  'APP_ORIGIN_PWA=http://127.0.0.1:3001',
  'APP_ORIGIN_MANAGE=http://127.0.0.1:3002',
  'APP_ORIGIN_CHAT=http://127.0.0.1:3004',
  'NEXT_PUBLIC_ENV=production',
].join('\n')
writeFileSync(join(context, `apps/${app}/.env.production`), env)
writeFileSync(
  join(context, 'intl-receipt.mjs'),
  `
import {createHash} from 'node:crypto'
import {readFileSync, writeFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const inputLock = hash('/tmp/intl-input-lock.yaml')
const installedLock = hash('pnpm-lock.yaml')
if (inputLock !== installedLock) throw new Error('Pruned lockfile changed during installation')
const topology = JSON.parse(execFileSync(process.execPath,['intl-resolution.mjs',${JSON.stringify(app)}],{encoding:'utf8'}))
writeFileSync('intl-receipt.json',JSON.stringify({head:${JSON.stringify(head)},dirty:${JSON.stringify(dirty)},harnessHash:${JSON.stringify(harnessHash)},app:${JSON.stringify(app)},node:process.version,pnpm:execFileSync('pnpm',['--version'],{encoding:'utf8'}).trim(),inputLock,installedLock,topology}))
`
)
const dockerfilePath = join(context, `apps/${app}/Dockerfile`)
let dockerfile = readFileSync(dockerfilePath, 'utf8')
assert(
  dockerfile.includes('RUN pnpm i --ignore-scripts'),
  'Production install seam changed'
)
assert(
  dockerfile.includes('COPY --from=builder /app/out/full/ .'),
  'Production source seam changed'
)
dockerfile = dockerfile.replace(
  'RUN pnpm i --ignore-scripts',
  'ENV NEXT_TELEMETRY_DISABLED=1\nRUN cp pnpm-lock.yaml /tmp/intl-input-lock.yaml\nRUN pnpm i --ignore-scripts'
)
dockerfile = dockerfile.replace(
  'COPY --from=builder /app/out/full/ .',
  'COPY --from=builder /app/out/full/ .\nCOPY --from=builder /app/intl-resolution.mjs /app/intl-receipt.mjs ./\nRUN node intl-receipt.mjs'
)
dockerfile +=
  '\nCOPY --from=installer /app/intl-receipt.json /app/intl-receipt.json\n'
writeFileSync(dockerfilePath, dockerfile)
console.error(`Disposable production probe context: ${context}`)
run('docker', [
  'build',
  '--progress=plain',
  '--build-arg',
  'NEXT_TELEMETRY_DISABLED=1',
  '-f',
  dockerfilePath,
  '-t',
  image,
  context,
])
run('docker', [
  'run',
  '--rm',
  '--network',
  'none',
  '--pull',
  'never',
  '-e',
  'NODE_ENV=production',
  '-e',
  'NEXT_TELEMETRY_DISABLED=1',
  '-v',
  `${resolve(fixtures, 'probe.mjs')}:/tmp/intl-probe.mjs:ro`,
  image,
  'node',
  '/tmp/intl-probe.mjs',
  app,
])
