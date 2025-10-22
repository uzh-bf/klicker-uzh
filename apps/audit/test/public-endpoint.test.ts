import { AuditAction } from '@klicker-uzh/types'
import * as jose from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'

const BASE_URL = 'http://localhost:7080'
const APP_SECRET = 'abcd' // Test secret matching .env.cypress

// Helper function to create a valid participant JWT token
async function createParticipantToken(
  participantId = 'test-participant-123',
  role = 'PARTICIPANT'
): Promise<string> {
  const secret = new TextEncoder().encode(APP_SECRET)

  return await new jose.SignJWT({
    sub: participantId,
    role: role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(process.env.APP_ORIGIN_AUTH || 'https://auth.klicker.com')
    .setExpirationTime('1h')
    .sign(secret)
}

// Helper function to create an invalid JWT token
async function createInvalidToken(): Promise<string> {
  const secret = new TextEncoder().encode('wrong-secret')

  return await new jose.SignJWT({
    sub: 'test-participant',
    role: 'PARTICIPANT',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(process.env.APP_ORIGIN_AUTH || 'https://auth.klicker.com')
    .setExpirationTime('1h')
    .sign(secret)
}

describe('Public Endpoint Authentication', () => {
  it('should accept valid next-auth.participant-session-token cookie', async () => {
    const validToken = await createParticipantToken()
    const eventData = {
      action: AuditAction.PARTICIPANT_SUBMIT_RESPONSE,
      timestamp: Date.now(),
      attributes: {
        questionId: 'q123',
        response: 'A',
      },
    }

    const response = await fetch(`${BASE_URL}/audit/public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `next-auth.participant-session-token=${validToken}`,
      },
      body: JSON.stringify(eventData),
    })

    expect(response.status).toBe(200)
    const result = (await response.json()) as any
    expect(result.status).toBe('stored')
    expect(result.eventId).toBeTruthy()
  })

  it('should reject requests without cookies', async () => {
    const eventData = {
      action: AuditAction.PARTICIPANT_SUBMIT_RESPONSE,
    }

    const response = await fetch(`${BASE_URL}/audit/public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    })

    expect(response.status).toBe(401)
    const result = (await response.json()) as any
    expect(result.error).toBe('No cookies provided')
  })

  it('should reject requests without next-auth.participant-session-token cookie', async () => {
    const eventData = {
      action: AuditAction.PARTICIPANT_SUBMIT_RESPONSE,
    }

    const response = await fetch(`${BASE_URL}/audit/public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'some_other_cookie=value',
      },
      body: JSON.stringify(eventData),
    })

    expect(response.status).toBe(401)
    const result = (await response.json()) as any
    expect(result.error).toBe(
      'next-auth.participant-session-token cookie required'
    )
  })

  it('should reject invalid/expired tokens', async () => {
    const invalidToken = await createInvalidToken()
    const eventData = {
      action: AuditAction.PARTICIPANT_SUBMIT_RESPONSE,
    }

    const response = await fetch(`${BASE_URL}/audit/public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `next-auth.participant-session-token=${invalidToken}`,
      },
      body: JSON.stringify(eventData),
    })

    expect(response.status).toBe(401)
    const result = (await response.json()) as any
    expect(result.error).toBe('Invalid or expired participant token')
  })

  it('should reject malformed JWT tokens', async () => {
    const eventData = {
      action: AuditAction.PARTICIPANT_SUBMIT_RESPONSE,
    }

    const response = await fetch(`${BASE_URL}/audit/public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'next-auth.participant-session-token=invalid-jwt-token',
      },
      body: JSON.stringify(eventData),
    })

    expect(response.status).toBe(401)
    const result = (await response.json()) as any
    expect(result.error).toBe('Invalid or expired participant token')
  })
})

describe('Public Event Filtering', () => {
  let validToken: string

  beforeAll(async () => {
    validToken = await createParticipantToken()
  })

  it('should accept whitelisted event types', async () => {
    const allowedEvents = [
      AuditAction.PARTICIPANT_VIEW_INSTANCE,
      AuditAction.PARTICIPANT_SUBMIT_RESPONSE,
      AuditAction.PARTICIPANT_UPDATE_ANSWER,
      AuditAction.PARTICIPANT_JOIN_QUIZ,
      AuditAction.PARTICIPANT_QUIZ_PIN_SUCCESS,
      AuditAction.PARTICIPANT_QUIZ_PIN_FAILED,
      AuditAction.CLIENT_ERROR,
    ]

    for (const eventType of allowedEvents) {
      const eventData = {
        action: eventType,
        timestamp: Date.now(),
      }

      const response = await fetch(`${BASE_URL}/audit/public`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `next-auth.participant-session-token=${validToken}`,
        },
        body: JSON.stringify(eventData),
      })

      expect(response.status).toBe(200)
      const result = (await response.json()) as any
      expect(result.status).toBe('stored')
    }
  })

  it('should reject non-whitelisted event types', async () => {
    const forbiddenEvents = [
      AuditAction.USER_START_QUIZ,
      AuditAction.USER_END_QUIZ,
      AuditAction.SYSTEM_RESPONSE_RECEIVED,
      AuditAction.API_ERROR,
      'custom.event.sneaky',
    ]

    for (const eventType of forbiddenEvents) {
      const eventData = {
        action: eventType,
        timestamp: Date.now(),
      }

      const response = await fetch(`${BASE_URL}/audit/public`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `next-auth.participant-session-token=${validToken}`,
        },
        body: JSON.stringify(eventData),
      })

      expect(response.status).toBe(400)
      const result = (await response.json()) as any
      expect(result.error).toBe('Invalid event payload')
    }
  })
})

describe('Public Event Context Injection', () => {
  let validToken: string
  const participantId = 'test-participant-456'

  beforeAll(async () => {
    validToken = await createParticipantToken(participantId, 'PARTICIPANT')
  })

  it('should inject verified participant context', async () => {
    // Note: This test verifies the endpoint accepts the request
    // The actual context injection is tested in integration tests
    // that can verify the stored data in Azure Table Storage
    const eventData = {
      action: AuditAction.PARTICIPANT_SUBMIT_RESPONSE,
      timestamp: Date.now(),
      attributes: {
        questionId: 'q123',
        response: 'B',
        attemptedSpoof: 'malicious-data',
      },
    }

    const response = await fetch(`${BASE_URL}/audit/public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `next-auth.participant-session-token=${validToken}`,
      },
      body: JSON.stringify(eventData),
    })

    expect(response.status).toBe(200)
    const result = (await response.json()) as any
    expect(result.status).toBe('stored')
    expect(result.eventId).toBeTruthy()

    // The actual verification that context was injected correctly
    // would require checking the stored data in Azure Table Storage
    // This is covered in the integration tests
  })
})

