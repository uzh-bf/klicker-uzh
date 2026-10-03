import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getTourParticipantId: vi.fn(),
  getTourState: vi.fn(),
  markTourCompleted: vi.fn(),
}))

vi.mock('@/src/lib/server/apiGuards', () => ({
  getTourParticipantId: mocks.getTourParticipantId,
}))

vi.mock('@/src/services/tours', () => ({
  getTourState: mocks.getTourState,
  markTourCompleted: mocks.markTourCompleted,
}))

import { GET, POST } from '../src/app/api/onboarding-tour/route'

const PARTICIPANT_ID = '3f2b1a09-8c7d-4e6f-9a5b-2c1d0e9f8a7b'
const TOUR_ID = 'chat-onboarding-v1'

describe('/api/onboarding-tour', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getTourParticipantId.mockResolvedValue({
      participantId: PARTICIPANT_ID,
    })
  })

  test('reads the state of a tour this build knows', async () => {
    mocks.getTourState.mockResolvedValue({ tourId: TOUR_ID, completedAt: null })

    const response = await GET(
      new NextRequest(`http://localhost/api/onboarding-tour?tourId=${TOUR_ID}`)
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      tourId: TOUR_ID,
      completedAt: null,
    })
    expect(mocks.getTourState).toHaveBeenCalledWith(PARTICIPANT_ID, TOUR_ID)
  })

  // An id no build defines must not read as "never completed", which is what an
  // empty state would look like to a client deciding whether to open an
  // overlay.
  test('refuses to read an unknown tour id', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/onboarding-tour?tourId=made-up-v1')
    )

    expect(response.status).toBe(400)
    expect(mocks.getTourState).not.toHaveBeenCalled()
  })

  // A body that is not JSON at all makes `req.json()` throw. That is a client
  // mistake, so it must reach the same 400 as a well-formed body with the wrong
  // shape instead of being reported as a server failure.
  test('answers a malformed body with 400, not 500', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/onboarding-tour', {
        method: 'POST',
        body: 'not json at all',
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid request body',
    })
    expect(mocks.markTourCompleted).not.toHaveBeenCalled()
  })

  // The stored `tourId` carries no foreign key, so an unknown id would create a
  // row that no surface can ever read or clean up.
  test('refuses to store an unknown tour id', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/onboarding-tour', {
        method: 'POST',
        body: JSON.stringify({ tourId: 'made-up-v1' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Unknown tour id: made-up-v1',
    })
    expect(mocks.markTourCompleted).not.toHaveBeenCalled()
  })

  test('records completion for a known tour id', async () => {
    mocks.markTourCompleted.mockResolvedValue({
      tourId: TOUR_ID,
      completedAt: '2026-02-01T10:00:00.000Z',
    })

    const response = await POST(
      new NextRequest('http://localhost/api/onboarding-tour', {
        method: 'POST',
        body: JSON.stringify({ tourId: TOUR_ID }),
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      tourId: TOUR_ID,
      completedAt: '2026-02-01T10:00:00.000Z',
    })
    expect(mocks.markTourCompleted).toHaveBeenCalledWith(
      PARTICIPANT_ID,
      TOUR_ID
    )
  })
})
