import * as DB from '@klicker-uzh/prisma/client'
import {
  clearSlotSpecificationEvidence,
  type ElementGenerationSlotFailure,
  type ElementGenerationSlotSpecification,
  type GeneratedFlashcard,
  type GeneratedQuestionWithProvenance,
  type QuestionGenerationArtifactRef,
  type QuestionGenerationDesignSummary,
  type QuestionGenerationPlanSummary,
} from '@klicker-uzh/types'
import type { ContextWithUser } from '../lib/context.js'
import { normalizeGeneratedFlashcardEditable } from './flashcardGenerationDrafts.js'
import { questionGenerationServiceError } from './questionGenerationErrors.js'

const QUESTION_ELEMENT_TYPES = [
  DB.ElementType.SC,
  DB.ElementType.MC,
  DB.ElementType.KPRIM,
]
const FLASHCARD_COMPLETION_STATUSES = [
  DB.ElementGenerationBuildStatus.RUNNING,
  DB.ElementGenerationBuildStatus.QUEUED,
  DB.ElementGenerationBuildStatus.PUBLISHING_INCOMPLETE,
]

type QuestionElementGenerationCompletionInput = {
  kind: 'questions'
  buildId: string
  leaseOwner: string
  questions: GeneratedQuestionWithProvenance[]
  // A partial run delivers the passing subset of the bank and settles as
  // INCOMPLETE, which is the reviewable terminal state the flashcard
  // incomplete-publication flow also uses. A strict run settles as COMPLETED.
  resultStatus: 'completed' | 'incomplete'
  unresolvedElementCount?: number
  // The per-slot reasons of a partial run. They are persisted with the build
  // summary so the reviewing client can serve the attention cards without
  // downloading the result manifest again.
  slotFailures?: ElementGenerationSlotFailure[]
  // Present when the worker's result provided slot specifications; builds from
  // an older worker keep the design summary as it is.
  slotSpecifications?: ElementGenerationSlotSpecification[]
  resultManifestArtifact: QuestionGenerationArtifactRef
  finalBankArtifact: QuestionGenerationArtifactRef
  questionProvenanceIndexArtifact: QuestionGenerationArtifactRef | null
}

type FlashcardElementGenerationCompletionInput = {
  kind: 'flashcards'
  buildId: string
  leaseOwner: string
  cards: GeneratedFlashcard[]
  resultStatus: 'completed' | 'completed_with_review' | 'incomplete'
  unresolvedElementCount: number
  warningCount: number
  resultManifestArtifact: QuestionGenerationArtifactRef
  finalBankArtifact: QuestionGenerationArtifactRef
  checkpointArtifact: QuestionGenerationArtifactRef | null
}

export type CompleteElementGenerationInput =
  | QuestionElementGenerationCompletionInput
  | FlashcardElementGenerationCompletionInput

function draftError(message: string): never {
  throw questionGenerationServiceError('DRAFT_INVALID', message)
}

// Stores each slot's specification beside its design slot summary. A
// specification for a slot the design does not list is a contract violation.
// Returns null when there is nothing to store, so callers keep the summary.
// Design slots are keyed by the worker's design slot id, which differs from the
// id of the question generated for that slot.
export function withSlotSpecifications(
  designSummary: QuestionGenerationDesignSummary | null,
  specifications: ElementGenerationSlotSpecification[] | undefined
): QuestionGenerationDesignSummary | null {
  if (!specifications || specifications.length === 0) return null
  if (!designSummary) {
    return draftError('Slot specifications require a design summary')
  }
  const bySlot = new Map(
    specifications.map((specification) => [
      specification.design_slot_id,
      specification,
    ])
  )
  if (
    specifications.some(
      (specification) =>
        !designSummary.slots.some(
          (slot) => slot.sourceQuestionId === specification.design_slot_id
        )
    )
  ) {
    return draftError('Slot specifications do not match the design slots')
  }
  return {
    ...designSummary,
    slots: designSummary.slots.map((slot) => {
      const specification = bySlot.get(slot.sourceQuestionId)
      return specification ? { ...slot, specification } : slot
    }),
  }
}

