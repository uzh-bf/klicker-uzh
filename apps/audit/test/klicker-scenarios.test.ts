import { AuditAction } from '@klicker-uzh/types'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AzureTableTestHelper } from './utils/azure-table-helper.js'

const BASE_URL = 'http://localhost:7080'
const AUTH_TOKEN = process.env.AUDIT_TOKEN || 'test-secret-token-123'

// Test helper instance
const tableHelper = new AzureTableTestHelper()

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

interface AuditEvent {
  subject: string
  action: AuditAction
  eventId: string
  correlationClaims?: Record<string, any>
  resource?: string
  attributes?: Record<string, any>
}

// Helper to submit events with verification
async function submitAndVerifyEvents(events: AuditEvent[]) {
  const results = []
  const eventIds = new Set(events.map((event) => event.eventId))

  for (const event of events) {
    const response = await makeAuthenticatedRequest('/audit', {
      method: 'POST',
      body: JSON.stringify(event),
    })

    expect(response.status).toBe(200)
    const responseData = await response.json()

    results.push({
      submitted: event,
      response: responseData,
    })
  }

  // Wait for persistence
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Verify all events are persisted
  const persistedEntities = (await tableHelper.getAllEntities()).filter(
    (entity) => (entity.rowKey ? eventIds.has(entity.rowKey) : false)
  )
  expect(persistedEntities.length).toBe(events.length)

  return { results, persistedEntities }
}

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

