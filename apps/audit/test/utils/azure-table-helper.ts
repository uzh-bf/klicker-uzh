import {
  AzureNamedKeyCredential,
  TableClient,
  type TableEntity,
} from '@azure/data-tables'

const AZURITE_CONNECTION_STRING =
  'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;'

interface AuditTableEntity extends TableEntity {
  scope: string
  subject: string
  action: string
  eventTimestamp?: number
  attributes?: string // JSON serialized
  correlationId?: string
  correlationClaims?: string
  stage?: string
  outcome?: string
  reasonCode?: string
  schemaVersion: number
  resourceId?: string
  sessionId?: string
  userId?: string
}

interface TableStats {
  totalEntities: number
  partitionCount: number
  actions: string[]
  oldestTimestamp: number | null
  newestTimestamp: number | null
}

interface ConnectionStringParts {
  [key: string]: string
}

export class AzureTableTestHelper {
  private client: TableClient
  private tableName: string

  constructor(
    tableName = process.env.AZURE_TABLES_TABLE_NAME || 'auditevents'
  ) {
    this.tableName = tableName

    // Parse Azurite connection string
    const parts: ConnectionStringParts = AZURITE_CONNECTION_STRING.split(
      ';'
    ).reduce((acc, part) => {
      const [key, value] = part.split('=', 2)
      if (key && value) acc[key] = value
      return acc
    }, {} as ConnectionStringParts)

    const accountUrl = parts.TableEndpoint!
    const accountName = parts.AccountName!
    const accountKey = parts.AccountKey!

    if (!accountUrl || !accountName || !accountKey) {
      throw new Error('Invalid Azurite connection string')
    }

    const credential = new AzureNamedKeyCredential(accountName, accountKey)
    this.client = new TableClient(accountUrl, tableName, credential, {
      allowInsecureConnection: true,
    })
  }

  /**
   * Setup test environment - ensure table exists
   */
  async setup(): Promise<void> {
    try {
      await this.client.createTable()
    } catch (error) {
      // Ignore if table already exists
      if (!(error as Error).message?.includes('TableAlreadyExists')) {
        throw error
      }
    }
  }

  /**
   * Cleanup test data - delete all entities from the table
   */
  async cleanup(): Promise<void> {
    try {
      // Get all entities
      const entities: Array<{ partitionKey: string; rowKey: string }> = []
      for await (const entity of this.client.listEntities()) {
        entities.push({
          partitionKey: entity.partitionKey!,
          rowKey: entity.rowKey!,
        })
      }

      // Delete all entities
      for (const entity of entities) {
        try {
          await this.client.deleteEntity(entity.partitionKey, entity.rowKey)
        } catch (error) {
          // Ignore if entity doesn't exist
          if (!(error as Error).message?.includes('ResourceNotFound')) {
            console.warn(`Failed to delete entity: ${(error as Error).message}`)
          }
        }
      }
    } catch (error) {
      console.warn(`Cleanup failed: ${(error as Error).message}`)
    }
  }

  /**
   * Get a specific entity by partition and row key
   */
  async getEntity(
    partitionKey: string,
    rowKey: string
  ): Promise<AuditTableEntity | null> {
    try {
      const entity = await this.client.getEntity<AuditTableEntity>(
        partitionKey,
        rowKey
      )
      return entity
    } catch (error) {
      if ((error as Error).message?.includes('ResourceNotFound')) {
        return null
      }
      throw error
    }
  }

  /**
   * Get all entities (without tenant filtering)
   */
  async getAllEntities(limit = 1000): Promise<AuditTableEntity[]> {
    const entities: AuditTableEntity[] = []

    for await (const entity of this.client.listEntities<AuditTableEntity>()) {
      entities.push(entity)
      if (entities.length >= limit) break
    }

    return entities
  }

  /**
   * Get all entities in a partition
   */
  async getEntitiesInPartition(
    partitionKey: string,
    limit = 1000
  ): Promise<AuditTableEntity[]> {
    const entities: AuditTableEntity[] = []
    const filter = `PartitionKey eq '${partitionKey}'`

    for await (const entity of this.client.listEntities<AuditTableEntity>({
      queryOptions: { filter },
    })) {
      entities.push(entity)
      if (entities.length >= limit) break
    }

    return entities
  }

