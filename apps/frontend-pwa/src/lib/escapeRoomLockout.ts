type Timestamp = string | number | Date

// Seconds of lockout left for an escape room attempt, derived from server data
// only. The server stamps `lockoutUntil` on its own clock, and `remainingSeconds`
// tells where that clock stood when the attempt was fetched, so the device
// clock offset never enters. Time since the fetch comes from two readings of
// the same device clock (for example performance.now()). The result is clamped
// to the configured lockout so a stale snapshot cannot overstate the wait.
export function getEscapeRoomLockoutRemainingSeconds({
  lockoutUntil,
  startedAt,
  timeLimit,
  remainingSeconds,
  lockoutSeconds,
  receivedAtMs,
  nowMs,
}: {
  lockoutUntil?: Timestamp | null
  startedAt: Timestamp
  // seconds, as on the attempt
  timeLimit: number
  remainingSeconds: number
  lockoutSeconds: number
  receivedAtMs: number
  nowMs: number
}) {
  if (!lockoutUntil || remainingSeconds <= 0) return 0

  const serverNowAtReceiptMs =
    new Date(startedAt).getTime() + (timeLimit - remainingSeconds) * 1000
  const serverNowMs = serverNowAtReceiptMs + (nowMs - receivedAtMs)
  const remaining = Math.ceil(
    (new Date(lockoutUntil).getTime() - serverNowMs) / 1000
  )

  return Math.min(Math.max(remaining, 0), Math.max(lockoutSeconds, 0))
}