// A child build's one question joins the parent's review as a new draft of
// the same slot, linked to the draft it reworks. The row lock on the parent
// serializes the duplication index with keep, duplicate and decisions, and the
// lease-and-status guard on the child makes a repeated completion roll back
// instead of adding a second draft.
async function completeRevisionChildBuild(
  transaction: DB.Prisma.TransactionClient,
  input: QuestionElementGenerationCompletionInput,
  parentBuildId: string,
  revisionOfDraftId: string | null
) {
  await transaction.$queryRaw`
    SELECT "id"
    FROM "ElementGenerationBuild"
    WHERE "id" = ${parentBuildId}::uuid
    FOR UPDATE
  `
  const [question] = input.questions
  const previous = revisionOfDraftId
    ? await transaction.generatedElementDraft.findUnique({
        where: { id: revisionOfDraftId },
      })
    : null
  if (
    input.questions.length !== 1 ||
    !question ||
    !previous ||
    previous.buildId !== parentBuildId ||
    previous.sourceElementId !== question.sourceQuestionId
  ) {
    return draftError('Revised question does not match the reworked draft')
  }
  const parent = await transaction.elementGenerationBuild.findUniqueOrThrow({
    where: { id: parentBuildId },
    select: { designSummary: true, evidencePurgedAt: true },
  })
  const { provenance, ...original } = question
  const maximum = await transaction.generatedElementDraft.aggregate({
    where: {
      buildId: parentBuildId,
      sourceElementId: previous.sourceElementId,
    },
    _max: { duplicationIndex: true },
  })
  await transaction.generatedElementDraft.create({
    data: {
      buildId: parentBuildId,
      sourceElementId: previous.sourceElementId,
      order: previous.order,
      duplicationIndex: (maximum._max.duplicationIndex ?? 0) + 1,
      elementType: original.itemType,
      parentDraftId: previous.id,
      revisionOfDraftId: previous.id,
      revisionBuildId: input.buildId,
      original,
      current: {
        itemType: original.itemType ?? 'SC',
        name: original.name,
        stem: original.stem,
        context: original.context,
        explanation: original.explanation,
        tags: original.tags,
        choices: original.choices.map((choice) => ({ ...choice })),
      },
      bloomLevel: original.bloomLevel,
      targetDifficulty: original.targetDifficulty,
      predictedDifficulty: original.predictedDifficulty,
      qualityFlags: original.qualityFlags,
      citations: original.citations,
      provenance: provenance ?? DB.Prisma.DbNull,
    },
  })

  // The fresh specification replaces the slot's stored one, so the next
  // revision in a chain starts from it. After a purge it keeps no evidence.
  const refreshed = withSlotSpecifications(
    parent.designSummary as QuestionGenerationDesignSummary | null,
    input.slotSpecifications?.map((specification) =>
      parent.evidencePurgedAt !== null
        ? clearSlotSpecificationEvidence(specification)
        : specification
    )
  )
  if (refreshed) {
    await transaction.elementGenerationBuild.update({
      where: { id: parentBuildId },
      data: { designSummary: refreshed },
    })
  }

  const completed = await transaction.elementGenerationBuild.updateMany({
    where: {
      id: input.buildId,
      status: DB.ElementGenerationBuildStatus.FINALIZING,
      syncLeaseOwner: input.leaseOwner,
    },
    data: {
      resultManifestArtifact: input.resultManifestArtifact,
      finalBankArtifact: input.finalBankArtifact,
      provenanceIndexArtifact:
        input.questionProvenanceIndexArtifact ?? DB.Prisma.DbNull,
      generatedElementCount: 1,
      unresolvedElementCount: 0,
      status: DB.ElementGenerationBuildStatus.COMPLETED,
      stage: 'completed',
      completedAt: new Date(),
      lastSynchronizedAt: new Date(),
    },
  })
  if (completed.count !== 1) {
    throw questionGenerationServiceError(
      'CONCURRENT_MODIFICATION',
      'Question-generation build completion lost its lease'
    )
  }
}

