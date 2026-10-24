/**
 * Read a positive integer from the environment, rejecting anything a shell
 * could not have meant as a plain count.
 *
 * The knowledge-base ingestion and graph bounds share this reader so the
 * accepted format and the error text stay in one place. A value has to be a
 * run of digits with no sign, whitespace, or exponent, so `1e3` and `-1` are
 * rejected rather than silently interpreted.
 */
export function parsePositiveIntegerEnv(
  name: string,
  value: string | undefined,
  fallback: number
): number {
  if (value === undefined) {
    return fallback
  }
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${name} must be a positive integer`)
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${name} must be a positive integer`)
  }
  return parsed
}
