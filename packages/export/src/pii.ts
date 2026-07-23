import { createHmac, randomBytes } from 'node:crypto'

export type PiiMode = 'full' | 'pseudonymize'

/**
 * Controls how direct identifiers are emitted by the transform functions.
 * - `full`: identifiers are written verbatim (default; files are still locked to 0600).
 * - `pseudonymize`: identifiers are replaced with a per-run HMAC-SHA256 digest so
 *   the same value maps to the same token within one export run (joinable, not reversible).
 */
export type PiiContext =
  | { mode: 'full' }
  | { mode: 'pseudonymize'; salt: string }

export const FULL_PII: PiiContext = { mode: 'full' }

/** Generates a fresh per-run salt (32 hex chars). Keep it in memory only. */
export function makePiiSalt(): string {
  return randomBytes(16).toString('hex')
}

/** Deterministically pseudonymizes a value within a run; empty/nullish stays empty. */
export function pseudonymize(
  value: string | null | undefined,
  salt: string
): string {
  if (value == null || value === '') return ''
  return createHmac('sha256', salt).update(value).digest('hex').substring(0, 16)
}

/** Applies a PII context to a direct identifier (email, sso id, matriculation, ...). */
export function applyPii(
  value: string | null | undefined,
  ctx: PiiContext
): string {
  return ctx.mode === 'pseudonymize'
    ? pseudonymize(value, ctx.salt)
    : (value ?? '')
}
