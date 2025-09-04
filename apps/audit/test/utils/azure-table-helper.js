import { AzureNamedKeyCredential, TableClient } from '@azure/data-tables'

const AZURITE_CONNECTION_STRING =
  'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;'

export class AzureTableTestHelper {
  constructor(tableName = 'auditlogs') {
    this.tableName = tableName

    // Parse Azurite connection string
    const parts = AZURITE_CONNECTION_STRING.split(';').reduce((acc, part) => {
      const [key, value] = part.split('=', 2)
      if (key && value) acc[key] = value
      return acc
    }, {})

    const accountUrl = parts.TableEndpoint
    const accountName = parts.AccountName
    const accountKey = parts.AccountKey

    const credential = new AzureNamedKeyCredential(accountName, accountKey)
    this.client = new TableClient(accountUrl, tableName, credential, {
      allowInsecureConnection: true,
    })
  }

  /**
   * Setup test environment - ensure table exists
   */
  async setup() {
    try {
      await this.client.createTable()
    } catch (error) {
      // Ignore if table already exists
      if (!error.message?.includes('TableAlreadyExists')) {
        throw error
      }
    }
  }

  /**
   * Cleanup test data - delete all entities from the table
   */
  async cleanup() {
    try {
      // Get all entities
      const entities = []
      for await (const entity of this.client.listEntities()) {
        entities.push({
          partitionKey: entity.partitionKey,
          rowKey: entity.rowKey,
        })
      }

      // Delete all entities
      for (const entity of entities) {
        try {
          await this.client.deleteEntity(entity.partitionKey, entity.rowKey)
        } catch (error) {
          // Ignore if entity doesn't exist
          if (!error.message?.includes('ResourceNotFound')) {
            console.warn(`Failed to delete entity: ${error.message}`)
          }
        }
      }
    } catch (error) {
      console.warn(`Cleanup failed: ${error.message}`)
    }
  }

  /**
   * Get a specific entity by partition and row key
   */
  async getEntity(partitionKey, rowKey) {
    try {
      return await this.client.getEntity(partitionKey, rowKey)
    } catch (error) {
      if (error.message?.includes('ResourceNotFound')) {
        return null
      }
      throw error
    }
  }

  /**
   * Get all entities for a specific tenant
   */
  async getEntitiesForTenant(tenantId, limit = 1000) {
    const entities = []
    const filter = `tenantId eq '${tenantId}'`

    for await (const entity of this.client.listEntities({
      queryOptions: { filter },
    })) {
      entities.push(entity)
      if (entities.length >= limit) break
    }

    return entities
  }

  /**
   * Get all entities in a partition
   */
  async getEntitiesInPartition(partitionKey, limit = 1000) {
    const entities = []
    const filter = `PartitionKey eq '${partitionKey}'`

    for await (const entity of this.client.listEntities({
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
  async getEntityCount() {
    let count = 0
    for await (const entity of this.client.listEntities()) {
      count++
    }
    return count
  }

  /**
   * Get all unique partition keys
   */
  async getPartitionKeys() {
    const partitionKeys = new Set()
    for await (const entity of this.client.listEntities()) {
      partitionKeys.add(entity.partitionKey)
    }
    return Array.from(partitionKeys)
  }

  /**
   * Verify entity exists and matches expected values
   */
  async verifyEntity(partitionKey, rowKey, expectedValues = {}) {
    const entity = await this.getEntity(partitionKey, rowKey)

    if (!entity) {
      throw new Error(`Entity not found: ${partitionKey}/${rowKey}`)
    }

    // Check expected values
    for (const [key, expectedValue] of Object.entries(expectedValues)) {
      const actualValue = entity[key]

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
    partitionKey,
    rowKey,
    timeoutMs = 5000,
    pollIntervalMs = 100
  ) {
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
    expectedCount,
    timeoutMs = 10000,
    pollIntervalMs = 200
  ) {
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
  async getTableStats() {
    const stats = {
      totalEntities: 0,
      partitionCount: 0,
      tenants: new Set(),
      actions: new Set(),
      oldestTimestamp: null,
      newestTimestamp: null,
    }

    for await (const entity of this.client.listEntities()) {
      stats.totalEntities++
      stats.tenants.add(entity.tenantId)
      stats.actions.add(entity.action)

      if (entity.timestamp) {
        if (
          !stats.oldestTimestamp ||
          entity.timestamp < stats.oldestTimestamp
        ) {
          stats.oldestTimestamp = entity.timestamp
        }
        if (
          !stats.newestTimestamp ||
          entity.timestamp > stats.newestTimestamp
        ) {
          stats.newestTimestamp = entity.timestamp
        }
      }
    }

    stats.partitionCount = (await this.getPartitionKeys()).length
    stats.tenants = Array.from(stats.tenants)
    stats.actions = Array.from(stats.actions)

    return stats
  }
}
