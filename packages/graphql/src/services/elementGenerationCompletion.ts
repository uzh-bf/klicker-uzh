import * as DB from '@klicker-uzh/prisma/client'
import type {
  GeneratedFlashcard,
  GeneratedQuestionWithProvenance,
  QuestionGenerationArtifactRef,
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
      select: { elementType: true },
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

    const completion =
      input.kind === 'questions'
        ? {
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
            },
            terminalStatus: DB.ElementGenerationBuildStatus.COMPLETED,
          }
        : {
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
