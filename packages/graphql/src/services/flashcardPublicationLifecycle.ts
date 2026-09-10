import { randomUUID } from 'node:crypto'
import * as DB from '@klicker-uzh/prisma/client'
import type { ContextWithUser } from '../lib/context.js'
import { questionGenerationServiceError } from './questionGenerationErrors.js'

export async function claimIncompleteFlashcardPublication(
  buildId: string,
  ctx: ContextWithUser
) {
  const claimed = await ctx.prisma.elementGenerationBuild.updateMany({
    where: {
      id: buildId,
      ownerId: ctx.user.sub,
      status: DB.ElementGenerationBuildStatus.AWAITING_INCOMPLETE_PUBLICATION,
    },
    data: {
      status: DB.ElementGenerationBuildStatus.PUBLISHING_INCOMPLETE,
      stage: 'publishing_incomplete',
      incompletePublishedById: ctx.user.sub,
      incompletePublishedAt: new Date(),
      providerPublicationDispatchAttemptId: randomUUID(),
      providerPublicationEventId: null,
      providerPublicationWorkflowRunId: null,
    },
  })
  if (claimed.count !== 1) {
    throw questionGenerationServiceError(
      'CONCURRENT_MODIFICATION',
      'Flashcard build was changed by another request'
    )
  }
}

export async function recoverUndispatchedFlashcardPublication(
  buildId: string,
  leaseOwner: string,
  dispatchAttemptId: string,
  ctx: ContextWithUser
) {
  await ctx.prisma.elementGenerationBuild.updateMany({
    where: {
      id: buildId,
      ownerId: ctx.user.sub,
      status: DB.ElementGenerationBuildStatus.PUBLISHING_INCOMPLETE,
      syncLeaseOwner: leaseOwner,
      providerPublicationDispatchAttemptId: dispatchAttemptId,
      providerPublicationEventId: null,
      providerPublicationWorkflowRunId: null,
    },
    data: {
      status: DB.ElementGenerationBuildStatus.AWAITING_INCOMPLETE_PUBLICATION,
      stage: 'awaiting_incomplete_publication',
      incompletePublishedById: null,
      incompletePublishedAt: null,
      providerPublicationDispatchAttemptId: null,
    },
  })
}

export async function correlateFlashcardPublication(
  buildId: string,
  leaseOwner: string,
  dispatchAttemptId: string,
  eventId: string | null,
  recoveredRunId: string | null,
  ctx: ContextWithUser
) {
  const updated = await ctx.prisma.elementGenerationBuild.updateMany({
    where: {
      id: buildId,
      ownerId: ctx.user.sub,
      status: DB.ElementGenerationBuildStatus.PUBLISHING_INCOMPLETE,
      syncLeaseOwner: leaseOwner,
      providerPublicationDispatchAttemptId: dispatchAttemptId,
    },
    data: {
      providerPublicationEventId: eventId,
      providerPublicationWorkflowRunId: recoveredRunId,
      lastSynchronizedAt: new Date(),
    },
  })
  if (updated.count !== 1) {
    throw questionGenerationServiceError(
      'CONCURRENT_MODIFICATION',
      'Incomplete flashcard publication was changed by another request'
    )
  }
}
