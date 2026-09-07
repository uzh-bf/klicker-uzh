export const HOST_RUNNER_ENV: 'KLICKER_PLAYWRIGHT_HOST_RUNNER'

interface HostBoundaryOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  pathExists?: (path: string) => boolean
}

export function isContainerRuntime(options?: HostBoundaryOptions): boolean

export function assertPlaywrightHostBoundary(
  options?: HostBoundaryOptions
): void