  /**
   * Count total entities in table
   */
  async getEntityCount(): Promise<number> {
    let count = 0
    for await (const entity of this.client.listEntities()) {
      count++
    }
    return count
  }

  /**
   * Get all unique partition keys
   */
  async getPartitionKeys(): Promise<string[]> {
    const partitionKeys = new Set<string>()
    for await (const entity of this.client.listEntities()) {
      partitionKeys.add(entity.partitionKey!)
    }
    return Array.from(partitionKeys)
  }

  /**
   * Verify entity exists and matches expected values
   */
  async verifyEntity(
    partitionKey: string,
    rowKey: string,
    expectedValues: Record<string, any> = {}
  ): Promise<AuditTableEntity> {
    const entity = await this.getEntity(partitionKey, rowKey)

    if (!entity) {
      throw new Error(`Entity not found: ${partitionKey}/${rowKey}`)
    }

    // Check expected values
    for (const [key, expectedValue] of Object.entries(expectedValues)) {
      const actualValue = entity[key as keyof AuditTableEntity]

      if (typeof expectedValue === 'object' && expectedValue !== null) {
        // For complex objects, compare JSON strings
        const actualObj =
          typeof actualValue === 'string'
            ? JSON.parse(actualValue)
            : actualValue
        if (JSON.stringify(actualObj) !== JSON.stringify(expectedValue)) {
          throw new Error(
            `Entity ${key} mismatch. Expected: ${JSON.stringify(expectedValue)}, Got: ${JSON.stringify(actualObj)}`
          )
        }
      } else if (actualValue !== expectedValue) {
        throw new Error(
          `Entity ${key} mismatch. Expected: ${expectedValue}, Got: ${actualValue}`
        )
      }
    }

    return entity
  }

  /**
   * Wait for entity to be persisted (with timeout)
   */
  async waitForEntity(
    partitionKey: string,
    rowKey: string,
    timeoutMs = 5000,
    pollIntervalMs = 100
  ): Promise<AuditTableEntity> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeoutMs) {
      const entity = await this.getEntity(partitionKey, rowKey)
      if (entity) {
        return entity
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }

    throw new Error(
      `Entity not found after ${timeoutMs}ms: ${partitionKey}/${rowKey}`
    )
  }

  /**
   * Wait for a specific number of entities to be persisted
   */
  async waitForEntityCount(
    expectedCount: number,
    timeoutMs = 10000,
    pollIntervalMs = 200
  ): Promise<number> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeoutMs) {
      const count = await this.getEntityCount()
      if (count >= expectedCount) {
        return count
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }

    const finalCount = await this.getEntityCount()
    throw new Error(
      `Expected ${expectedCount} entities, but found ${finalCount} after ${timeoutMs}ms`
    )
  }

  /**
   * Get table statistics
   */
  async getTableStats(): Promise<TableStats> {
    const stats: TableStats = {
      totalEntities: 0,
      partitionCount: 0,
      actions: [],
      oldestTimestamp: null,
      newestTimestamp: null,
    }

    const actionsSet = new Set<string>()

    for await (const entity of this.client.listEntities<AuditTableEntity>()) {
      stats.totalEntities++
      actionsSet.add(entity.action)

      const timestamp = toNumericTimestamp(
        (entity as AuditTableEntity).eventTimestamp ?? entity.timestamp
      )

      if (timestamp !== null) {
        if (
          stats.oldestTimestamp === null ||
          timestamp < stats.oldestTimestamp
        ) {
          stats.oldestTimestamp = timestamp
        }
        if (
          stats.newestTimestamp === null ||
          timestamp > stats.newestTimestamp
        ) {
          stats.newestTimestamp = timestamp
        }
      }
    }

    stats.partitionCount = (await this.getPartitionKeys()).length
    stats.actions = Array.from(actionsSet)

    return stats
  }
}

function toNumericTimestamp(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}
