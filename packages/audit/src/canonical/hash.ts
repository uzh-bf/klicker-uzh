import { createHash } from 'node:crypto'
import { canonicalizeJson } from './canonicalize.js'

export function sha256Hex(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

export function hashCanonicalValue(value: unknown): string {
  return sha256Hex(canonicalizeJson(value))
}
