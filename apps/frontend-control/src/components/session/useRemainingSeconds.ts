import dayjs from 'dayjs'
import { useEffect, useState } from 'react'

function getRemainingSeconds(expiresAt?: string | Date | null) {
  return expiresAt
    ? Math.max(0, dayjs(expiresAt).diff(dayjs(), 'second'))
    : null
}

// Seconds until `expiresAt`, ticking every second; null without an expiry.
function useRemainingSeconds(expiresAt?: string | Date | null) {
  const [remaining, setRemaining] = useState(() =>
    getRemainingSeconds(expiresAt)
  )

  useEffect(() => {
    setRemaining(getRemainingSeconds(expiresAt))
    if (!expiresAt) return

    const interval = setInterval(
      () => setRemaining(getRemainingSeconds(expiresAt)),
      1000
    )
    return () => clearInterval(interval)
  }, [expiresAt])

  return remaining
}

export function formatSeconds(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export default useRemainingSeconds
