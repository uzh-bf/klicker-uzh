import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AzureTableTestHelper } from './utils/azure-table-helper.js'

const BASE_URL = 'http://localhost:7080'
const AUTH_TOKEN = process.env.AUDIT_TOKEN || 'test-secret-token-123'

// Test helper instance
const tableHelper = new AzureTableTestHelper()

function extractEntityTimestamp(entity: any): number {
  const raw = entity.eventTimestamp ?? entity.timestamp

  if (typeof raw === 'number') {
    return raw
  }

  if (typeof raw === 'string') {
    const parsed = Date.parse(raw)
    if (Number.isNaN(parsed)) {
      throw new Error(`Unable to parse timestamp value: ${raw}`)
    }
    return parsed
  }

  throw new Error('Timestamp not found on entity')
}

// Helper function to make authenticated requests
async function makeAuthenticatedRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${BASE_URL}${path}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Internal-Token': AUTH_TOKEN,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  return response
}

describe('Database Verification Tests', () => {
  beforeAll(async () => {
    console.log('Setting up database verification tests...')
    await tableHelper.setup()
    await tableHelper.cleanup()
  })

  beforeEach(async () => {
    await tableHelper.cleanup()
  })

  afterAll(async () => {
    console.log('Cleaning up database verification tests...')
    await tableHelper.cleanup()
  })

  describe('Data Persistence Verification', () => {
    it('should verify that accepted events are actually persisted in Azure Table Storage', async () => {
      const testId = Date.now()
      const events = [
        {
          subject: 'user:test1',
          action: 'test.action1',
          eventId: `persist-${testId}-1`,
        },
        {
          subject: 'user:test2',
          action: 'test.action2',
          eventId: `persist-${testId}-2`,
          attributes: { complexData: { nested: true, value: 123 } },
        },
      ]

      // Submit events
      for (const event of events) {
        const response = await makeAuthenticatedRequest('/audit', {
          method: 'POST',
          body: JSON.stringify(event),
        })
        expect(response.status).toBe(200)
      }

      // Wait for persistence
      await tableHelper.waitForEntityCount(2, 10000)

      // Verify both events are actually in the database
      const persistedEntities = (await tableHelper.getAllEntities()).filter(
        (e) => events.some((event) => event.eventId === e.rowKey)
      )
      expect(persistedEntities.length).toBe(events.length)

      // Verify data integrity
      for (const event of events) {
        const found = persistedEntities.find((e) => e.rowKey === event.eventId)
        expect(found).toBeTruthy()
        if (!found) continue
        expect(found.subject).toBe(event.subject)
        expect(found.action).toBe(event.action)
        expect(found.scope).toBe('internal')

        if (event.attributes) {
          const persistedAttributes = JSON.parse(found!.attributes!)
          expect(persistedAttributes).toEqual(event.attributes)
        }
      }
    })

    it('should verify that duplicate eventIds result in only one database record', async () => {
      const testId = Date.now()
      const event = {
        subject: 'user:duplicate',
        action: 'test.duplicate',
        eventId: `duplicate-${testId}`,
      }

      // Submit same event multiple times
      const responses = await Promise.all([
        makeAuthenticatedRequest('/audit', {
          method: 'POST',
          body: JSON.stringify(event),
        }),
        makeAuthenticatedRequest('/audit', {
          method: 'POST',
          body: JSON.stringify(event),
        }),
        makeAuthenticatedRequest('/audit', {
          method: 'POST',
          body: JSON.stringify(event),
        }),
      ])

      // All should be accepted
      responses.forEach((response) => expect(response.status).toBe(200))

      // Wait and verify only one record exists
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const entities = (await tableHelper.getAllEntities()).filter(
        (e) => e.rowKey === event.eventId
      )
      expect(entities.length).toBe(1)
    })
  })

  describe('Partition Key Generation and Distribution', () => {
    it('should generate partition keys based on tenant, timestamp, and shard', async () => {
      const testId = Date.now()
      const baseTimestamp = Date.now()

      const event = {
        subject: 'user:partition',
        action: 'test.partition',
        eventId: `partition-${testId}`,
        timestamp: baseTimestamp,
      }

      // Submit event
      const response = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })
      expect(response.status).toBe(200)

      // Wait for persistence and get the entity
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const entities = (await tableHelper.getAllEntities()).filter(
        (e) => e.rowKey === event.eventId
      )
      expect(entities.length).toBe(1)

      const entity = entities[0]!

      // Verify partition key structure
      expect(entity.partitionKey).toBeTruthy()

      // Partition key should include tenant hash and timestamp bucket
      const partitionParts = entity.partitionKey!.split('-')
      expect(partitionParts.length).toBe(2)

      // Verify time bucket (first part - should be timestamp-based)
      expect(/^\d{12}$/.test(partitionParts[0]!)).toBe(true)

      // Verify shard identifier (second part - single hex digit)
      expect(/^[0-9a-f]$/.test(partitionParts[1]!)).toBe(true)
    })

    it('should distribute events across different partitions based on time', async () => {
      const testId = Date.now()
      const baseTimestamp = Date.now()

      // Create events with timestamps 5 minutes apart to ensure different partitions
      const events = Array.from({ length: 3 }, (_, i) => ({
        subject: `user:time${i}`,
        action: 'test.time-partition',
        eventId: `time-partition-${testId}-${i}`,
        timestamp: baseTimestamp + i * 300000, // 5 minutes apart
      }))

      // Submit all events
      for (const event of events) {
        const response = await makeAuthenticatedRequest('/audit', {
          method: 'POST',
          body: JSON.stringify(event),
        })
        expect(response.status).toBe(200)
      }

      // Wait for persistence
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Get all entities and check partition distribution
      const entities = (await tableHelper.getAllEntities()).filter((e) =>
        events.some((event) => event.eventId === e.rowKey)
      )
      expect(entities.length).toBe(events.length)

      const partitionKeys = new Set(entities.map((e) => e.partitionKey))

      // Should have unique partitions due to different timestamps (minute buckets)
      expect(partitionKeys.size).toBe(events.length)
    })

    it('should handle events with same tenant but different sharding', async () => {
      const testId = Date.now()
      const sameTimestamp = Date.now()

      // Create multiple events with same timestamp but different eventIds for sharding
      const events = Array.from({ length: 5 }, (_, i) => ({
        subject: `user:shard${i}`,
        action: 'test.shard',
        eventId: `${i.toString(16)}-shard-${testId}-${i.toString().padStart(4, '0')}`,
        timestamp: sameTimestamp,
      }))

      // Submit all events
      for (const event of events) {
        const response = await makeAuthenticatedRequest('/audit', {
          method: 'POST',
          body: JSON.stringify(event),
        })
        expect(response.status).toBe(200)
      }

      // Wait for persistence
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const entities = (await tableHelper.getAllEntities()).filter((e) =>
        events.some((event) => event.eventId === e.rowKey)
      )
      expect(entities.length).toBe(events.length)

      const partitionKeys = new Set(entities.map((e) => e.partitionKey))
      expect(partitionKeys.size).toBeGreaterThan(1)
    })
  })

  describe('Row Key Uniqueness and Structure', () => {
    it('should use eventId as row key and maintain uniqueness', async () => {
      const testId = Date.now()
      const events = [
        {
          subject: 'user:row1',
          action: 'test.rowkey',
          eventId: `rowkey-${testId}-1`,
        },
        {
          subject: 'user:row2',
          action: 'test.rowkey',
          eventId: `rowkey-${testId}-2`,
        },
      ]

      // Submit events
      for (const event of events) {
        const response = await makeAuthenticatedRequest('/audit', {
          method: 'POST',
          body: JSON.stringify(event),
        })
        expect(response.status).toBe(200)
      }

      // Verify row keys
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const entities = await tableHelper.getAllEntities()

      // Check that row keys match eventIds
      for (const entity of entities) {
        const originalEvent = events.find((e) => e.eventId === entity.rowKey)
        expect(originalEvent).toBeTruthy()
      }

      // Check uniqueness
      const rowKeys = entities.map((e) => e.rowKey)
      const uniqueRowKeys = new Set(rowKeys)
      expect(rowKeys.length).toBe(uniqueRowKeys.size)
    })

    it('should handle auto-generated eventIds correctly', async () => {
      const event = {
        subject: 'user:auto',
        action: 'test.auto-eventid',
        // No eventId provided - should be auto-generated
      }

      const response = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })
      expect(response.status).toBe(200)

      const responseData = (await response.json()) as any
      expect(responseData.eventId).toBeTruthy()

      // Verify in database
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const entities = await tableHelper.getAllEntities()
      expect(entities.length).toBe(1)
      expect(entities[0]!.rowKey).toBe(responseData.eventId)
    })
  })

  describe('Data Serialization and Integrity', () => {
    it('should properly serialize and deserialize complex attributes', async () => {
      const testId = Date.now()
      const complexEvent = {
        subject: 'user:complex',
        action: 'test.complex-data',
        eventId: `complex-${testId}`,
        attributes: {
          string: 'test string',
          number: 12345,
          boolean: true,
          null_value: null,
          array: [1, 'two', { three: 3 }],
          nested_object: {
            level1: {
              level2: {
                level3: 'deep value',
                unicode: '🎉 Unicode test 测试',
              },
            },
          },
          special_chars: 'Special chars: !@#$%^&*()[]{}|;:,.<>?',
        },
      }

      // Submit event
      const response = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(complexEvent),
      })
      expect(response.status).toBe(200)

      // Verify serialization integrity
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const entities = await tableHelper.getAllEntities()
      expect(entities.length).toBe(1)

      const entity = entities[0]!
      const deserializedAttributes = JSON.parse(entity.attributes!)

      // Deep equality check
      expect(deserializedAttributes).toEqual(complexEvent.attributes)

      // Specific checks for edge cases
      expect(deserializedAttributes.nested_object.level1.level2.unicode).toBe(
        '🎉 Unicode test 测试'
      )
      expect(deserializedAttributes.special_chars).toBe(
        'Special chars: !@#$%^&*()[]{}|;:,.<>?'
      )
      expect(deserializedAttributes.null_value).toBe(null)
      expect(deserializedAttributes.array).toEqual([1, 'two', { three: 3 }])
    })

    it('should handle events with no attributes', async () => {
      const testId = Date.now()
      const event = {
        subject: 'user:simple',
        action: 'test.no-attributes',
        eventId: `no-attrs-${testId}`,
        // No attributes field
      }

      const response = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })
      expect(response.status).toBe(200)

      // Verify in database
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const entities = await tableHelper.getAllEntities()
      expect(entities.length).toBe(1)

      const entity = entities[0]!

      // Attributes field should either be empty, null, or not present
      if (entity.attributes) {
        const attributes = JSON.parse(entity.attributes)
        expect(
          Object.keys(attributes).length === 0 || attributes === null
        ).toBe(true)
      }
    })
  })

  describe('Timestamp Handling and Indexing', () => {
    it('should store timestamps as numeric values for proper sorting', async () => {
      const testId = Date.now()
      const baseTimestamp = Date.now()

      const events = [
        {
          subject: 'user:time1',
          action: 'test.timestamp',
          eventId: `timestamp-${testId}-1`,
          timestamp: baseTimestamp,
        },
        {
          subject: 'user:time2',
          action: 'test.timestamp',
          eventId: `timestamp-${testId}-2`,
          timestamp: baseTimestamp + 1000, // 1 second later
        },
      ]

      // Submit events
      for (const event of events) {
        const response = await makeAuthenticatedRequest('/audit', {
          method: 'POST',
          body: JSON.stringify(event),
        })
        expect(response.status).toBe(200)
      }

      // Verify timestamp storage
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const entities = (await tableHelper.getAllEntities()).filter((e) =>
        events.some((event) => event.eventId === e.rowKey)
      )
      expect(entities.length).toBe(events.length)

      for (const entity of entities) {
        // Timestamp should be stored as number
        const numericTimestamp = extractEntityTimestamp(entity)
        expect(Number.isFinite(numericTimestamp)).toBe(true)
        expect(numericTimestamp).toBeGreaterThan(0)

        // Should match original timestamp
        const originalEvent = events.find((e) => e.eventId === entity.rowKey)
        expect(numericTimestamp).toBe(originalEvent!.timestamp)
      }
    })

    it('should handle server-generated timestamps consistently', async () => {
      const testId = Date.now()
      const event = {
        subject: 'user:server-time',
        action: 'test.server-timestamp',
        eventId: `server-time-${testId}`,
        // No timestamp - should be server-generated
      }

      const beforeRequest = Date.now()
      const response = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })
      const afterRequest = Date.now()

      expect(response.status).toBe(200)

      // Verify server-generated timestamp
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const entities = (await tableHelper.getAllEntities()).filter(
        (e) => e.rowKey === event.eventId
      )
      expect(entities.length).toBe(1)

      const entity = entities[0]!
      const numericTimestamp = extractEntityTimestamp(entity)
      expect(numericTimestamp).toBeGreaterThanOrEqual(beforeRequest)
      expect(numericTimestamp).toBeLessThanOrEqual(afterRequest)
    })
  })

  describe('Query Performance and Indexing', () => {
    it('should efficiently query entities by tenant', async () => {
      const testId = Date.now()
      // Create multiple events for the same tenant
      const events = Array.from({ length: 10 }, (_, i) => ({
        subject: `user:perf${i}`,
        action: 'test.performance',
        eventId: `perf-${testId}-${i}`,
      }))

      // Submit all events
      for (const event of events) {
        const response = await makeAuthenticatedRequest('/audit', {
          method: 'POST',
          body: JSON.stringify(event),
        })
        expect(response.status).toBe(200)
      }

      // Wait for persistence
      await tableHelper.waitForEntityCount(10, 15000)

      // Measure query performance
      const startTime = Date.now()
      const allEntities = await tableHelper.getAllEntities()
      const queryTime = Date.now() - startTime

      // Verify results
      expect(allEntities.length).toBe(10)

      // Query should be reasonably fast (under 1 second for 10 entities)
      expect(queryTime).toBeLessThan(1000)

      // All entities should have valid structure
      allEntities.forEach((entity) => {
        expect(entity.subject).toBeDefined()
        expect(entity.action).toBeDefined()
      })
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connectivity issues gracefully', async () => {
      // This test assumes the service handles Azure Table Storage errors appropriately
      // In a real scenario, we might temporarily stop Azurite to test connectivity issues

      const event = {
        subject: 'user:connectivity',
        action: 'test.connectivity',
        eventId: `connectivity-${Date.now()}`,
      }

      // For now, just verify the event is accepted normally
      const response = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })

      // Event should be accepted even if there are transient connectivity issues
      expect([200, 503].includes(response.status)).toBe(true)
    })
  })
})
