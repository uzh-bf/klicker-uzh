const BASE_URL = 'http://localhost:7080'
const AUTH_TOKEN = process.env.INTERNAL_TOKEN || 'test-secret-token-123'

// Helper function to make HTTP requests
async function makeRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${BASE_URL}${path}`
  const response = await fetch(url, options)
  return response
}

// Helper function to make authenticated requests
async function makeAuthenticatedRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return makeRequest(path, {
    ...options,
    headers: {
      'X-Internal-Token': AUTH_TOKEN,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
}

describe('Audit Service API Tests', () => {
  describe('Health Endpoints', () => {
    it('GET /ready should return 200 with readiness status', async () => {
      const res = await makeAuthenticatedRequest('/ready')
      expect(res.status).toBe(200)

      const data = (await res.json()) as any
      expect(data.status).toBe('ready')
      expect(data.timestamp).toBeTruthy()
      expect(data.storage).toBe('connected')
    })

    it('GET /metrics should return Prometheus metrics', async () => {
      const res = await makeRequest('/metrics')
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe(
        'text/plain; version=0.0.4; charset=utf-8'
      )

      const text = await res.text()
      expect(text).toContain('audit_requests_total')
      expect(text).toContain('audit_writes_total')
      expect(text).toContain('audit_write_errors_total')
      expect(text).toContain('audit_write_latency_seconds')
    })
  })

  describe('Authentication', () => {
    it('POST /audit without auth header should return 401', async () => {
      const res = await makeRequest('/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'test-tenant',
          subject: 'test-subject',
          action: 'test-action',
        }),
      })

      expect(res.status).toBe(401)
      const data = (await res.json()) as any
      expect(data.error).toContain('Authentication required')
    })

    it('POST /audit with wrong token should return 401', async () => {
      const res = await makeRequest('/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': 'wrong-token-123',
        },
        body: JSON.stringify({
          tenantId: 'test-tenant',
          subject: 'test-subject',
          action: 'test-action',
        }),
      })

      expect(res.status).toBe(401)
      const data = (await res.json()) as any
      expect(data.error).toContain('Authentication failed')
    })

    it('GET /ready without auth should return 401', async () => {
      const res = await makeRequest('/ready')
      expect(res.status).toBe(401)
    })
  })

  describe('Valid Audit Events', () => {
    it('POST /audit with minimal valid event should return 200', async () => {
      const event = {
        tenantId: 'tenant-123',
        subject: 'user:john@example.com',
        action: 'login.success',
      }

      const res = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })

      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.status).toBe('stored')
      expect(data.stored).toBe(true)
      expect(data.eventId).toBeTruthy()
    })

    it('POST /audit with full event should return 200', async () => {
      const event = {
        tenantId: 'tenant-456',
        subject: 'user:alice@example.com',
        action: 'document.created',
        resourceId: 'doc-789',
        sessionId: 'session-abc',
        userId: 'user-xyz',
        attributes: {
          documentType: 'pdf',
          size: 1024,
          tags: ['important', 'confidential'],
          metadata: {
            author: 'alice',
            department: 'engineering',
          },
        },
      }

      const res = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })

      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.status).toBe('stored')
      expect(data.stored).toBe(true)
      expect(data.eventId).toBeTruthy()
    })

    it('POST /audit with custom timestamp should return 200', async () => {
      const customTimestamp = Date.now() - 60000 // 1 minute ago
      const event = {
        tenantId: 'tenant-789',
        subject: 'system:backup',
        action: 'backup.completed',
        timestamp: customTimestamp,
      }

      const res = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })

      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.status).toBe('stored')
      expect(data.stored).toBe(true)
    })
  })

  describe('Idempotency', () => {
    it('POST /audit with same eventId should be idempotent', async () => {
      const event = {
        tenantId: 'tenant-idempotent',
        subject: 'user:test',
        action: 'test.idempotency',
        eventId: `test-event-${Date.now()}`,
      }

      // First request
      const res1 = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })
      expect(res1.status).toBe(200)
      const data1 = (await res1.json()) as any
      expect(data1.eventId).toBe(event.eventId)

      // Second request with same eventId (should be idempotent)
      const res2 = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })
      expect(res2.status).toBe(200)
      const data2 = (await res2.json()) as any
      expect(data2.eventId).toBe(event.eventId)
    })
  })

  describe('Request Validation', () => {
    it('POST /audit with missing tenantId should return 400', async () => {
      const event = {
        subject: 'user:test',
        action: 'test.action',
      }

      const res = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })

      expect(res.status).toBe(400)
    })

    it('POST /audit with missing subject should return 400', async () => {
      const event = {
        tenantId: 'tenant-123',
        action: 'test.action',
      }

      const res = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })

      expect(res.status).toBe(400)
    })

    it('POST /audit with missing action should return 400', async () => {
      const event = {
        tenantId: 'tenant-123',
        subject: 'user:test',
      }

      const res = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })

      expect(res.status).toBe(400)
    })

    it('POST /audit with invalid JSON should return 400', async () => {
      const res = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: 'invalid-json',
      })

      expect(res.status).toBe(400)
    })

    it('POST /audit with empty body should return 400', async () => {
      const res = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: '',
      })

      expect(res.status).toBe(400)
    })

    it('POST /audit with string fields too long should return 400', async () => {
      const event = {
        tenantId: 'x'.repeat(101), // Exceeds max length of 100
        subject: 'user:test',
        action: 'test.action',
      }

      const res = await makeAuthenticatedRequest('/audit', {
        method: 'POST',
        body: JSON.stringify(event),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('Error Handling', () => {
    it('should handle non-existent endpoints with 404', async () => {
      const res = await makeRequest('/non-existent-endpoint')
      expect(res.status).toBe(404)
    })

    it('should handle unsupported methods', async () => {
      const res = await makeRequest('/audit', { method: 'DELETE' })
      expect(res.status).toBe(405)
    })
  })
})

// Note: To run these tests, ensure:
// 1. The audit service is running on localhost:7080
// 2. Azurite is running (docker-compose up -d)
// 3. Environment variables are set (or using defaults)
//
// Run with: pnpm test:api or vitest test/api.test.ts
