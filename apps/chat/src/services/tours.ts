import { prisma } from '@klicker-uzh/prisma'

// The canonical twin of the write below is
// `packages/graphql/src/services/tours.ts`, which serves both actor kinds.
// Chat reaches Prisma directly instead of going through the GraphQL API, like
// every other data path in this app, so the participant half is restated here.
// Keep the two in step: the concurrency behaviour, not just the field list, is
// the contract.

export interface ChatTourState {
  tourId: string
  completedAt: string | null
}

/**
 * What the participant has recorded for one tour. A tour that never ended has
 * no row, which the caller reads as "not completed yet".
 */
export async function getTourState(
  participantId: string,
  tourId: string
): Promise<ChatTourState> {
  const state = await prisma.participantTourState.findUnique({
    where: { participantId_tourId: { participantId, tourId } },
  })

  return {
    tourId,
    completedAt: state?.completedAt?.toISOString() ?? null,
  }
}

/**
 * Records that the participant is done with the tour — finished, skipped or
 * closed, all of which end it for good.
 *
 * `completedAt` records the first ending and never moves, so a replay reports
 * completion again without rewriting it. The `update` branch therefore touches
 * only the housekeeping timestamp — but it must not be empty, because Prisma
 * turns an empty update into a read-then-insert that two concurrent calls can
 * race into a unique-constraint error. Both writers of this table always set
 * `completedAt` on insert, so every row this can meet already carries a
 * completion.
 */
export async function markTourCompleted(
  participantId: string,
  tourId: string
): Promise<ChatTourState> {
  const now = new Date()

  const state = await prisma.participantTourState.upsert({
    where: { participantId_tourId: { participantId, tourId } },
    create: { tourId, participantId, completedAt: now },
    update: { updatedAt: now },
  })

  return {
    tourId,
    completedAt: state.completedAt?.toISOString() ?? null,
  }
}
