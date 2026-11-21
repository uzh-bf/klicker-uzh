export const REVIEW_VERDICTS = [
  'AS_EXPECTED',
  'TOO_HIGH',
  'TOO_LOW',
  'UNSURE',
] as const

export function verdictKey(verdict: string) {
  return (REVIEW_VERDICTS as readonly string[]).includes(verdict)
    ? (verdict as (typeof REVIEW_VERDICTS)[number])
    : 'UNSURE'
}
