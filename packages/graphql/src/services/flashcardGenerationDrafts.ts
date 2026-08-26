import * as DB from '@klicker-uzh/prisma/client'
import type {
  GeneratedFlashcard,
  GeneratedFlashcardEditable,
  QuestionGenerationArtifactRef,
} from '@klicker-uzh/types'
import type { ContextWithUser } from '../lib/context.js'
import { questionGenerationServiceError } from './questionGenerationErrors.js'
import { assertQuestionGenerationPreviewAccess } from './questionGenerationGraph.js'

const MAX_NAME_LENGTH = 500
const MAX_SIDE_LENGTH = 20_000
const MAX_TAG_LENGTH = 100
const MAX_TAGS = 20
const EDITABLE_BUILD_STATUSES: DB.ElementGenerationBuildStatus[] = [
  DB.ElementGenerationBuildStatus.COMPLETED,
  DB.ElementGenerationBuildStatus.INCOMPLETE,
]

export type UpdateGeneratedFlashcardDraftInput = {
  draftId: string
  expectedRevision: number
  current: GeneratedFlashcardEditable
}

export type GeneratedFlashcardDecisionInput = 'OPEN' | 'ACCEPTED' | 'REJECTED'

function draftError(message: string): never {
  throw questionGenerationServiceError('DRAFT_INVALID', message)
}

function requiredText(value: string, field: string, maxLength: number): string {
  const normalized = value.trim()
  if (
    !normalized ||
    normalized.length > maxLength ||
    /\p{C}/u.test(normalized)
  ) {
    return draftError(`${field} is invalid`)
  }
  return normalized
}

export function normalizeGeneratedFlashcardEditable(
  value: GeneratedFlashcardEditable
): GeneratedFlashcardEditable {
  if (
    value.cardType !== 'definition' &&
    value.cardType !== 'formula' &&
    value.cardType !== 'calculation'
  ) {
    return draftError('Flashcard type is invalid')
  }
  if (!Array.isArray(value.tags) || value.tags.length > MAX_TAGS) {
    return draftError(`Flashcard tags are limited to ${MAX_TAGS}`)
  }
  const tags = value.tags
    .map((tag, index) => requiredText(tag, `Tag ${index + 1}`, MAX_TAG_LENGTH))
    .filter(
      (tag) => tag !== 'generated-flashcard' && !tag.startsWith('flashcard:')
    )
  const requiredTags = ['generated-flashcard', `flashcard:${value.cardType}`]
  const normalizedTags = [...requiredTags, ...tags].filter(
    (tag, index, entries) => entries.indexOf(tag) === index
  )
  if (normalizedTags.length > MAX_TAGS) {
    return draftError(`Flashcard tags are limited to ${MAX_TAGS}`)
  }
  return {
    name: requiredText(value.name, 'Flashcard name', MAX_NAME_LENGTH),
    front: requiredText(value.front, 'Flashcard front', MAX_SIDE_LENGTH),
    back: requiredText(value.back, 'Flashcard back', MAX_SIDE_LENGTH),
    cardType: value.cardType,
    tags: normalizedTags,
  }
}

function editableFromOriginal(
  original: GeneratedFlashcard
): GeneratedFlashcardEditable {
  return normalizeGeneratedFlashcardEditable({
    name: original.name,
    front: original.front,
    back: original.back,
    cardType: original.cardType,
    tags: original.tags,
  })
}

export async function persistInitialGeneratedFlashcardDrafts(
  input: {
    buildId: string
    leaseOwner: string
    cards: GeneratedFlashcard[]
    resultStatus: 'completed' | 'completed_with_review' | 'incomplete'
    unresolvedElementCount: number
    warningCount: number
    resultManifestArtifact: QuestionGenerationArtifactRef
    finalBankArtifact: QuestionGenerationArtifactRef
    checkpointArtifact: QuestionGenerationArtifactRef | null
  },
  ctx: ContextWithUser
) {
  await ctx.prisma.$transaction(async (transaction) => {
    const build = await transaction.elementGenerationBuild.findFirst({
      where: {
        id: input.buildId,
        elementType: DB.ElementType.FLASHCARD,
        status: {
          in: [
            DB.ElementGenerationBuildStatus.RUNNING,
            DB.ElementGenerationBuildStatus.QUEUED,
            DB.ElementGenerationBuildStatus.PUBLISHING_INCOMPLETE,
          ],
        },
        syncLeaseOwner: input.leaseOwner,
      },
      select: { id: true },
    })
    if (!build) {
      throw questionGenerationServiceError(
        'CONCURRENT_MODIFICATION',
        'Flashcard build completion lost its lease'
      )
    }

    await transaction.generatedElementDraft.createMany({
      data: input.cards.map((card, order) => ({
        buildId: input.buildId,
        sourceElementId: card.sourceFlashcardId,
        order,
        elementType: DB.ElementType.FLASHCARD,
        original: card,
        current: editableFromOriginal(card),
        citations: [],
      })),
      skipDuplicates: true,
    })
    const draftCount = await transaction.generatedElementDraft.count({
      where: { buildId: input.buildId },
    })
    if (draftCount !== input.cards.length) {
      return draftError('Generated flashcard count does not match the bank')
    }

    const terminalStatus =
      input.resultStatus === 'incomplete'
        ? DB.ElementGenerationBuildStatus.INCOMPLETE
        : DB.ElementGenerationBuildStatus.COMPLETED
    const completed = await transaction.elementGenerationBuild.updateMany({
      where: {
        id: input.buildId,
        elementType: DB.ElementType.FLASHCARD,
        status: {
          in: [
            DB.ElementGenerationBuildStatus.RUNNING,
            DB.ElementGenerationBuildStatus.QUEUED,
            DB.ElementGenerationBuildStatus.PUBLISHING_INCOMPLETE,
          ],
        },
        syncLeaseOwner: input.leaseOwner,
      },
      data: {
        resultManifestArtifact: input.resultManifestArtifact,
        finalBankArtifact: input.finalBankArtifact,
        checkpointArtifact: input.checkpointArtifact ?? DB.Prisma.DbNull,
        generatedElementCount: input.cards.length,
        unresolvedElementCount: input.unresolvedElementCount,
        warningCount: input.warningCount,
        status: terminalStatus,
        stage:
          terminalStatus === DB.ElementGenerationBuildStatus.INCOMPLETE
            ? 'incomplete'
            : 'completed',
        completedAt: new Date(),
        lastSynchronizedAt: new Date(),
      },
    })
    if (completed.count !== 1) {
      throw questionGenerationServiceError(
        'CONCURRENT_MODIFICATION',
        'Flashcard build completion lost its lease'
      )
    }
  })
}

