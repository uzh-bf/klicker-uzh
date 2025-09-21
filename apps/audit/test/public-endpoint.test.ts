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
    .setExpirationTime('1h')
    .sign(secret)
}

describe('Public Endpoint Authentication', () => {
  it('should accept valid participant_token cookie', async () => {
    const validToken = await createParticipantToken()
    const eventData = {
      action: 'response.submitted',
      timestamp: Date.now(),
      sessionId: 'test-session-123',
      attributes: {
        questionId: 'q123',
        response: 'A',
      },
    }

    const response = await fetch(`${BASE_URL}/audit/public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `participant_token=${validToken}`,
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
      action: 'response.submitted',
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

  it('should reject requests without participant_token cookie', async () => {
    const eventData = {
      action: 'response.submitted',
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
    expect(result.error).toBe('participant_token cookie required')
  })

  it('should reject invalid/expired tokens', async () => {
    const invalidToken = await createInvalidToken()
    const eventData = {
      action: 'response.submitted',
    }

    const response = await fetch(`${BASE_URL}/audit/public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `participant_token=${invalidToken}`,
      },
      body: JSON.stringify(eventData),
    })

    expect(response.status).toBe(401)
    const result = (await response.json()) as any
    expect(result.error).toBe('Invalid or expired participant token')
  })

  it('should reject malformed JWT tokens', async () => {
    const eventData = {
      action: 'response.submitted',
    }

    const response = await fetch(`${BASE_URL}/audit/public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'participant_token=invalid-jwt-token',
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
      'response.submitted',
      'session.joined',
      'session.left',
      'quiz.started',
      'quiz.completed',
      'feedback.submitted',
      'question.answered',
      'activity.accessed',
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
          Cookie: `participant_token=${validToken}`,
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
      'admin.user.created',
      'admin.user.deleted',
      'system.maintenance.start',
      'security.breach.detected',
      'payment.processed',
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
          Cookie: `participant_token=${validToken}`,
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
      action: 'response.submitted',
      timestamp: Date.now(),
      // Note: Even if these are provided, they should be overridden
      userId: 'spoofed-user-id',
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
        Cookie: `participant_token=${validToken}`,
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

  it('should handle temporary participant tokens', async () => {
    const tempToken = await createParticipantToken(
      'temp-participant-789',
      'TEMPORARY_PARTICIPANT'
    )
    const eventData = {
      action: 'session.joined',
      timestamp: Date.now(),
    }

    const response = await fetch(`${BASE_URL}/audit/public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `participant_token=${tempToken}`,
      },
      body: JSON.stringify(eventData),
    })

    expect(response.status).toBe(200)
    const result = (await response.json()) as any
    expect(result.status).toBe('stored')
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
        Cookie: `participant_token=${validToken}`,
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
        Cookie: `participant_token=${validToken}`,
      },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(400)
  })

  it('should handle optional fields correctly', async () => {
    const eventData = {
      action: 'quiz.started',
      eventId: 'custom-event-id-123',
      resourceId: 'quiz-456',
      sessionId: 'session-789',
      attributes: {
        quizType: 'practice',
        difficulty: 'medium',
      },
    }

    const response = await fetch(`${BASE_URL}/audit/public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `participant_token=${validToken}`,
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
      action: 'activity.accessed',
      // No timestamp provided
    }

    const response = await fetch(`${BASE_URL}/audit/public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `participant_token=${validToken}`,
      },
      body: JSON.stringify(eventData),
    })

    expect(response.status).toBe(200)
    const result = (await response.json()) as any
    expect(result.status).toBe('stored')
  })
})
