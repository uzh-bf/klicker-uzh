import { randomUUID } from 'node:crypto'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  ElementManipulationInput,
  GeneratedFlashcardEditable,
} from '@klicker-uzh/types'
import type { ContextWithUser } from '../lib/context.js'
import {
  generatedFlashcardElementInput,
  manipulateElement,
} from './elements.js'
import { questionGenerationServiceError } from './questionGenerationErrors.js'
import { assertQuestionGenerationPreviewAccess } from './questionGenerationGraph.js'

const REVIEWABLE_STATUSES = [
  DB.ElementGenerationBuildStatus.COMPLETED,
  DB.ElementGenerationBuildStatus.INCOMPLETE,
]

function serviceError(
  code: Parameters<typeof questionGenerationServiceError>[0],
  message: string
): never {
  throw questionGenerationServiceError(code, message)
}

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
    return serviceError(
      'CONCURRENT_MODIFICATION',
      'Flashcard build was changed by another request'
    )
  }
}

export async function saveGeneratedFlashcards(
  buildId: string,
  ctx: ContextWithUser
): Promise<{
  createdElementIds: number[]
  alreadySavedElementIds: number[]
}> {
  await assertQuestionGenerationPreviewAccess(ctx)

  return ctx.prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT "id"
      FROM "ElementGenerationBuild"
      WHERE "id" = ${buildId}::uuid
      FOR UPDATE
    `
    const build = await transaction.elementGenerationBuild.findFirst({
      where: {
        id: buildId,
        ownerId: ctx.user.sub,
        elementType: DB.ElementType.FLASHCARD,
        status: { in: REVIEWABLE_STATUSES },
      },
      select: {
        drafts: {
          where: {
            decision: DB.GeneratedElementDecision.ACCEPTED,
            elementType: DB.ElementType.FLASHCARD,
          },
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        },
      },
    })
    if (!build) {
      return serviceError(
        'FLASHCARD_GENERATION_BUILD_NOT_FOUND',
        'Terminal flashcard-generation build not found'
      )
    }

    const alreadySavedElementIds = build.drafts.flatMap((draft) =>
      draft.savedElementId === null ? [] : [draft.savedElementId]
    )
    const createdElementIds: number[] = []
    for (const draft of build.drafts) {
      if (draft.savedElementId !== null) continue
      let elementInput: ElementManipulationInput
      try {
        elementInput = generatedFlashcardElementInput({
          sourceFlashcardId: draft.sourceElementId,
          ...(draft.current as GeneratedFlashcardEditable),
        })
      } catch {
        return serviceError(
          'SAVE_VALIDATION_FAILED',
          'A generated flashcard draft is not a valid Flashcard element'
        )
      }
      const element = await manipulateElement(elementInput, {
        ...ctx,
        prisma: transaction,
      })
      if (!element) {
        return serviceError(
          'SAVE_VALIDATION_FAILED',
          'A generated flashcard draft is not a valid Flashcard element'
        )
      }
      const linked = await transaction.generatedElementDraft.updateMany({
        where: {
          id: draft.id,
          elementType: DB.ElementType.FLASHCARD,
          decision: DB.GeneratedElementDecision.ACCEPTED,
          savedElementId: null,
        },
        data: { savedElementId: element.id, savedAt: new Date() },
      })
      if (linked.count !== 1) {
        return serviceError(
          'CONCURRENT_MODIFICATION',
          'Generated flashcard was saved by another request'
        )
      }
      createdElementIds.push(element.id)
    }
    return { createdElementIds, alreadySavedElementIds }
  })
}
