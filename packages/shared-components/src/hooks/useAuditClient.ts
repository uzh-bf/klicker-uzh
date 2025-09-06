import type { AuditEvent } from '@klicker-uzh/types'
import { useCallback, useState } from 'react'

interface UseAuditClientOptions {
  enabled?: boolean
  assessmentMode?: boolean
  baseUrl?: string
  onError?: (error: Error) => void
}

interface AuditClientAPI {
  log: (event: Omit<AuditEvent, 'tenantId'>) => Promise<void>
  logAsync: (event: Omit<AuditEvent, 'tenantId'>) => void
  isLoading: boolean
  error: Error | null
}

/**
 * Frontend audit client hook for logging user actions
 * Only logs events when in assessment mode
 * Includes simple retry mechanism with exponential backoff
 */
export function useAuditClient(
  options: UseAuditClientOptions = {}
): AuditClientAPI {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const {
    enabled = true,
    assessmentMode = false,
    baseUrl = '',
    onError,
  } = options

  const log = useCallback(
    async (event: Omit<AuditEvent, 'tenantId'>) => {
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
            body: JSON.stringify(event),
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
    (event: Omit<AuditEvent, 'tenantId'>) => {
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

/**
 * Convenience hook for common audit actions in assessment mode
 */
export function useAssessmentAudit(
  assessmentMode: boolean = false,
  baseUrl?: string
) {
  const audit = useAuditClient({ assessmentMode, baseUrl })

  const logQuizAction = useCallback(
    (action: string, quizId: string, metadata?: any) => {
      audit.logAsync({
        subject: 'participant',
        action: `quiz.${action}`,
        resourceId: quizId,
        attributes: metadata,
      })
    },
    [audit]
  )

  const logElementInteraction = useCallback(
    (action: string, elementId: string, metadata?: any) => {
      audit.logAsync({
        subject: 'participant',
        action: `element.${action}`,
        resourceId: elementId,
        attributes: metadata,
      })
    },
    [audit]
  )

  const logResponseSubmission = useCallback(
    (elementId: string, responseData?: any) => {
      audit.logAsync({
        subject: 'participant',
        action: 'response.submitted',
        resourceId: elementId,
        attributes: {
          hasResponse: !!responseData,
          responseType: typeof responseData,
        },
      })
    },
    [audit]
  )

  const logNavigation = useCallback(
    (from: string, to: string, metadata?: any) => {
      audit.logAsync({
        subject: 'participant',
        action: 'navigation.change',
        attributes: {
          from,
          to,
          ...metadata,
        },
      })
    },
    [audit]
  )

  return {
    logQuizAction,
    logElementInteraction,
    logResponseSubmission,
    logNavigation,
    ...audit,
  }
}
