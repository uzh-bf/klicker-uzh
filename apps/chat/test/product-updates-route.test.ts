import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getProductUpdateParticipantId: vi.fn(),
  isKnownUpdateId: vi.fn(),
  markProductUpdateRead: vi.fn(),
  dismissProductUpdate: vi.fn(),
  recordProductUpdatePresentation: vi.fn(),
  getChatProductUpdates: vi.fn(),
}))

vi.mock('@/src/lib/server/apiGuards', () => ({
  getProductUpdateParticipantId: mocks.getProductUpdateParticipantId,
}))

vi.mock('@/src/services/productUpdates', () => ({
  isKnownUpdateId: mocks.isKnownUpdateId,
  markProductUpdateRead: mocks.markProductUpdateRead,
  dismissProductUpdate: mocks.dismissProductUpdate,
  recordProductUpdatePresentation: mocks.recordProductUpdatePresentation,
  getChatProductUpdates: mocks.getChatProductUpdates,
}))

import { POST } from '../src/app/api/product-updates/route'

describe('POST /api/product-updates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getProductUpdateParticipantId.mockResolvedValue({
      participantId: '3f2b1a09-8c7d-4e6f-9a5b-2c1d0e9f8a7b',
    })
  })

  // A body that is not JSON at all makes `req.json()` throw. That is a client
  // mistake, so it must reach the same 400 as a well-formed body with the wrong
  // shape instead of being reported as a server failure.
  test('answers a malformed body with 400, not 500', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/product-updates', {
        method: 'POST',
        body: 'not json at all',
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid request body',
    })
    expect(mocks.isKnownUpdateId).not.toHaveBeenCalled()
  })
})
