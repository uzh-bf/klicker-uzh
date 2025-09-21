import { AzureNamedKeyCredential, TableClient } from '@azure/data-tables'
import { logger } from '../utils/logger.js'
import type { AuditTableEntity } from './entities.js'

export class AuditTableClient {
  private client: TableClient

  constructor(connectionString: string, tableName: string) {
    // Handle both connection string and URL+credential approaches for Azurite compatibility
    if (connectionString.includes('TableEndpoint=')) {
      // Parse connection string format for Azurite compatibility
      const parts = connectionString.split(';').reduce(
        (acc, part) => {
          const [key, value] = part.split('=', 2)
          if (key && value) acc[key] = value
          return acc
        },
        {} as Record<string, string>
      )

      const accountUrl = parts.TableEndpoint
      const accountName = parts.AccountName
      const accountKey = parts.AccountKey

      if (!accountUrl || !accountName || !accountKey) {
        throw new Error('Invalid connection string format')
      }

      const credential = new AzureNamedKeyCredential(accountName, accountKey)
      this.client = new TableClient(accountUrl, tableName, credential, {
        allowInsecureConnection: accountUrl.startsWith('http:'), // Allow HTTP for Azurite
      })
    } else {
      // Fallback to direct connection string (for production Azure)
      this.client = new TableClient(connectionString, tableName)
    }
  }

  /**
   * Ensure the table exists (idempotent operation)
   */
  async ensureTable(): Promise<void> {
    try {
      await this.client.createTable()
      logger.info(
        { tableName: this.client.tableName },
        'Azure Table created or already exists'
      )
    } catch (error) {
      // Ignore "table already exists" errors
      if (
        error instanceof Error &&
        error.message.includes('TableAlreadyExists')
      ) {
        logger.debug(
          { tableName: this.client.tableName },
          'Table already exists'
        )
        return
      }

      logger.error(
        {
          tableName: this.client.tableName,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to create table'
      )
      throw error
    }
  }

  /**
   * Check connectivity to Azure Table Storage
   * Used for health/readiness checks
   */
  async checkConnection(): Promise<void> {
    try {
      // Perform a lightweight operation to verify connectivity
      // Use listEntities to check if we can communicate with the service
      const tablesList = this.client.listEntities()
      const result = await tablesList.next() // Just check if we can get the iterator

      logger.debug(
        { tableName: this.client.tableName },
        'Azure Table Storage connectivity verified'
      )
    } catch (error) {
      logger.error(
        {
          tableName: this.client.tableName,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Azure Table Storage connectivity check failed'
      )
      throw error
    }
  }

  /**
   * Upsert entity with automatic retry logic
   */
  async upsertEntity(entity: AuditTableEntity): Promise<void> {
    return this.upsertEntityWithRetry(entity, 3)
  }

  /**
   * Upsert a single entity with retry logic and exponential backoff
   */
  private async upsertEntityWithRetry(
    entity: AuditTableEntity,
    maxAttempts = 3
  ): Promise<void> {
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.performUpsert(entity)

        // Success - log retry info if this wasn't the first attempt
        if (attempt > 1) {
          logger.info(
            {
              partitionKey: entity.partitionKey,
              rowKey: entity.rowKey,
              attempt,
              maxAttempts,
            },
            'Entity upserted successfully after retry'
          )
        }
        return
      } catch (error) {
        lastError = error as Error

        // Don't retry non-retryable errors
        if (this.isNonRetryableError(lastError)) {
          logger.debug(
            {
              partitionKey: entity.partitionKey,
              error: lastError.message,
            },
            'Non-retryable error, failing immediately'
          )
          throw lastError
        }

        // Don't retry on final attempt
        if (attempt === maxAttempts) {
          logger.error(
            {
              partitionKey: entity.partitionKey,
              error: lastError.message,
              attempts: maxAttempts,
            },
            'All retry attempts exhausted'
          )
          break
        }

        // Calculate exponential backoff with jitter
        const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000) // Cap at 5s
        const jitter = Math.random() * baseDelay * 0.1 // 10% jitter
        const delay = baseDelay + jitter

        logger.warn(
          {
            partitionKey: entity.partitionKey,
            error: lastError.message,
            attempt,
            maxAttempts,
            retryAfterMs: Math.round(delay),
          },
          'Entity upsert failed, retrying'
        )

        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    throw lastError
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase()
    return (
      message.includes('entitytoolarge') ||
      message.includes('requestbodytoolarge') ||
      message.includes('invalid') ||
      message.includes('malformed') ||
      message.includes('unauthorized') ||
      message.includes('forbidden')
    )
  }

  /**
   * Perform the actual upsert operation
   */
  private async performUpsert(entity: AuditTableEntity): Promise<void> {
    try {
      await this.client.createEntity(entity)

      logger.debug(
        {
          partitionKey: entity.partitionKey,
          rowKey: entity.rowKey,
        },
        'Entity created successfully'
      )
    } catch (error) {
      // Handle specific Azure Table errors with consistent error messages
      if (error instanceof Error) {
        // Treat duplicate entities as success for idempotency
        const lowerCaseMessage = error.message.toLowerCase()
        const statusCode = (error as { statusCode?: number }).statusCode

        if (
          lowerCaseMessage.includes('entityalreadyexists') ||
          statusCode === 409
        ) {
          logger.debug(
            {
              partitionKey: entity.partitionKey,
              rowKey: entity.rowKey,
            },
            'Entity already exists, skipping create'
          )
          return
        }

        // Entity too large (>1MB total)
        if (
          lowerCaseMessage.includes('requestbodytoolarge') ||
          lowerCaseMessage.includes('entitytoolarge')
        ) {
          throw new Error('Entity exceeds Azure Table Storage size limits')
        }

        // Throttling (429) - make retryable
        if (
          lowerCaseMessage.includes('serverbusy') ||
          lowerCaseMessage.includes('toomanyrequests')
        ) {
          logger.debug(
            {
              partitionKey: entity.partitionKey,
              error: error.message,
            },
            'Azure Table Storage throttling detected'
          )
          throw new Error('Storage service temporarily unavailable')
        }

        // Network or service errors - make retryable
        if (
          lowerCaseMessage.includes('enotfound') ||
          lowerCaseMessage.includes('timeout')
        ) {
          logger.debug(
            {
              partitionKey: entity.partitionKey,
              error: error.message,
            },
            'Network error connecting to Azure Table Storage'
          )
          throw new Error('Storage service connection failed')
        }
      }

      // Log and rethrow original error for retry logic to handle
      logger.debug(
        {
          partitionKey: entity.partitionKey,
          rowKey: entity.rowKey,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Azure Table Storage operation failed'
      )

      throw error
    }
  }
}
