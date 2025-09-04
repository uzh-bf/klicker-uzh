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
   * Upsert a single entity (MVP approach - direct writes)
   */
  async upsertEntity(entity: AuditTableEntity): Promise<void> {
    try {
      await this.client.upsertEntity(entity, 'Merge')

      logger.debug(
        {
          partitionKey: entity.partitionKey,
          rowKey: entity.rowKey,
          tenantId: entity.tenantId,
        },
        'Entity upserted successfully'
      )
    } catch (error) {
      // Handle specific Azure Table errors
      if (error instanceof Error) {
        // Entity too large (>1MB total)
        if (
          error.message.includes('RequestBodyTooLarge') ||
          error.message.includes('EntityTooLarge')
        ) {
          throw new Error('Entity exceeds Azure Table Storage size limits')
        }

        // Throttling (429)
        if (
          error.message.includes('ServerBusy') ||
          error.message.includes('TooManyRequests')
        ) {
          logger.warn(
            {
              partitionKey: entity.partitionKey,
              error: error.message,
            },
            'Azure Table Storage throttling detected'
          )
          throw new Error('Storage service temporarily unavailable')
        }

        // Network or service errors
        if (
          error.message.includes('ENOTFOUND') ||
          error.message.includes('timeout')
        ) {
          logger.error(
            {
              partitionKey: entity.partitionKey,
              error: error.message,
            },
            'Network error connecting to Azure Table Storage'
          )
          throw new Error('Storage service connection failed')
        }
      }

      logger.error(
        {
          partitionKey: entity.partitionKey,
          rowKey: entity.rowKey,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to upsert entity'
      )

      throw error
    }
  }
}
