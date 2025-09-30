import { AuditAction } from '@klicker-uzh/types'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import events from './fixtures/klicker-events.json'
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

async function waitForEntityByRowKey(
  rowKey: string,
  timeoutMs = 5000,
  pollIntervalMs = 100
) {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const entities = await tableHelper.getAllEntities()
    const match = entities.find((entity) => entity.rowKey === rowKey)
    if (match) {
      return match
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }

  throw new Error(`Entity with rowKey ${rowKey} not found after ${timeoutMs}ms`)
}

describe('Audit Service Integration Tests', () => {
  beforeAll(async () => {
    console.log('Setting up test environment...')
    await tableHelper.setup()
    await tableHelper.cleanup()
  })

  beforeEach(async () => {
    await tableHelper.cleanup()
  })

  afterAll(async () => {
    console.log('Cleaning up test environment...')
    await tableHelper.cleanup()
  })

  describe('Basic Event Persistence', () => {
    it('should persist minimal participant event to Azure Table Storage', async () => {
      const event = {
        ...events.participantViewInstance,
        eventId: `test-minimal-${Date.now()}`,
      }

      // Submit event
      const response = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })

      expect(response.status).toBe(200)
      const responseData = (await response.json()) as any
      expect(responseData.eventId).toBe(event.eventId)
      expect(responseData.status).toBe('stored')
      expect(responseData.stored).toBe(true)

      // Wait for persistence and verify in database
      const persistedEntity = await waitForEntityByRowKey(event.eventId)

      // Verify entity fields
      expect(persistedEntity.subject).toBe(event.subject)
      expect(persistedEntity.action).toBe(AuditAction.PARTICIPANT_VIEW_INSTANCE)
      expect(persistedEntity.rowKey).toBe(event.eventId)
    })

    it('should persist complete event with complex attributes and correlationClaims', async () => {
      const event = {
        ...events.participantSubmitResponse,
        eventId: `test-complete-${Date.now()}`,
      }

      // Submit event
      const response = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })

      expect(response.status).toBe(200)

      // Verify in database
      const persistedEntity = await waitForEntityByRowKey(event.eventId)

      // Verify all fields including complex attributes
      expect(persistedEntity.action).toBe(
        AuditAction.PARTICIPANT_SUBMIT_RESPONSE
      )

      // Verify attributes were serialized and can be parsed
      const attributes = JSON.parse(persistedEntity.attributes!)
      expect(attributes).toEqual(event.attributes)

      // Verify correlationClaims
      const correlationClaims = JSON.parse(persistedEntity.correlationClaims!)
      expect(correlationClaims).toEqual(event.correlationClaims)
    })

    it('should handle event without explicit eventId (auto-generated)', async () => {
      const event = { ...events.participantViewInstance }
      delete (event as any).eventId // No explicit eventId

      // Submit event
      const response = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })

      expect(response.status).toBe(200)
      const responseData = (await response.json()) as any
      expect(responseData.eventId).toBeTruthy() // Should have auto-generated eventId

      // Verify in database using the returned eventId
      await waitForEntityByRowKey(responseData.eventId)
    })

    it('should handle custom timestamp correctly', async () => {
      const customTimestamp = Date.now() - 300000 // 5 minutes ago
      const event = {
        ...events.participantViewInstance,
        eventId: `test-timestamp-${Date.now()}`,
        timestamp: customTimestamp,
      }

      // Submit event
      const response = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })

      expect(response.status).toBe(200)

      // Verify timestamp was used for partition key
      const persistedEntity = await waitForEntityByRowKey(event.eventId)

      expect(extractEntityTimestamp(persistedEntity)).toBe(customTimestamp)
    })
  })

  describe('Idempotency Verification', () => {
    it('should maintain idempotency for duplicate eventIds', async () => {
      const event = {
        ...events.participantViewInstance,
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

      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)

      // Verify only one entity exists in database
      const persistedEntity = await waitForEntityByRowKey(event.eventId)

      // Should maintain original data due to idempotency
      expect(persistedEntity.subject).toBe(event.subject)

      // Count entities to ensure no duplicates
      const allEntities = await tableHelper.getAllEntities()
      const matchingEntities = allEntities.filter(
        (e) => e.rowKey === event.eventId
      )
      expect(matchingEntities.length).toBe(1)
    })
  })

  describe('Multi-Tenant Data Isolation', () => {
    it('should properly store and retrieve events', async () => {
      // Submit a few events
      const testId = Date.now()
      const testEvents = [
        {
          subject: `participant:isolation-test-${testId}-1`,
          action: AuditAction.PARTICIPANT_VIEW_INSTANCE,
          eventId: `isolation-${testId}-1`,
          correlationClaims: {
            liveQuizId: `quiz-${testId}`,
            instanceId: 1,
            execution: 0,
          },
        },
        {
          subject: `participant:isolation-test-${testId}-2`,
          action: AuditAction.PARTICIPANT_SUBMIT_RESPONSE,
          eventId: `isolation-${testId}-2`,
          correlationClaims: {
            liveQuizId: `quiz-${testId}`,
            instanceId: 1,
            execution: 0,
          },
        },
      ]

      for (const event of testEvents) {
        const response = await makeAuthenticatedRequest('/audit', {
          method: 'POST',
          body: JSON.stringify(event),
        })
        expect(response.status).toBe(200)
      }

      // Wait for persistence
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Verify all events are stored
      const allEntities = await tableHelper.getAllEntities()
      const testEntities = allEntities.filter((e) =>
        e.subject?.includes(`isolation-test-${testId}`)
      )
      expect(testEntities.length).toBe(2)

      // Verify event data integrity
      for (const entity of testEntities) {
        expect(entity.subject).toContain(`isolation-test-${testId}`)
      }
    })
  })

  describe('Different Event Types', () => {
    it('should handle participant authentication events', async () => {
      const testId = Date.now()

      // Submit authentication flow events
      const authEvents = [
        {
          ...events.participantMagicLinkAuth,
          eventId: `auth-${testId}-1`,
        },
        {
          ...events.participantQuizPinSuccess,
          eventId: `auth-${testId}-2`,
        },
        {
          ...events.participantJoinQuiz,
          eventId: `auth-${testId}-3`,
        },
      ]

      for (const event of authEvents) {
        const response = await makeAuthenticatedRequest('/audit', {
          method: 'POST',
          body: JSON.stringify(event),
        })
        expect(response.status).toBe(200)
      }

      // Wait for all events to be persisted
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Verify all auth events are stored
      const allEntities = await tableHelper.getAllEntities()
      const authEntities = allEntities.filter((e) =>
        e.rowKey?.startsWith(`auth-${testId}-`)
      )
      expect(authEntities.length).toBe(3)

      // Verify event sequence
      const actions = authEntities.map((e) => e.action).sort()
      expect(actions).toEqual([
        AuditAction.PARTICIPANT_MAGIC_LINK_SUCCESS,
        AuditAction.PARTICIPANT_JOIN_QUIZ,
        AuditAction.PARTICIPANT_QUIZ_PIN_SUCCESS,
      ])
    })

    it('should handle system response processing events', async () => {
      const testId = Date.now()

      // Submit system events
      const systemEvents = [
        {
          ...events.systemResponseReceived,
          eventId: `system-${testId}-1`,
        },
        {
          ...events.systemResponseProcessed,
          eventId: `system-${testId}-2`,
        },
      ]

      for (const event of systemEvents) {
        const response = await makeAuthenticatedRequest('/audit', {
          method: 'POST',
          body: JSON.stringify(event),
        })
        expect(response.status).toBe(200)
      }

      // Verify system events
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const allEntities = await tableHelper.getAllEntities()
      const systemEntities = allEntities.filter((e) =>
        e.rowKey?.startsWith(`system-${testId}-`)
      )
      expect(systemEntities.length).toBe(2)

      // Verify response processing flow
      const responseEvents = systemEntities.filter(
        (e) =>
          e.action === AuditAction.SYSTEM_RESPONSE_RECEIVED ||
          e.action === AuditAction.SYSTEM_RESPONSE_PROCESSED
      )
      expect(responseEvents.length).toBe(2)
    })

    it('should handle instructor quiz control events with complex correlationClaims', async () => {
      const testId = Date.now()

      // Submit instructor quiz control events
      const instructorEvents = [
        {
          ...events.instructorStartQuiz,
          eventId: `instructor-${testId}-1`,
        },
        {
          ...events.instructorOpenBlock,
          eventId: `instructor-${testId}-2`,
        },
      ]

      for (const event of instructorEvents) {
        const response = await makeAuthenticatedRequest('/audit', {
          method: 'POST',
          body: JSON.stringify(event),
        })
        expect(response.status).toBe(200)
      }

      // Verify instructor events with complex attributes
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const allEntities = await tableHelper.getAllEntities()
      const instructorEntities = allEntities.filter((e) =>
        e.rowKey?.startsWith(`instructor-${testId}-`)
      )
      expect(instructorEntities.length).toBe(2)

      // Verify quiz start event has attributes
      const startEvent = instructorEntities.find(
        (e) => e.action === AuditAction.USER_START_QUIZ
      )
      expect(startEvent).toBeTruthy()

      const startAttributes = JSON.parse(startEvent!.attributes!)
      expect(startAttributes.quizName).toBe('Midterm Exam')
      expect(startAttributes.courseId).toBe('course-456')

      // Verify correlationClaims
      const correlationClaims = JSON.parse(startEvent!.correlationClaims!)
      expect(correlationClaims.liveQuizId).toBe('quiz-123')
      expect(correlationClaims.instanceId).toBe(1)
    })
  })

  describe('Partition Key Distribution', () => {
    it('should distribute events across different partitions', async () => {
      const testId = Date.now()
      const baseTimestamp = Date.now()

      // Create events with different timestamps to ensure different partitions
      const testEvents = Array.from({ length: 5 }, (_, i) => ({
        subject: `participant:test${i}`,
        action: AuditAction.PARTICIPANT_VIEW_INSTANCE,
        eventId: `partition-test-${testId}-${i}`,
        timestamp: baseTimestamp + i * 120000, // 2 minutes apart to get different minute buckets
      }))

      // Submit all events
      for (const event of testEvents) {
        const response = await makeAuthenticatedRequest('/audit', {
          method: 'POST',
          body: JSON.stringify(event),
        })
        expect(response.status).toBe(200)
      }

      // Wait for persistence
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Verify events are in different partitions
      const partitionKeys = await tableHelper.getPartitionKeys()

      // Should have multiple partitions due to different timestamps
      expect(partitionKeys.length).toBeGreaterThan(1)
    })
  })

  describe('Large Payload Handling', () => {
    it('should handle events with large but acceptable attributes', async () => {
      // Create event with substantial but acceptable attributes
      const event = {
        subject: 'system:data-processor',
        action: AuditAction.SYSTEM_RESPONSE_PROCESSED,
        eventId: `large-${Date.now()}`,
        attributes: {
          records: Array.from({ length: 100 }, (_, i) => ({
            id: `record-${i}`,
            timestamp: new Date(Date.now() - i * 1000).toISOString(),
            value: Math.random() * 1000,
            metadata: {
              source: 'quiz',
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

      expect(response.status).toBe(200)

      // Verify persistence
      const persistedEntity = await waitForEntityByRowKey(event.eventId)

      // Verify attributes were properly serialized
      const attributes = JSON.parse(persistedEntity.attributes!)
      expect(attributes.records.length).toBe(100)
      expect(attributes.records[0].id.startsWith('record-')).toBe(true)
    })
  })

  describe('Timestamp Edge Cases', () => {
    it('should handle events submitted without timestamp (server-generated)', async () => {
      const event = {
        subject: 'participant:timestamp-test',
        action: AuditAction.PARTICIPANT_VIEW_INSTANCE,
        eventId: `timestamp-${Date.now()}`,
      }
      // Explicitly not setting timestamp

      const beforeSubmission = Date.now()

      const response = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })

      const afterSubmission = Date.now()
      expect(response.status).toBe(200)

      // Verify entity has server-generated timestamp
      const persistedEntity = await waitForEntityByRowKey(event.eventId)

      // Timestamp should be within the submission window
      const numericTimestamp = extractEntityTimestamp(persistedEntity)
      expect(numericTimestamp).toBeGreaterThanOrEqual(beforeSubmission)
      expect(numericTimestamp).toBeLessThanOrEqual(afterSubmission + 1000) // Add small buffer
    })
  })
})
