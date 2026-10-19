import { type CodeProfile, isCodeProfile } from '@klicker-uzh/code-runner'
import { MAX_STARTER_CODE_LENGTH } from './profiles'

export interface CodeCardResult {
  profile: CodeProfile
  starterCode: string
}

/** Reads a stored `open_code_card` tool result; anything malformed is null. */
export function parseCodeCardResult(value: unknown): CodeCardResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (record.kind !== 'code-card' || !isCodeProfile(record.profile)) return null
  if (typeof record.starterCode !== 'string') return null
  return {
    profile: record.profile,
    starterCode: record.starterCode.slice(0, MAX_STARTER_CODE_LENGTH),
  }
}
