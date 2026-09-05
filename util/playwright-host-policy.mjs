import { existsSync } from 'node:fs'

export const HOST_RUNNER_ENV = 'KLICKER_PLAYWRIGHT_HOST_RUNNER'

export function isContainerRuntime({
  cwd = process.cwd(),
  env = process.env,
  pathExists = existsSync,
} = {}) {
  return (
    env.KLICKER_DEVCONTAINER === '1' ||
    env.REMOTE_CONTAINERS === 'true' ||
    cwd.startsWith('/workspaces/') ||
    pathExists('/.dockerenv') ||
    pathExists('/run/.containerenv')
  )
}

export function assertPlaywrightHostBoundary(options = {}) {
  const env = options.env ?? process.env

  // The existing GitHub Actions jobs intentionally run in the official
  // Playwright container. Local containers are the boundary being rejected.
  if (env.GITHUB_ACTIONS === 'true' && env.CI === 'true') return

  if (isContainerRuntime({ ...options, env })) {
    throw new Error(
      'Local Playwright execution is host-only. Exit the devcontainer and run `pnpm playwright:host -- <args>` from the host.'
    )
  }

  if (env[HOST_RUNNER_ENV] !== '1') {
    throw new Error(
      'Local Playwright must use the host launcher so it targets the exact devrouter workspace. Run `pnpm playwright:host -- <args>`.'
    )
  }
}
