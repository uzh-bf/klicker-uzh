import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'

const execute = promisify(execFile)

// Call only from an explicit lifecycle operation after its ownership gate.
// Captured output can include the local Hatchet token and must not be logged.
export async function runLocalDocker(args) {
  return runHostCommand('docker', args, 300000)
}

export async function runLocalManaged(args) {
  return runHostCommand('devrouter', args, 1800000)
}

async function runHostCommand(command, args, timeout) {
  try {
    const { stdout } = await execute(command, args, {
      encoding: 'utf8',
      timeout,
      maxBuffer: 1024 * 1024,
      env: { PATH: process.env.PATH, HOME: process.env.HOME },
    })
    return stdout.trim()
  } catch {
    throw new Error(`Local ${command} operation failed; output withheld.`)
  }
}

function readDocker(args) {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    // Do not inherit DOCKER_HOST, remote context overrides or service keys.
    env: { PATH: process.env.PATH, HOME: process.env.HOME },
  }).trim()
}

// This is only a fresh observation, not a reservation or restart permission.
// Setup must hold its exclusive preparation claim and repeat this check before
// its first Docker mutation. An existing project is never adopted implicitly.
export function inspectUnusedComposeProject(compose, read = readDocker) {
  const project = compose?.name
  const volumes = Object.values(compose?.volumes ?? {})
  if (
    typeof project !== 'string' ||
    !/^[a-z0-9][a-z0-9_-]+$/.test(project) ||
    volumes.length === 0 ||
    volumes.some(
      (volume) =>
        typeof volume?.name !== 'string' ||
        !volume.name.startsWith(`${project}-`) ||
        !/^[a-z0-9][a-z0-9_-]+$/.test(volume.name) ||
        volume.external
    )
  ) {
    throw new Error(
      'A rendered isolated project with owned volumes is required.'
    )
  }
  try {
    const context = read(['context', 'show']).trim()
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(context)) throw new Error()
    const endpoint = read([
      'context',
      'inspect',
      context,
      '--format',
      '{{.Endpoints.docker.Host}}',
    ]).trim()
    if (!endpoint.startsWith('unix:///') || /[\r\n]/.test(endpoint)) {
      return { unused: false, reason: 'local-docker-context-required' }
    }
    const command = (...args) => read(['--context', context, ...args]).trim()
    const filter = `label=com.docker.compose.project=${project}`
    const containers = command(
      'container',
      'ls',
      '--all',
      '--quiet',
      '--filter',
      filter
    )
    const networks = command('network', 'ls', '--quiet', '--filter', filter)
    const observedVolumes = new Set(
      command(
        'volume',
        'ls',
        '--filter',
        `name=${project}-`,
        '--format',
        '{{.Name}}'
      )
        .split(/\r?\n/)
        .filter(Boolean)
    )
    const volumeExists = volumes.some(({ name }) => observedVolumes.has(name))
    return containers || networks || volumeExists
      ? { unused: false, reason: 'existing-project-or-storage' }
      : { unused: true, context, reason: 'no-existing-project-or-storage' }
  } catch {
    // CLI diagnostics may disclose endpoint configuration. Report no output.
    return { unused: false, reason: 'docker-observation-unavailable' }
  }
}
