import canonicalize from 'canonicalize'
import type { JsonValue } from '../contract/payloads/common.js'

function normalizeJsonValue(value: unknown, path: string): JsonValue {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TypeError(`Invalid Date at ${path}`)
    }
    return value.toISOString()
  }

  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return value
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Non-finite number at ${path}`)
    }
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      normalizeJsonValue(item, `${path}[${index}]`)
    )
  }

  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`Non-JSON object at ${path}`)
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
        if (nested === undefined) {
          throw new TypeError(`Undefined value at ${path}.${key}`)
        }
        return [key, normalizeJsonValue(nested, `${path}.${key}`)]
      })
    )
  }

  throw new TypeError(`Unsupported JSON value at ${path}`)
}

export function canonicalizeJson(value: unknown): string {
  const normalized = normalizeJsonValue(value, '$')
  const result = canonicalize(normalized)
  if (result === undefined) {
    throw new TypeError('Value cannot be represented as canonical JSON')
  }
  return result
}

export function canonicalByteLength(canonicalJson: string): number {
  return Buffer.byteLength(canonicalJson, 'utf8')
}