export async function completeElementGeneration(
  input: CompleteElementGenerationInput,
  ctx: ContextWithUser
) {
  await ctx.prisma.$transaction(async (transaction) => {
    const build = await transaction.elementGenerationBuild.findFirst({
      where:
        input.kind === 'questions'
          ? {
              id: input.buildId,
              elementType: { in: QUESTION_ELEMENT_TYPES },
              status: DB.ElementGenerationBuildStatus.FINALIZING,
              syncLeaseOwner: input.leaseOwner,
            }
          : {
              id: input.buildId,
              elementType: DB.ElementType.FLASHCARD,
              status: { in: FLASHCARD_COMPLETION_STATUSES },
              syncLeaseOwner: input.leaseOwner,
            },
      select: {
        elementType: true,
        planSummary: true,
        designSummary: true,
        parentBuildId: true,
        revisionOfDraftId: true,
      },
    })
    if (!build) {
      throw questionGenerationServiceError(
        'CONCURRENT_MODIFICATION',
        input.kind === 'questions'
          ? 'Question-generation build completion lost its lease'
          : 'Flashcard build completion lost its lease'
      )
    }

    if (
      input.kind === 'questions' &&
      input.questions.some(
        (question) => question.itemType !== build.elementType
      )
    ) {
      return draftError(
        'Generated question types do not match the requested element type'
      )
    }

    if (input.kind === 'questions' && build.parentBuildId) {
      return completeRevisionChildBuild(
        transaction,
        input,
        build.parentBuildId,
        build.revisionOfDraftId
      )
    }
    const slotSpecificationSummary =
      input.kind === 'questions'
        ? withSlotSpecifications(
            build.designSummary as QuestionGenerationDesignSummary | null,
            input.slotSpecifications
          )
        : null
    const completion =
      input.kind === 'questions'
        ? {
            // planSummary is the schema-less build-summary JSON. A partial run
            // stores its per-slot attention cards alongside the reviewed Plan
            // so the build query can serve them without re-reading the result
            // manifest; a strict run leaves the summary untouched.
            summaryData: {
              ...(input.slotFailures && input.slotFailures.length > 0
                ? {
                    planSummary: {
                      ...((build.planSummary ??
                        {}) as QuestionGenerationPlanSummary),
                      slotFailures: input.slotFailures,
                    },
                  }
                : {}),
              ...(slotSpecificationSummary
                ? { designSummary: slotSpecificationSummary }
                : {}),
            },
            draftData: input.questions.map((question, order) => {
              const { provenance, ...original } = question
              return {
                buildId: input.buildId,
                sourceElementId: original.sourceQuestionId,
                order,
                duplicationIndex: 0,
                elementType: original.itemType,
                original,
                current: {
                  itemType: original.itemType ?? 'SC',
                  name: original.name,
                  stem: original.stem,
                  context: original.context,
                  explanation: original.explanation,
                  tags: original.tags,
                  choices: original.choices.map((choice) => ({ ...choice })),
                },
                bloomLevel: original.bloomLevel,
                targetDifficulty: original.targetDifficulty,
                predictedDifficulty: original.predictedDifficulty,
                qualityFlags: original.qualityFlags,
                citations: original.citations,
                provenance: provenance ?? DB.Prisma.DbNull,
              }
            }),
            draftCountWhere: {
              buildId: input.buildId,
              duplicationIndex: 0,
            },
            expectedDraftCount: input.questions.length,
            updateWhere: {
              id: input.buildId,
              elementType: build.elementType,
              status: DB.ElementGenerationBuildStatus.FINALIZING,
              syncLeaseOwner: input.leaseOwner,
            },
            updateData: {
              resultManifestArtifact: input.resultManifestArtifact,
              finalBankArtifact: input.finalBankArtifact,
              provenanceIndexArtifact:
                input.questionProvenanceIndexArtifact ?? DB.Prisma.DbNull,
              generatedElementCount: input.questions.length,
              unresolvedElementCount: input.unresolvedElementCount ?? 0,
            },
            terminalStatus:
              input.resultStatus === 'incomplete'
                ? DB.ElementGenerationBuildStatus.INCOMPLETE
                : DB.ElementGenerationBuildStatus.COMPLETED,
          }
        : {
            summaryData: {},
            draftData: input.cards.map((card, order) => ({
              buildId: input.buildId,
              sourceElementId: card.sourceFlashcardId,
              order,
              elementType: DB.ElementType.FLASHCARD,
              original: card,
              current: normalizeGeneratedFlashcardEditable({
                name: card.name,
                front: card.front,
                back: card.back,
                cardType: card.cardType,
                tags: card.tags,
              }),
              citations: [],
            })),
            draftCountWhere: { buildId: input.buildId },
            expectedDraftCount: input.cards.length,
            updateWhere: {
              id: input.buildId,
              elementType: DB.ElementType.FLASHCARD,
              status: { in: FLASHCARD_COMPLETION_STATUSES },
              syncLeaseOwner: input.leaseOwner,
            },
            updateData: {
              resultManifestArtifact: input.resultManifestArtifact,
              finalBankArtifact: input.finalBankArtifact,
              checkpointArtifact: input.checkpointArtifact ?? DB.Prisma.DbNull,
              generatedElementCount: input.cards.length,
              unresolvedElementCount: input.unresolvedElementCount,
              warningCount: input.warningCount,
            },
            terminalStatus:
              input.resultStatus === 'incomplete'
                ? DB.ElementGenerationBuildStatus.INCOMPLETE
                : DB.ElementGenerationBuildStatus.COMPLETED,
          }

    await transaction.generatedElementDraft.createMany({
      data: completion.draftData,
      skipDuplicates: true,
    })
    const draftCount = await transaction.generatedElementDraft.count({
      where: completion.draftCountWhere,
    })
    if (draftCount !== completion.expectedDraftCount) {
      return draftError(
        input.kind === 'questions'
          ? 'Generated draft count does not match the final bank'
          : 'Generated flashcard count does not match the bank'
      )
    }

    const completed = await transaction.elementGenerationBuild.updateMany({
      where: completion.updateWhere,
      data: {
        ...completion.summaryData,
        ...completion.updateData,
        status: completion.terminalStatus,
        stage:
          completion.terminalStatus ===
          DB.ElementGenerationBuildStatus.INCOMPLETE
            ? 'incomplete'
            : 'completed',
        completedAt: new Date(),
        lastSynchronizedAt: new Date(),
      },
    })
    if (completed.count !== 1) {
      throw questionGenerationServiceError(
        'CONCURRENT_MODIFICATION',
        input.kind === 'questions'
          ? 'Question-generation build completion lost its lease'
          : 'Flashcard build completion lost its lease'
      )
    }
  })
}