async function findOwnedDraft(draftId: string, ctx: ContextWithUser) {
  const draft = await ctx.prisma.generatedElementDraft.findFirst({
    where: {
      id: draftId,
      elementType: DB.ElementType.FLASHCARD,
      build: { is: { ownerId: ctx.user.sub } },
    },
    include: { build: { select: { status: true } } },
  })
  if (!draft) {
    throw questionGenerationServiceError(
      'GENERATED_FLASHCARD_DRAFT_NOT_FOUND',
      'Generated flashcard draft not found'
    )
  }
  return draft
}

function assertDraftCanChange(
  draft: Awaited<ReturnType<typeof findOwnedDraft>>
) {
  if (!EDITABLE_BUILD_STATUSES.includes(draft.build.status)) {
    throw questionGenerationServiceError(
      'INVALID_STAGE',
      'Generated flashcards can only change after terminal publication'
    )
  }
  if (draft.savedElementId !== null) {
    return draftError('A saved generated flashcard is immutable')
  }
}

async function lockBuild(
  transaction: DB.Prisma.TransactionClient,
  buildId: string
) {
  await transaction.$queryRaw`
    SELECT "id"
    FROM "ElementGenerationBuild"
    WHERE "id" = ${buildId}::uuid
    FOR UPDATE
  `
}

export async function updateGeneratedFlashcardDraft(
  input: UpdateGeneratedFlashcardDraftInput,
  ctx: ContextWithUser
) {
  await assertQuestionGenerationPreviewAccess(ctx)
  const owned = await findOwnedDraft(input.draftId, ctx)
  assertDraftCanChange(owned)
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) {
    return draftError('Expected draft revision is invalid')
  }
  const current = normalizeGeneratedFlashcardEditable(input.current)
  return ctx.prisma.$transaction(async (transaction) => {
    await lockBuild(transaction, owned.buildId)
    const updated = await transaction.generatedElementDraft.updateMany({
      where: {
        id: owned.id,
        revision: input.expectedRevision,
        savedElementId: null,
        build: {
          is: {
            ownerId: ctx.user.sub,
            status: { in: EDITABLE_BUILD_STATUSES },
          },
        },
      },
      data: { current, revision: { increment: 1 } },
    })
    if (updated.count !== 1) {
      throw questionGenerationServiceError(
        'CONCURRENT_MODIFICATION',
        'Generated flashcard was changed by another request'
      )
    }
    return transaction.generatedElementDraft.findUniqueOrThrow({
      where: { id: owned.id },
    })
  })
}

export async function setGeneratedFlashcardDecision(
  input: { draftId: string; decision: GeneratedFlashcardDecisionInput },
  ctx: ContextWithUser
) {
  await assertQuestionGenerationPreviewAccess(ctx)
  if (!Object.values(DB.GeneratedElementDecision).includes(input.decision)) {
    return draftError('Generated flashcard decision is invalid')
  }
  const draft = await findOwnedDraft(input.draftId, ctx)
  assertDraftCanChange(draft)
  if (draft.decision === input.decision) return draft

  const updated = await ctx.prisma.generatedElementDraft.updateMany({
    where: {
      id: draft.id,
      savedElementId: null,
      build: { is: { status: { in: EDITABLE_BUILD_STATUSES } } },
    },
    data: { decision: input.decision },
  })
  if (updated.count !== 1) {
    throw questionGenerationServiceError(
      'CONCURRENT_MODIFICATION',
      'Generated flashcard was saved by another request'
    )
  }
  return ctx.prisma.generatedElementDraft.findUniqueOrThrow({
    where: { id: draft.id },
  })
}
