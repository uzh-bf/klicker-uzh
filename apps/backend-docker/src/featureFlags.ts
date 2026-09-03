const INVALID_REFRESH_INTERVAL_MESSAGE =
  '[feature-flags] GROWTHBOOK_REFRESH_INTERVAL_MS must be a positive number; using the default refresh interval.'

export function parseRefreshInterval(
  value: string | undefined,
  warn: (message: string) => void = (message) => console.warn(message)
): number | undefined {
  if (value === undefined) return undefined

  const interval = Number(value)
  if (value.trim() === '' || !Number.isFinite(interval) || interval <= 0) {
    warn(INVALID_REFRESH_INTERVAL_MESSAGE)
    return undefined
  }

  return interval
}
