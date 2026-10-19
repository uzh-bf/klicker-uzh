import type { CodeProfile } from './profiles'
import runtimeManifest from './runtime-manifest.json'

export interface RuntimeFile {
  sha256: string
  size: number
  type: string
}

interface RuntimeManifest {
  version: string
  runnerScriptSha256: string
  profiles: Record<CodeProfile, string[]>
  files: Record<string, RuntimeFile>
}

// Generated and verified by scripts/code-runtimes.mjs; never edit by hand.
export const CODE_RUNTIME_MANIFEST = runtimeManifest as RuntimeManifest

export const CODE_RUNTIME_PATH_PREFIX = '/code-runtimes/'
export const CODE_RUNTIME_BASE_PATH = `${CODE_RUNTIME_PATH_PREFIX}${CODE_RUNTIME_MANIFEST.version}/`

export const RUNNER_DOCUMENTS: Record<CodeProfile, string> = {
  'python-core': 'runner-python.html',
  'r-base': 'runner-r.html',
}
