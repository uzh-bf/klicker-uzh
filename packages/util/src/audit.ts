import type {
  AuditClientConfig,
  AuditEvent,
  AuditResponse,
} from '@klicker-uzh/types'

/**
 * Backend Audit Client for internal service communication
 * Simple, reliable audit logging with clear success/failure responses
 */
export class AuditClient {
  private config: {
    serviceUrl: string
    internalToken: string
    timeout: number
    enabled: boolean
  }

  constructor(config: AuditClientConfig = {}) {
    this.config = {
      serviceUrl:
        config.serviceUrl ||
        process.env.AUDIT_SERVICE_URL ||
        'http://audit-service:3000',
      internalToken: config.internalToken || process.env.INTERNAL_TOKEN || '',
      timeout: config.timeout ?? 5000,
      enabled: config.enabled ?? process.env.AUDIT_ENABLED !== 'false',
    }

    if (!this.config.internalToken) {
      console.warn(
        'AuditClient: No INTERNAL_TOKEN configured, audit logging will fail'
      )
    }
  }

  /**
   * Log a single audit event with simple retry logic
   * Returns the audit response or null if logging failed
   */
  async log(event: AuditEvent): Promise<AuditResponse | null> {
    if (!this.config.enabled) {
      return null
    }

    let lastError: Error | null = null

    // Try twice: initial attempt + 1 retry
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await this.makeRequest('/audit', 'POST', event)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }

        const result = (await response.json()) as AuditResponse
        return result
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
   * Convenience method to log login events
   */
  async logLogin(
    tenantId: string,
    userId: string,
    success: boolean,
    metadata?: any
  ): Promise<AuditResponse | null> {
    return this.log({
      tenantId,
      subject: `user:${userId}`,
      action: success ? 'login.success' : 'login.failed',
      userId,
      attributes: metadata,
    })
  }

  /**
   * Convenience method to log data access events
   */
  async logDataAccess(
    tenantId: string,
    userId: string,
    resource: string,
    action: string,
    resourceId?: string
  ): Promise<AuditResponse | null> {
    return this.log({
      tenantId,
      subject: `user:${userId}`,
      action: `data.${action}`,
      resourceId,
      userId,
      attributes: {
        resourceType: resource,
        operation: action,
      },
    })
  }

  /**
   * Convenience method to log system errors
   */
  async logError(
    tenantId: string,
    subject: string,
    error: Error,
    context?: any
  ): Promise<AuditResponse | null> {
    return this.log({
      tenantId,
      subject,
      action: 'error.system',
      attributes: {
        error: error.message,
        stack: error.stack,
        context,
      },
    })
  }

  /**
   * Convenience method to log user actions
   */
  async logUserAction(
    tenantId: string,
    userId: string,
    action: string,
    resourceId?: string,
    metadata?: any
  ): Promise<AuditResponse | null> {
    return this.log({
      tenantId,
      subject: `user:${userId}`,
      action,
      resourceId,
      userId,
      attributes: metadata,
    })
  }

  /**
   * Make HTTP request to audit service with authentication
   */
  private async makeRequest(
    path: string,
    method: string,
    body?: any
  ): Promise<Response> {
    const url = `${this.config.serviceUrl}${path}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': this.config.internalToken,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      return response
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

/**
 * Default audit client instance
 * Can be used directly or create your own instance with custom config
 */
export const auditClient = new AuditClient()
