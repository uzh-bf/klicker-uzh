import { createHash, randomInt } from 'node:crypto'

export function randomSixDigitCode() {
  return randomInt(100000, 1000000)
}

export function randomNineDigitCode() {
  return randomInt(100000000, 1000000000)
}

export function randomIndex(length: number) {
  return randomInt(length)
}

export function stableNumericId(value: string) {
  const hash = createHash('sha256').update(value).digest('hex')
  return Number.parseInt(hash.slice(0, 8), 16)
}

export function stableTemporaryNumericId(value: string) {
  return -stableNumericId(`temporary:${value}`) - 1
}

export function hashResponseBucket(value: string) {
  // Legacy response aggregation keys are persisted as MD5 buckets. This is not security-sensitive.
  return createHash('md5').update(value).digest('hex') // NOSONAR
}
