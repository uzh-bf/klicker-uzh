export function isVideoSourceType(hint: unknown): boolean {
  if (typeof hint !== 'string') return false
  const lower = hint.toLowerCase()
  return lower.includes('video') || lower.includes('youtube')
}
