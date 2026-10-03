import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  findUnique: vi.fn(),
}))

vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    participantTourState: {
      upsert: mocks.upsert,
      findUnique: mocks.findUnique,
    },
  },
}))

import { getTourState, markTourCompleted } from '../src/services/tours'

const PARTICIPANT_ID = '3f2b1a09-8c7d-4e6f-9a5b-2c1d0e9f8a7b'
const TOUR_ID = 'chat-onboarding-v1'
const FIRST_ENDING = new Date('2026-02-01T10:00:00.000Z')

// The GraphQL tour service holds the canonical version of this write but
// carries no test of its own, so this suite is the only proof of the upsert's
// shape for either writer: it is what keeps a replay from rewriting a
// completion, and what keeps two tabs from racing the first write into a
// unique-constraint error.
describe('chat tour state writes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('sets completedAt on insert and leaves it alone on update', async () => {
    mocks.upsert.mockResolvedValue({
      participantId: PARTICIPANT_ID,
      tourId: TOUR_ID,
      completedAt: FIRST_ENDING,
    })

    const result = await markTourCompleted(PARTICIPANT_ID, TOUR_ID)

    const args = mocks.upsert.mock.calls[0]![0]
    expect(args.create).toEqual({
      tourId: TOUR_ID,
      participantId: PARTICIPANT_ID,
      completedAt: expect.any(Date),
    })
    // Only the housekeeping timestamp, so replaying an already completed tour
    // reports it again without moving the first ending — and never an empty
    // update, which Prisma would run as a read-then-insert.
    expect(Object.keys(args.update)).toEqual(['updatedAt'])
    expect(result).toEqual({
      tourId: TOUR_ID,
      completedAt: FIRST_ENDING.toISOString(),
    })
  })

  test('reports a tour without a row as not completed', async () => {
    mocks.findUnique.mockResolvedValue(null)

    await expect(getTourState(PARTICIPANT_ID, TOUR_ID)).resolves.toEqual({
      tourId: TOUR_ID,
      completedAt: null,
    })
  })
})
