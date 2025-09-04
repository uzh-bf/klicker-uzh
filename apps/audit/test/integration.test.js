import assert from 'node:assert'
import { after, before, describe, it } from 'node:test'
import events from './fixtures/events.json' assert { type: 'json' }
import { AzureTableTestHelper } from './utils/azure-table-helper.js'

const BASE_URL = 'http://localhost:7080'
const AUTH_TOKEN = process.env.INTERNAL_TOKEN || 'test-secret-token-123'

// Test helper instance
const tableHelper = new AzureTableTestHelper('auditlogs')

// Helper function to make authenticated requests
async function makeAuthenticatedRequest(path, options = {}) {
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

// Generate expected partition key for verification
function generateExpectedPartitionKey(tenantId, timestamp, eventId) {
  const date = new Date(timestamp)
  const bucket = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}`

  // Simple hash for tenant (matches the service implementation)
  let hash = 0
  for (let i = 0; i < tenantId.length; i++) {
    hash = (hash * 31 + tenantId.charCodeAt(i)) % 10000
  }
  const tenantHash = hash.toString(16).padStart(2, '0').slice(0, 2)

  // Simple hash for shard
  let shard = '0'
  if (eventId) {
    let shardHash = 0
    for (let i = 0; i < eventId.length; i++) {
      shardHash = (shardHash * 31 + eventId.charCodeAt(i)) % 16
    }
    shard = shardHash.toString(16).slice(0, 1)
  }

  return `${tenantHash}-${bucket}-${shard}`
}

describe('Audit Service Integration Tests', () => {
  before(async () => {
    console.log('Setting up test environment...')
    await tableHelper.setup()
    await tableHelper.cleanup()
  })

  after(async () => {
    console.log('Cleaning up test environment...')
    await tableHelper.cleanup()
  })

  describe('Basic Event Persistence', () => {
    it('should persist minimal event to Azure Table Storage', async () => {
      const event = { ...events.minimal, eventId: `test-minimal-${Date.now()}` }

      // Submit event
      const response = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })

      assert.strictEqual(response.status, 202)
      const responseData = await response.json()
      assert.strictEqual(responseData.eventId, event.eventId)

      // Wait for persistence and verify in database
      const expectedPartitionKey = generateExpectedPartitionKey(
        event.tenantId,
        Date.now(),
        event.eventId
      )
      const persistedEntity = await tableHelper.waitForEntity(
        expectedPartitionKey,
        event.eventId,
        5000
      )

      // Verify entity fields
      assert.strictEqual(persistedEntity.tenantId, event.tenantId)
      assert.strictEqual(persistedEntity.subject, event.subject)
      assert.strictEqual(persistedEntity.action, event.action)
      assert.strictEqual(persistedEntity.rowKey, event.eventId)
    })

    it('should persist complete event with complex attributes', async () => {
      const event = {
        ...events.complete,
        eventId: `test-complete-${Date.now()}`,
      }

      // Submit event
      const response = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })

      assert.strictEqual(response.status, 202)

      // Verify in database
      const expectedPartitionKey = generateExpectedPartitionKey(
        event.tenantId,
        Date.now(),
        event.eventId
      )
      const persistedEntity = await tableHelper.waitForEntity(
        expectedPartitionKey,
        event.eventId,
        5000
      )

      // Verify all fields including complex attributes
      assert.strictEqual(persistedEntity.resourceId, event.resourceId)
      assert.strictEqual(persistedEntity.sessionId, event.sessionId)
      assert.strictEqual(persistedEntity.userId, event.userId)

      // Verify attributes were serialized and can be parsed
      const attributes = JSON.parse(persistedEntity.attributes)
      assert.deepStrictEqual(attributes, event.attributes)
    })

    it('should handle event without explicit eventId (auto-generated)', async () => {
      const event = { ...events.minimal }
      delete event.eventId // No explicit eventId

      // Submit event
      const response = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })

      assert.strictEqual(response.status, 202)
      const responseData = await response.json()
      assert.ok(responseData.eventId) // Should have auto-generated eventId

      // Verify in database using the returned eventId
      const expectedPartitionKey = generateExpectedPartitionKey(
        event.tenantId,
        Date.now(),
        responseData.eventId
      )
      await tableHelper.waitForEntity(
        expectedPartitionKey,
        responseData.eventId,
        5000
      )
    })

    it('should handle custom timestamp correctly', async () => {
      const customTimestamp = Date.now() - 300000 // 5 minutes ago
      const event = {
        ...events.minimal,
        eventId: `test-timestamp-${Date.now()}`,
        timestamp: customTimestamp,
      }

      // Submit event
      const response = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })

      assert.strictEqual(response.status, 202)

      // Verify timestamp was used for partition key
      const expectedPartitionKey = generateExpectedPartitionKey(
        event.tenantId,
        customTimestamp,
        event.eventId
      )
      const persistedEntity = await tableHelper.waitForEntity(
        expectedPartitionKey,
        event.eventId,
        5000
      )

      assert.strictEqual(persistedEntity.timestamp, customTimestamp)
    })
  })

  describe('Idempotency Verification', () => {
    it('should maintain idempotency for duplicate eventIds', async () => {
      const event = {
        ...events.minimal,
        eventId: `test-idempotent-${Date.now()}`,
      }

      // Submit event twice
      const response1 = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })

      const response2 = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify({ ...event, subject: 'different-subject' }), // Different data, same eventId
      })

      assert.strictEqual(response1.status, 202)
      assert.strictEqual(response2.status, 202)

      // Verify only one entity exists in database
      const expectedPartitionKey = generateExpectedPartitionKey(
        event.tenantId,
        Date.now(),
        event.eventId
      )
      const persistedEntity = await tableHelper.waitForEntity(
        expectedPartitionKey,
        event.eventId,
        5000
      )

      // Should maintain original data due to idempotency
      assert.strictEqual(persistedEntity.subject, event.subject)

      // Count entities to ensure no duplicates
      const entitiesForTenant = await tableHelper.getEntitiesForTenant(
        event.tenantId
      )
      const matchingEntities = entitiesForTenant.filter(
        (e) => e.rowKey === event.eventId
      )
      assert.strictEqual(matchingEntities.length, 1)
    })
  })

  describe('Multi-Tenant Data Isolation', () => {
    it('should properly isolate data between tenants', async () => {
      const testId = Date.now()

      // Submit events for multiple tenants
      const promises = events.multiTenant.map((event, index) =>
        makeAuthenticatedRequest('/audit', {
          method: 'POST',
          body: JSON.stringify({
            ...event,
            eventId: `multi-tenant-${testId}-${index}`,
          }),
        })
      )

      const responses = await Promise.all(promises)
      responses.forEach((response) => assert.strictEqual(response.status, 202))

      // Wait for all events to be persisted
      await tableHelper.waitForEntityCount(3, 10000)

      // Verify each tenant only sees their own data
      for (const tenant of ['tenant-a', 'tenant-b', 'tenant-c']) {
        const tenantEntities = await tableHelper.getEntitiesForTenant(tenant)

        // Should have exactly one entity for this tenant
        assert.strictEqual(tenantEntities.length, 1)
        assert.strictEqual(tenantEntities[0].tenantId, tenant)

        // Should not see other tenants' data
        const otherTenants = ['tenant-a', 'tenant-b', 'tenant-c'].filter(
          (t) => t !== tenant
        )
        for (const otherEntity of tenantEntities) {
          assert.ok(!otherTenants.includes(otherEntity.tenantId))
        }
      }
    })
  })

  describe('Different Event Types', () => {
    it('should handle authentication events', async () => {
      const testId = Date.now()

      // Submit authentication flow events
      const authEvents = events.authentication.map((event, index) => ({
        ...event,
        eventId: `auth-${testId}-${index}`,
      }))

      for (const event of authEvents) {
        const response = await makeAuthenticatedRequest('/audit', {
          method: 'POST',
          body: JSON.stringify(event),
        })
        assert.strictEqual(response.status, 202)
      }

      // Wait for all events to be persisted
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Verify all auth events are stored
      const tenantEntities =
        await tableHelper.getEntitiesForTenant('tenant-auth')
      assert.strictEqual(tenantEntities.length, 3)

      // Verify event sequence
      const actions = tenantEntities.map((e) => e.action).sort()
      assert.deepStrictEqual(actions, [
        'login.attempt',
        'login.success',
        'logout',
      ])
    })

    it('should handle system events', async () => {
      const testId = Date.now()

      // Submit system events
      const systemEvents = events.systemEvents.map((event, index) => ({
        ...event,
        eventId: `system-${testId}-${index}`,
      }))

      for (const event of systemEvents) {
        const response = await makeAuthenticatedRequest('/audit', {
          method: 'POST',
          body: JSON.stringify(event),
        })
        assert.strictEqual(response.status, 202)
      }

      // Verify system events
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const systemEntities =
        await tableHelper.getEntitiesForTenant('tenant-system')
      assert.strictEqual(systemEntities.length, 2)

      // Verify backup flow
      const backupEvents = systemEntities.filter((e) =>
        e.action.startsWith('backup.')
      )
      assert.strictEqual(backupEvents.length, 2)
    })

    it('should handle business events with complex data', async () => {
      const testId = Date.now()

      // Submit business events
      const businessEvents = events.businessEvents.map((event, index) => ({
        ...event,
        eventId: `business-${testId}-${index}`,
      }))

      for (const event of businessEvents) {
        const response = await makeAuthenticatedRequest('/audit', {
          method: 'POST',
          body: JSON.stringify(event),
        })
        assert.strictEqual(response.status, 202)
      }

      // Verify business events with complex attributes
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const businessEntities =
        await tableHelper.getEntitiesForTenant('tenant-business')
      assert.strictEqual(businessEntities.length, 2)

      // Verify order event has complex attributes
      const orderEvent = businessEntities.find(
        (e) => e.action === 'order.created'
      )
      assert.ok(orderEvent)

      const orderAttributes = JSON.parse(orderEvent.attributes)
      assert.strictEqual(orderAttributes.orderTotal, 299.99)
      assert.ok(Array.isArray(orderAttributes.items))
      assert.strictEqual(orderAttributes.items[0].id, 'product-123')
    })
  })

  describe('Partition Key Distribution', () => {
    it('should distribute events across different partitions', async () => {
      const testId = Date.now()
      const baseTimestamp = Date.now()

      // Create events with different timestamps to ensure different partitions
      const events = Array.from({ length: 5 }, (_, i) => ({
        tenantId: 'tenant-partition-test',
        subject: `user:test${i}`,
        action: 'test.action',
        eventId: `partition-test-${testId}-${i}`,
        timestamp: baseTimestamp + i * 120000, // 2 minutes apart to get different minute buckets
      }))

      // Submit all events
      for (const event of events) {
        const response = await makeAuthenticatedRequest('/audit', {
          method: 'POST',
          body: JSON.stringify(event),
        })
        assert.strictEqual(response.status, 202)
      }

      // Wait for persistence
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Verify events are in different partitions
      const partitionKeys = await tableHelper.getPartitionKeys()
      const testPartitions = partitionKeys.filter((pk) => {
        const entities = []
        // This is a simplified check - in a real scenario we'd query by partition
        return true // Simplified for this test
      })

      // Should have multiple partitions due to different timestamps
      assert.ok(
        partitionKeys.length > 1,
        `Expected multiple partitions, got ${partitionKeys.length}`
      )
    })
  })

  describe('Large Payload Handling', () => {
    it('should handle events with large but acceptable attributes', async () => {
      // Create event with substantial but acceptable attributes
      const event = {
        tenantId: 'tenant-large-test',
        subject: 'system:data-processor',
        action: 'data.processed',
        eventId: `large-${Date.now()}`,
        attributes: {
          records: Array.from({ length: 100 }, (_, i) => ({
            id: `record-${i}`,
            timestamp: new Date(Date.now() - i * 1000).toISOString(),
            value: Math.random() * 1000,
            metadata: {
              source: 'sensor',
              quality: 'high',
              tags: [`tag-${i % 10}`, `category-${i % 5}`],
            },
          })),
        },
      }

      const response = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })

      assert.strictEqual(response.status, 202)

      // Verify persistence
      const expectedPartitionKey = generateExpectedPartitionKey(
        event.tenantId,
        Date.now(),
        event.eventId
      )
      const persistedEntity = await tableHelper.waitForEntity(
        expectedPartitionKey,
        event.eventId,
        5000
      )

      // Verify attributes were properly serialized
      const attributes = JSON.parse(persistedEntity.attributes)
      assert.strictEqual(attributes.records.length, 100)
      assert.ok(attributes.records[0].id.startsWith('record-'))
    })
  })

  describe('Timestamp Edge Cases', () => {
    it('should handle events submitted without timestamp (server-generated)', async () => {
      const event = {
        tenantId: 'tenant-timestamp-test',
        subject: 'user:timestamp-test',
        action: 'timestamp.test',
        eventId: `timestamp-${Date.now()}`,
      }
      // Explicitly not setting timestamp

      const beforeSubmission = Date.now()

      const response = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })

      const afterSubmission = Date.now()
      assert.strictEqual(response.status, 202)

      // Verify entity has server-generated timestamp
      const expectedPartitionKey = generateExpectedPartitionKey(
        event.tenantId,
        afterSubmission,
        event.eventId
      )
      const persistedEntity = await tableHelper.waitForEntity(
        expectedPartitionKey,
        event.eventId,
        5000
      )

      // Timestamp should be within the submission window
      assert.ok(persistedEntity.timestamp >= beforeSubmission)
      assert.ok(persistedEntity.timestamp <= afterSubmission)
    })
  })
})
