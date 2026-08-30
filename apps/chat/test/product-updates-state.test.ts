import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  update: vi.fn(),
  findUniqueOrThrow: vi.fn(),
}))

vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    participantProductUpdateState: {
      upsert: mocks.upsert,
      update: mocks.update,
      findUniqueOrThrow: mocks.findUniqueOrThrow,
    },
  },
}))

import {
  dismissProductUpdate,
  markProductUpdateRead,
  recordProductUpdatePresentation,
} from '../src/services/productUpdates'

const PARTICIPANT_ID = '3f2b1a09-8c7d-4e6f-9a5b-2c1d0e9f8a7b'
const UPDATE_ID = 'v3-3-release'

function state(overrides: Record<string, unknown> = {}) {
  return {
    participantId: PARTICIPANT_ID,
    updateId: UPDATE_ID,
    firstPresentedAt: new Date('2026-01-01T00:00:00.000Z'),
    lastPresentedAt: new Date('2026-01-01T00:00:00.000Z'),
    presentationCount: 0,
    readAt: null,
    dismissedAt: null,
    ...overrides,
  }
}

// The GraphQL product-update service holds the canonical version of this write
// logic and guards it with its own regression test. Chat restates the
// participant half against Prisma directly, so the concurrency behaviour needs
// proof here too — the collision path in particular reads like dead code until
// two writes race for the first row.
describe('chat product update state writes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('answers a concurrent first insert with the row that survived', async () => {
    const surviving = state({ readAt: new Date('2026-02-01T10:00:00.000Z') })
    mocks.upsert.mockRejectedValueOnce({ code: 'P2002' })
    mocks.findUniqueOrThrow.mockResolvedValueOnce(surviving)

    const result = await markProductUpdateRead(PARTICIPANT_ID, UPDATE_ID)

    // The collision proves the other write created the row, which is what
    // insert-if-absent asked for, so the surviving row is returned as is.
    expect(result).toBe(surviving)
    expect(mocks.findUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        participantId_updateId: {
          participantId: PARTICIPANT_ID,
          updateId: UPDATE_ID,
        },
      },
    })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  test('rethrows a failure that is not a unique collision', async () => {
    mocks.upsert.mockRejectedValueOnce(new Error('connection lost'))

    await expect(
      markProductUpdateRead(PARTICIPANT_ID, UPDATE_ID)
    ).rejects.toThrow('connection lost')
    expect(mocks.findUniqueOrThrow).not.toHaveBeenCalled()
  })

  test('keeps the first read timestamp when the row already carries one', async () => {
    const alreadyRead = state({ readAt: new Date('2026-02-01T10:00:00.000Z') })
    mocks.upsert.mockResolvedValueOnce(alreadyRead)

    const result = await markProductUpdateRead(PARTICIPANT_ID, UPDATE_ID)

    expect(result).toBe(alreadyRead)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  test('sets the dismissal on a row that a presentation created earlier', async () => {
    mocks.upsert.mockResolvedValueOnce(state())
    const dismissed = state({ dismissedAt: new Date() })
    mocks.update.mockResolvedValueOnce(dismissed)

    const result = await dismissProductUpdate(PARTICIPANT_ID, UPDATE_ID)

    expect(result).toBe(dismissed)
    expect(mocks.update).toHaveBeenCalledWith({
      where: {
        participantId_updateId: {
          participantId: PARTICIPANT_ID,
          updateId: UPDATE_ID,
        },
      },
      data: { dismissedAt: expect.any(Date) },
    })
  })

  test('counts a presentation with a single conflict-safe upsert', async () => {
    mocks.upsert.mockResolvedValueOnce(state({ presentationCount: 2 }))

    await recordProductUpdatePresentation(PARTICIPANT_ID, UPDATE_ID)

    // A non-empty `update` keeps this a native INSERT ... ON CONFLICT, so a
    // presentation recorded concurrently in a second tab cannot be lost.
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: {
        participantId_updateId: {
          participantId: PARTICIPANT_ID,
          updateId: UPDATE_ID,
        },
      },
      create: {
        participantId: PARTICIPANT_ID,
        updateId: UPDATE_ID,
        firstPresentedAt: expect.any(Date),
        lastPresentedAt: expect.any(Date),
        presentationCount: 1,
      },
      update: {
        lastPresentedAt: expect.any(Date),
        presentationCount: { increment: 1 },
      },
    })
  })
})