describe('Public Event Data Validation', () => {
  let validToken: string

  beforeAll(async () => {
    validToken = await createParticipantToken()
  })

  it('should validate required fields', async () => {
    // Missing action
    let response = await fetch(`${BASE_URL}/audit/public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `next-auth.participant-session-token=${validToken}`,
      },
      body: JSON.stringify({
        // Missing action field
      }),
    })

    expect(response.status).toBe(400)

    // Missing action
    response = await fetch(`${BASE_URL}/audit/public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `next-auth.participant-session-token=${validToken}`,
      },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(400)
  })

  it('should handle optional fields correctly', async () => {
    const eventData = {
      action: AuditAction.PARTICIPANT_VIEW_INSTANCE,
      eventId: 'custom-event-id-123',
      resource: 'live-quiz:quiz-456',
      attributes: {
        quizType: 'assessment',
        difficulty: 'medium',
      },
    }

    const response = await fetch(`${BASE_URL}/audit/public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `next-auth.participant-session-token=${validToken}`,
      },
      body: JSON.stringify(eventData),
    })

    expect(response.status).toBe(200)
    const result = (await response.json()) as any
    expect(result.status).toBe('stored')
    // Should use the provided eventId
    expect(result.eventId).toBe('custom-event-id-123')
  })

  it('should default timestamp if not provided', async () => {
    const eventData = {
      action: AuditAction.CLIENT_ERROR,
      // No timestamp provided
    }

    const response = await fetch(`${BASE_URL}/audit/public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `next-auth.participant-session-token=${validToken}`,
      },
      body: JSON.stringify(eventData),
    })

    expect(response.status).toBe(200)
    const result = (await response.json()) as any
    expect(result.status).toBe('stored')
  })
})
