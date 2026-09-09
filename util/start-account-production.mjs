import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const helper = fileURLToPath(
  new URL('./production-standalone.mjs', import.meta.url)
)
const children = [
  'backend-docker',
  'auth',
  'frontend-pwa',
  'frontend-manage',
].map((app) =>
  spawn(process.execPath, [helper, 'start', app], {
    env: process.env,
    stdio: 'inherit',
  })
)
let stopping = false
function stop(code) {
  if (stopping) return
  stopping = true
  process.exitCode = code
  for (const child of children) child.kill('SIGTERM')
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(0))
for (const child of children) {
  child.on('error', () => stop(1))
  child.on('exit', () => {
    if (!stopping) stop(1)
  })
}
