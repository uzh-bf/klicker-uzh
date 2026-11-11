// Azure metadata names are case-insensitive; validate every matching entry so
// conflicting aliases cannot hide an integrity mismatch.
export function matchesBlobMetadata(
  metadata: Record<string, string> | undefined,
  key: 'sha256' | 'bytelength',
  expected: string
): boolean {
  const entries = Object.entries(metadata ?? {}).filter(
    ([name]) => name.toLowerCase() === key
  )
  return entries.length > 0 && entries.every(([, value]) => value === expected)
}
