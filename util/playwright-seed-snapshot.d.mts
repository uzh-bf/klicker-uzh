export const SNAPSHOT_MISS_EXIT: 3
export const DISPOSABLE_DATABASE: 'klicker_test'
export const DISPOSABLE_MARKER: 'klicker-disposable-test-v1'

interface DockerResult {
  status: number | null
  stdout: string
  stderr: string
}

interface DockerRunner {
  (args: string[], options?: { input?: string }): DockerResult
}

interface SnapshotOptions {
  env?: NodeJS.ProcessEnv
  runDocker?: DockerRunner
  cacheRoot?: string
}

interface SeedSnapshotResult {
  status: 'restored' | 'captured' | 'miss' | 'skipped' | 'error'
  message: string
  elapsedMs?: number
}

export function captureSeedSnapshot(
  options?: SnapshotOptions
): SeedSnapshotResult

export function restoreSeedSnapshot(
  options?: SnapshotOptions
): SeedSnapshotResult

export function snapshotEnvironmentState(env?: NodeJS.ProcessEnv): string | null

export function composeRestoreSql(snapshotDump: string): string

export function collectKeySources(options?: {
  root?: string
  readFile?: (path: string, encoding: string) => string
}): Map<string, string>

export function computeSeedSnapshotKey(input: {
  sources: Map<string, string>
  postgresMajor: number
  timezone: string
  year: number
}): string