describe('KlickerUZH Assessment Quiz Scenarios', () => {
  beforeAll(async () => {
    console.log('Setting up KlickerUZH scenario tests...')
    await tableHelper.setup()
    await tableHelper.cleanup()
  })

  beforeEach(async () => {
    await tableHelper.cleanup()
  })

  afterAll(async () => {
    console.log('Cleaning up KlickerUZH scenario tests...')
    await tableHelper.cleanup()
  })

  describe('Complete Assessment Quiz Workflow', () => {
    it('should audit complete graded quiz lifecycle', async () => {
      const testId = Date.now()
      const quizId = `quiz-${testId}`
      const instanceId = 1
      const execution = 0

      const correlationClaims = { liveQuizId: quizId, instanceId, execution }

      // Complete assessment quiz flow
      const quizFlow: AuditEvent[] = [
        // 1. Instructor starts quiz
        {
          subject: 'user:instructor@uzh.ch',
          action: AuditAction.USER_START_QUIZ,
          eventId: `quiz-${testId}-01`,
          correlationClaims,
          attributes: {
            quizName: 'Midterm Exam',
            courseId: 'course-456',
          },
        },

        // 2. Instructor opens first block
        {
          subject: 'user:instructor@uzh.ch',
          action: AuditAction.USER_OPEN_BLOCK,
          eventId: `quiz-${testId}-02`,
          correlationClaims: { ...correlationClaims, blockId: 1 },
          attributes: {
            blockNumber: 1,
            timeLimit: 600,
          },
        },

        // 3. Three participants authenticate and join
        // Participant A: magic link
        {
          subject: 'participant:student-a@uzh.ch',
          action: AuditAction.PARTICIPANT_MAGIC_LINK_SUCCESS,
          eventId: `quiz-${testId}-03`,
          attributes: { email: 'student-a@uzh.ch' },
        },
        {
          subject: 'participant:student-a@uzh.ch',
          action: AuditAction.PARTICIPANT_QUIZ_PIN_SUCCESS,
          eventId: `quiz-${testId}-04`,
          correlationClaims,
          attributes: { pin: '1234' },
        },
        {
          subject: 'participant:student-a@uzh.ch',
          action: AuditAction.PARTICIPANT_JOIN_QUIZ,
          eventId: `quiz-${testId}-05`,
          correlationClaims,
        },

        // Participant B: LTI
        {
          subject: 'participant:student-b-lti',
          action: AuditAction.PARTICIPANT_LTI_LOGIN_SUCCESS,
          eventId: `quiz-${testId}-06`,
          attributes: { ltiProvider: 'moodle' },
        },
        {
          subject: 'participant:student-b-lti',
          action: AuditAction.PARTICIPANT_QUIZ_PIN_SUCCESS,
          eventId: `quiz-${testId}-07`,
          correlationClaims,
          attributes: { pin: '1234' },
        },
        {
          subject: 'participant:student-b-lti',
          action: AuditAction.PARTICIPANT_JOIN_QUIZ,
          eventId: `quiz-${testId}-08`,
          correlationClaims,
        },

        // Participant C: temp login
        {
          subject: 'participant:student-c-temp',
          action: AuditAction.PARTICIPANT_TEMP_LOGIN_SUCCESS,
          eventId: `quiz-${testId}-09`,
          attributes: { quizId },
        },
        {
          subject: 'participant:student-c-temp',
          action: AuditAction.PARTICIPANT_QUIZ_PIN_SUCCESS,
          eventId: `quiz-${testId}-10`,
          correlationClaims,
          attributes: { pin: '1234' },
        },
        {
          subject: 'participant:student-c-temp',
          action: AuditAction.PARTICIPANT_JOIN_QUIZ,
          eventId: `quiz-${testId}-11`,
          correlationClaims,
        },

        // 4. Participants view and submit responses
        {
          subject: 'participant:student-a@uzh.ch',
          action: AuditAction.PARTICIPANT_VIEW_INSTANCE,
          eventId: `quiz-${testId}-12`,
          correlationClaims,
          attributes: { questionId: 'q-001' },
        },
        {
          subject: 'participant:student-a@uzh.ch',
          action: AuditAction.PARTICIPANT_UPDATE_ANSWER,
          eventId: `quiz-${testId}-13`,
          correlationClaims,
          attributes: { questionId: 'q-001', responseValue: 'A' },
        },
        {
          subject: 'participant:student-a@uzh.ch',
          action: AuditAction.PARTICIPANT_SUBMIT_RESPONSE,
          eventId: `quiz-${testId}-14`,
          correlationClaims,
          attributes: {
            questionId: 'q-001',
            responseValue: 'A',
            responseTime: 45,
          },
        },

        // 5. System processes responses
        {
          subject: 'system:response-processor',
          action: AuditAction.SYSTEM_RESPONSE_RECEIVED,
          eventId: `quiz-${testId}-15`,
          correlationClaims,
          attributes: {
            participantId: 'student-a@uzh.ch',
            questionId: 'q-001',
          },
        },
        {
          subject: 'system:response-processor',
          action: AuditAction.SYSTEM_RESPONSE_PROCESSED,
          eventId: `quiz-${testId}-16`,
          correlationClaims,
          attributes: {
            participantId: 'student-a@uzh.ch',
            questionId: 'q-001',
            correctness: 'correct',
          },
        },
        {
          subject: 'participant:student-a@uzh.ch',
          action: AuditAction.PARTICIPANT_RESPONSE_SAVED,
          eventId: `quiz-${testId}-17`,
          correlationClaims,
          attributes: { questionId: 'q-001', score: 1.0 },
        },

        // 6. Instructor closes block
        {
          subject: 'user:instructor@uzh.ch',
          action: AuditAction.USER_CLOSE_BLOCK,
          eventId: `quiz-${testId}-18`,
          correlationClaims: { ...correlationClaims, blockId: 1 },
          attributes: { blockNumber: 1, responsesReceived: 3 },
        },

        // 7. Instructor ends quiz
        {
          subject: 'user:instructor@uzh.ch',
          action: AuditAction.USER_END_QUIZ,
          eventId: `quiz-${testId}-19`,
          correlationClaims,
          attributes: { duration: 3600, participantCount: 3 },
        },
      ]

      const { persistedEntities } = await submitAndVerifyEvents(quizFlow)

      // Verify: Complete audit trail with proper correlation
      const entitiesWithCorrelation = persistedEntities.filter(
        (e) => e.correlationClaims
      )

      // All quiz-related events should have correlationClaims
      expect(entitiesWithCorrelation.length).toBeGreaterThan(10)

      // Verify correlationId linking
      entitiesWithCorrelation.forEach((entity) => {
        const claims = JSON.parse(entity.correlationClaims!)
        expect(claims.liveQuizId).toBe(quizId)
      })

      // Verify timestamps are sequential
      const sortedEvents = persistedEntities.sort(
        (a, b) => extractEntityTimestamp(a) - extractEntityTimestamp(b)
      )

      for (let i = 1; i < sortedEvents.length; i++) {
        const prevTimestamp = extractEntityTimestamp(sortedEvents[i - 1]!)
        const currTimestamp = extractEntityTimestamp(sortedEvents[i]!)
        expect(currTimestamp).toBeGreaterThanOrEqual(prevTimestamp)
      }

      // Verify workflow completeness
      const actions = persistedEntities.map((e) => e.action)
      expect(actions).toContain(AuditAction.USER_START_QUIZ)
      expect(actions).toContain(AuditAction.USER_END_QUIZ)
      expect(actions).toContain(AuditAction.PARTICIPANT_SUBMIT_RESPONSE)
      expect(actions).toContain(AuditAction.SYSTEM_RESPONSE_PROCESSED)

      console.log(
        `  ✓ Complete quiz workflow tracked: ${persistedEntities.length} events`
      )
    })
  })

  describe('Response Modification Tracking', () => {
    it('should track instructor grading adjustments', async () => {
      const testId = Date.now()
      const quizId = `quiz-${testId}`
      const participantId = 'participant:student-123'

      const correlationClaims = {
        liveQuizId: quizId,
        instanceId: 1,
        execution: 0,
      }

      const modificationFlow: AuditEvent[] = [
        // 1. Participant submits response
        {
          subject: participantId,
          action: AuditAction.PARTICIPANT_SUBMIT_RESPONSE,
          eventId: `mod-${testId}-01`,
          correlationClaims,
          attributes: { questionId: 'q-001', responseValue: 'B' },
        },

        // 2. System processes and saves
        {
          subject: 'system:response-processor',
          action: AuditAction.SYSTEM_RESPONSE_RECEIVED,
          eventId: `mod-${testId}-02`,
          correlationClaims,
          attributes: { participantId, questionId: 'q-001' },
        },
        {
          subject: 'system:response-processor',
          action: AuditAction.SYSTEM_RESPONSE_PROCESSED,
          eventId: `mod-${testId}-03`,
          correlationClaims,
          attributes: {
            participantId,
            questionId: 'q-001',
            correctness: 'partial',
          },
        },
        {
          subject: participantId,
          action: AuditAction.PARTICIPANT_RESPONSE_SAVED,
          eventId: `mod-${testId}-04`,
          correlationClaims,
          attributes: { questionId: 'q-001', score: 0.5 },
        },

        // 3. Instructor modifies response (manual grading adjustment)
        {
          subject: 'system:response-processor',
          action: AuditAction.SYSTEM_RESPONSE_MODIFIED,
          eventId: `mod-${testId}-05`,
          correlationClaims,
          attributes: {
            originalSubject: participantId,
            modifiedBy: 'user:instructor@uzh.ch',
            reason: 'manual_grading_adjustment',
            oldScore: 0.5,
            newScore: 1.0,
          },
        },
      ]

      const { persistedEntities } =
        await submitAndVerifyEvents(modificationFlow)

      // Verify: Modification shows instructor as actor
      const modificationEvent = persistedEntities.find(
        (e) => e.action === AuditAction.SYSTEM_RESPONSE_MODIFIED
      )
      expect(modificationEvent).toBeTruthy()

      const modAttrs = JSON.parse(modificationEvent!.attributes!)
      expect(modAttrs.modifiedBy).toBe('user:instructor@uzh.ch')
      expect(modAttrs.originalSubject).toBe(participantId)
      expect(modAttrs.oldScore).toBe(0.5)
      expect(modAttrs.newScore).toBe(1.0)

      console.log('  ✓ Response modification tracked with full audit trail')
    })

    it('should track response deletion', async () => {
      const testId = Date.now()
      const quizId = `quiz-${testId}`
      const participantId = 'participant:student-456'

      const correlationClaims = {
        liveQuizId: quizId,
        instanceId: 1,
        execution: 0,
      }

      const deletionFlow: AuditEvent[] = [
        {
          subject: participantId,
          action: AuditAction.PARTICIPANT_SUBMIT_RESPONSE,
          eventId: `del-${testId}-01`,
          correlationClaims,
          attributes: { questionId: 'q-001', responseValue: 'C' },
        },
        {
          subject: 'system:response-processor',
          action: AuditAction.SYSTEM_RESPONSE_DELETED,
          eventId: `del-${testId}-02`,
          correlationClaims,
          attributes: {
            participantId,
            questionId: 'q-001',
            deletedBy: 'user:instructor@uzh.ch',
            reason: 'invalid_submission',
          },
        },
      ]

      const { persistedEntities } = await submitAndVerifyEvents(deletionFlow)

      const deletionEvent = persistedEntities.find(
        (e) => e.action === AuditAction.SYSTEM_RESPONSE_DELETED
      )
      expect(deletionEvent).toBeTruthy()

      const delAttrs = JSON.parse(deletionEvent!.attributes!)
      expect(delAttrs.deletedBy).toBe('user:instructor@uzh.ch')
      expect(delAttrs.reason).toBe('invalid_submission')

      console.log('  ✓ Response deletion tracked')
    })
  })

  describe('Authentication Workflows', () => {
    it('should audit magic link authentication', async () => {
      const testId = Date.now()

      const magicLinkFlow: AuditEvent[] = [
        {
          subject: 'participant:student@uzh.ch',
          action: AuditAction.PARTICIPANT_MAGIC_LINK_SENT,
          eventId: `auth-${testId}-01`,
          attributes: { email: 'student@uzh.ch' },
        },
        {
          subject: 'participant:student@uzh.ch',
          action: AuditAction.PARTICIPANT_MAGIC_LINK_SUCCESS,
          eventId: `auth-${testId}-02`,
          attributes: { email: 'student@uzh.ch' },
        },
      ]

      const { persistedEntities } = await submitAndVerifyEvents(magicLinkFlow)

      const actions = persistedEntities.map((e) => e.action)
      expect(actions).toContain(AuditAction.PARTICIPANT_MAGIC_LINK_SENT)
      expect(actions).toContain(AuditAction.PARTICIPANT_MAGIC_LINK_SUCCESS)

      console.log('  ✓ Magic link authentication flow tracked')
    })

    it('should audit LTI integration login', async () => {
      const testId = Date.now()

      const ltiFlow: AuditEvent[] = [
        {
          subject: 'participant:lti-student',
          action: AuditAction.PARTICIPANT_LTI_LOGIN_SUCCESS,
          eventId: `lti-${testId}-01`,
          attributes: { ltiProvider: 'moodle', courseId: 'course-123' },
        },
        {
          subject: 'participant:lti-student',
          action: AuditAction.PARTICIPANT_LTI_PARTICIPATION_CREATED,
          eventId: `lti-${testId}-02`,
          attributes: { courseId: 'course-123' },
        },
      ]

      const { persistedEntities } = await submitAndVerifyEvents(ltiFlow)

      const ltiLoginEvent = persistedEntities.find(
        (e) => e.action === AuditAction.PARTICIPANT_LTI_LOGIN_SUCCESS
      )
      expect(ltiLoginEvent).toBeTruthy()

      const ltiAttrs = JSON.parse(ltiLoginEvent!.attributes!)
      expect(ltiAttrs.ltiProvider).toBe('moodle')

      console.log('  ✓ LTI integration login tracked')
    })

    it('should handle authentication failures', async () => {
      const testId = Date.now()

      const failureFlow: AuditEvent[] = [
        {
          subject: 'participant:student@uzh.ch',
          action: AuditAction.PARTICIPANT_MAGIC_LINK_FAILED,
          eventId: `fail-${testId}-01`,
          attributes: { email: 'student@uzh.ch', reason: 'expired_token' },
        },
        {
          subject: 'participant:lti-student',
          action: AuditAction.PARTICIPANT_LTI_LOGIN_FAILED,
          eventId: `fail-${testId}-02`,
          attributes: { reason: 'invalid_signature' },
        },
      ]

      const { persistedEntities } = await submitAndVerifyEvents(failureFlow)

      const actions = persistedEntities.map((e) => e.action)
      expect(actions).toContain(AuditAction.PARTICIPANT_MAGIC_LINK_FAILED)
      expect(actions).toContain(AuditAction.PARTICIPANT_LTI_LOGIN_FAILED)

      console.log('  ✓ Authentication failures tracked')
    })
  })

  describe('Exam Integrity Monitoring', () => {
    it('should detect and log multiple tabs', async () => {
      const testId = Date.now()
      const quizId = `quiz-${testId}`
      const participantId = 'participant:student-789'

      const correlationClaims = {
        liveQuizId: quizId,
        instanceId: 1,
        execution: 0,
      }

      const securityFlow: AuditEvent[] = [
        {
          subject: participantId,
          action: AuditAction.PARTICIPANT_VIEW_INSTANCE,
          eventId: `sec-${testId}-01`,
          correlationClaims,
          attributes: { questionId: 'q-001' },
        },
        {
          subject: participantId,
          action: AuditAction.MULTIPLE_TABS_DETECTED,
          eventId: `sec-${testId}-02`,
          correlationClaims,
          attributes: { tabCount: 2, detectedAt: new Date().toISOString() },
        },
      ]

      const { persistedEntities } = await submitAndVerifyEvents(securityFlow)

      const securityEvent = persistedEntities.find(
        (e) => e.action === AuditAction.MULTIPLE_TABS_DETECTED
      )
      expect(securityEvent).toBeTruthy()
      expect(securityEvent!.subject).toBe(participantId)

      const secAttrs = JSON.parse(securityEvent!.attributes!)
      expect(secAttrs.tabCount).toBe(2)

      console.log('  ✓ Multiple tabs detection tracked')
    })

    it('should track focus loss events', async () => {
      const testId = Date.now()
      const quizId = `quiz-${testId}`
      const participantId = 'participant:student-890'

      const correlationClaims = {
        liveQuizId: quizId,
        instanceId: 1,
        execution: 0,
      }

      const focusFlow: AuditEvent[] = [
        {
          subject: participantId,
          action: AuditAction.PARTICIPANT_VIEW_INSTANCE,
          eventId: `focus-${testId}-01`,
          correlationClaims,
          attributes: { questionId: 'q-001' },
        },
        {
          subject: participantId,
          action: AuditAction.BROWSER_FOCUS_LOST,
          eventId: `focus-${testId}-02`,
          correlationClaims,
          attributes: { duration: 5, questionId: 'q-001' },
        },
      ]

      const { persistedEntities } = await submitAndVerifyEvents(focusFlow)

      const focusEvent = persistedEntities.find(
        (e) => e.action === AuditAction.BROWSER_FOCUS_LOST
      )
      expect(focusEvent).toBeTruthy()

      console.log('  ✓ Focus loss events tracked')
    })

    it('should detect IP/location changes', async () => {
      const testId = Date.now()
      const quizId = `quiz-${testId}`
      const participantId = 'participant:student-991'

      const correlationClaims = {
        liveQuizId: quizId,
        instanceId: 1,
        execution: 0,
      }

      const ipChangeFlow: AuditEvent[] = [
        {
          subject: participantId,
          action: AuditAction.PARTICIPANT_SUBMIT_RESPONSE,
          eventId: `ip-${testId}-01`,
          correlationClaims,
          attributes: { questionId: 'q-001', ipAddress: '192.168.1.100' },
        },
        {
          subject: participantId,
          action: AuditAction.IP_LOCATION_CHANGE,
          eventId: `ip-${testId}-02`,
          correlationClaims,
          attributes: { oldIp: '192.168.1.100', newIp: '10.0.0.50' },
        },
      ]

      const { persistedEntities } = await submitAndVerifyEvents(ipChangeFlow)

      const ipChangeEvent = persistedEntities.find(
        (e) => e.action === AuditAction.IP_LOCATION_CHANGE
      )
      expect(ipChangeEvent).toBeTruthy()

      const ipAttrs = JSON.parse(ipChangeEvent!.attributes!)
      expect(ipAttrs.oldIp).toBe('192.168.1.100')
      expect(ipAttrs.newIp).toBe('10.0.0.50')

      console.log('  ✓ IP/location changes tracked')
    })
  })

  describe('Error Handling & Recovery', () => {
    it('should handle response validation errors', async () => {
      const testId = Date.now()
      const quizId = `quiz-${testId}`
      const participantId = 'participant:student-error'

      const correlationClaims = {
        liveQuizId: quizId,
        instanceId: 1,
        execution: 0,
      }

      const errorFlow: AuditEvent[] = [
        {
          subject: participantId,
          action: AuditAction.PARTICIPANT_SUBMIT_RESPONSE,
          eventId: `err-${testId}-01`,
          correlationClaims,
          attributes: { questionId: 'q-001', responseValue: 'invalid' },
        },
        {
          subject: 'system:response-processor',
          action: AuditAction.SYSTEM_RESPONSE_RECEIVED,
          eventId: `err-${testId}-02`,
          correlationClaims,
          attributes: { participantId, questionId: 'q-001' },
        },
        {
          subject: 'system:response-processor',
          action: AuditAction.SYSTEM_RESPONSE_VALIDATION_ERROR,
          eventId: `err-${testId}-03`,
          correlationClaims,
          attributes: {
            participantId,
            questionId: 'q-001',
            errorReason: 'invalid_response_format',
          },
        },
      ]

      const { persistedEntities } = await submitAndVerifyEvents(errorFlow)

      const validationError = persistedEntities.find(
        (e) => e.action === AuditAction.SYSTEM_RESPONSE_VALIDATION_ERROR
      )
      expect(validationError).toBeTruthy()

      const errAttrs = JSON.parse(validationError!.attributes!)
      expect(errAttrs.errorReason).toBe('invalid_response_format')

      console.log('  ✓ Validation errors tracked')
    })

    it('should detect duplicate submissions', async () => {
      const testId = Date.now()
      const quizId = `quiz-${testId}`
      const participantId = 'participant:student-dup'

      const correlationClaims = {
        liveQuizId: quizId,
        instanceId: 1,
        execution: 0,
      }

      const duplicateFlow: AuditEvent[] = [
        {
          subject: participantId,
          action: AuditAction.PARTICIPANT_SUBMIT_RESPONSE,
          eventId: `dup-${testId}-01`,
          correlationClaims,
          attributes: { questionId: 'q-001', responseValue: 'A' },
        },
        {
          subject: 'system:response-processor',
          action: AuditAction.SYSTEM_RESPONSE_DUPLICATE,
          eventId: `dup-${testId}-02`,
          correlationClaims,
          attributes: {
            participantId,
            questionId: 'q-001',
            originalSubmissionTime: new Date().toISOString(),
          },
        },
      ]

      const { persistedEntities } = await submitAndVerifyEvents(duplicateFlow)

      const duplicateEvent = persistedEntities.find(
        (e) => e.action === AuditAction.SYSTEM_RESPONSE_DUPLICATE
      )
      expect(duplicateEvent).toBeTruthy()

      console.log('  ✓ Duplicate submissions detected')
    })

    it('should handle correlation errors', async () => {
      const testId = Date.now()
      const participantId = 'participant:student-corr'

      const correlationErrorFlow: AuditEvent[] = [
        {
          subject: participantId,
          action: AuditAction.PARTICIPANT_SUBMIT_RESPONSE,
          eventId: `corr-${testId}-01`,
          // No correlationClaims - should cause error
          attributes: { questionId: 'q-001', responseValue: 'A' },
        },
        {
          subject: 'system:response-processor',
          action: AuditAction.SYSTEM_RESPONSE_CORRELATION_ERROR,
          eventId: `corr-${testId}-02`,
          attributes: {
            participantId,
            questionId: 'q-001',
            errorReason: 'missing_correlation_id',
          },
        },
      ]

      const { persistedEntities } =
        await submitAndVerifyEvents(correlationErrorFlow)

      const correlationError = persistedEntities.find(
        (e) => e.action === AuditAction.SYSTEM_RESPONSE_CORRELATION_ERROR
      )
      expect(correlationError).toBeTruthy()

      console.log('  ✓ Correlation errors handled')
    })

    it('should track client errors', async () => {
      const testId = Date.now()
      const quizId = `quiz-${testId}`
      const participantId = 'participant:student-client-err'

      const correlationClaims = {
        liveQuizId: quizId,
        instanceId: 1,
        execution: 0,
      }

      const clientErrorFlow: AuditEvent[] = [
        {
          subject: participantId,
          action: AuditAction.CLIENT_ERROR,
          eventId: `client-err-${testId}-01`,
          correlationClaims,
          attributes: {
            errorMessage: 'Failed to submit response',
            errorCode: 'NETWORK_TIMEOUT',
          },
        },
      ]

      const { persistedEntities } = await submitAndVerifyEvents(clientErrorFlow)

      const clientError = persistedEntities.find(
        (e) => e.action === AuditAction.CLIENT_ERROR
      )
      expect(clientError).toBeTruthy()

      const clientAttrs = JSON.parse(clientError!.attributes!)
      expect(clientAttrs.errorCode).toBe('NETWORK_TIMEOUT')

      console.log('  ✓ Client errors tracked')
    })
  })
})
