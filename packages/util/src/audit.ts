import type {
  AuditClientConfig,
  AuditEvent,
  AuditResponse,
} from '@klicker-uzh/types'
import axios, { type AxiosResponse } from 'axios'
import { createHash } from 'crypto'

/**
 * Helper function to generate a secure hash for sensitive data like PINs
 */
export function hashSensitiveData(data: string | number): string {
  return createHash('sha256').update(String(data)).digest('hex')
}

/**
 * Backend Audit Client for internal service communication
 * Simple, reliable audit logging with clear success/failure responses
 */
export class AuditClient {
  private config: {
    serviceUrl: string
    auditToken: string
    timeout: number
    enabled: boolean
  }

  constructor(config: AuditClientConfig = {}) {
    const enabled = config.enabled ?? process.env.AUDIT_ENABLED !== 'false'
    if (!enabled) {
      console.warn('AuditClient: Audit logging is disabled')
    }

    const serviceUrl = config.serviceUrl || process.env.AUDIT_SERVICE_URL
    if (typeof serviceUrl !== 'string' || !serviceUrl) {
      throw new Error('Audit Service URL is not set')
    }

    const auditToken = config.auditToken || process.env.AUDIT_TOKEN
    if (typeof auditToken !== 'string' || !auditToken) {
      throw new Error('Audit token is not set')
    }

    this.config = {
      serviceUrl,
      auditToken,
      timeout: config.timeout ?? 5000,
      enabled,
    }

    if (!this.config.auditToken) {
      console.warn(
        'AuditClient: No AUDIT_TOKEN configured, audit logging will fail'
      )
    }
  }

  /**
   * Log a single audit event with simple retry logic
   * Returns the audit response or null if logging failed
   */
  async log(event: AuditEvent): Promise<AuditResponse | null> {
    if (!this.config.enabled) {
      console.warn(
        'AuditClient: Audit logging is disabled, ignoring event',
        event
      )
      return null
    }

    let lastError: Error | null = null

    // Try twice: initial attempt + 1 retry
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await this.makeRequest('/audit', 'POST', event)

        if (response.status < 200 || response.status >= 300) {
          const payload =
            typeof response.data === 'string'
              ? response.data
              : response.data !== undefined
                ? JSON.stringify(response.data)
                : ''

          throw new Error(`HTTP ${response.status}: ${payload}`)
        }

        return response.data as AuditResponse
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')

        // Wait before retry (exponential backoff)
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }
    }

    // Both attempts failed
    console.error(
      'AuditClient: Failed to log event after retries:',
      lastError?.message,
      event
    )
    return null
  }

  /**
   * Make HTTP request to audit service with authentication
   */
  private async makeRequest(
    path: string,
    method: string,
    body?: any
  ): Promise<AxiosResponse> {
    const url = `${this.config.serviceUrl}${path}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const response = await axios.request({
        url,
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': this.config.auditToken,
        },
        data: body,
        signal: controller.signal,
        validateStatus: () => true,
      })

      return response
    } finally {
      clearTimeout(timeoutId)
    }
  }
}
