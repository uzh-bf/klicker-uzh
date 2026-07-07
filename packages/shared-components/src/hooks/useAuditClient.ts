import type { PublicAuditEvent } from '@klicker-uzh/types'
import { useCallback, useState } from 'react'

interface UseAuditClientOptions {
  enabled?: boolean
  assessmentMode?: boolean
  baseUrl?: string
  onError?: (error: Error) => void
}

interface AuditClientAPI {
  log: (event: PublicAuditEvent) => Promise<void>
  logAsync: (event: PublicAuditEvent) => void
  isLoading: boolean
  error: Error | null
}

/**
 * Frontend audit client hook for logging user actions
 * Only logs events when in assessment mode
 * Includes simple retry mechanism with exponential backoff
 */
export default function useAuditClient(
  options: UseAuditClientOptions = {}
): AuditClientAPI {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const {
    enabled = process.env.NEXT_PUBLIC_AUDIT_ENABLED === 'true',
    assessmentMode = false,
    baseUrl = process.env.NEXT_PUBLIC_AUDIT_SERVICE_URL || '',
    onError,
  } = options

  const log = useCallback(
    async (event: PublicAuditEvent) => {
      // Only log in assessment mode
      if (!enabled || !assessmentMode) {
        return
      }

      setIsLoading(true)
      setError(null)

      let lastError: Error | null = null
      const maxRetries = 3

      // Try up to 3 times with exponential backoff
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const url = `${baseUrl}/audit/public`
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include', // Automatically sends domain cookies
            body: JSON.stringify(
              Object.fromEntries(
                Object.entries(event).filter(
                  ([_, value]) => value !== undefined
                )
              )
            ),
          })

          if (!response.ok) {
            throw new Error(
              `Audit logging failed: ${response.status} ${response.statusText}`
            )
          }

          // Success - exit retry loop
          setIsLoading(false)
          return
        } catch (err) {
          lastError =
            err instanceof Error ? err : new Error('Unknown audit error')

          // Wait before retry with exponential backoff (500ms, 1s, 2s)
          if (attempt < maxRetries - 1) {
            const delay = 500 * Math.pow(2, attempt)
            await new Promise((resolve) => setTimeout(resolve, delay))
          }
        }
      }

      // All retries failed
      setError(lastError)
      setIsLoading(false)

      if (onError && lastError) {
        onError(lastError)
      } else {
        // Silent fail for audit logging - don't disrupt user experience
        console.warn('Audit logging failed after retries:', lastError?.message)
      }
    },
    [enabled, assessmentMode, baseUrl, onError]
  )

  const logAsync = useCallback(
    (event: PublicAuditEvent) => {
      // Fire and forget - don't block UI
      log(event).catch(() => {
        // Already handled in log function
      })
    },
    [log]
  )

  return {
    log,
    logAsync,
    isLoading,
    error,
  }
}
