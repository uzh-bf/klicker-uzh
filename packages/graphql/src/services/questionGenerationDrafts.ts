import { createHash, randomUUID } from 'node:crypto'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  GeneratedQuestionEditable,
  GeneratedQuestionTagSelection,
  QuestionGenerationConfiguration,
  QuestionGenerationDesignSummary,
  QuestionGenerationItemType,
  QuestionGenerationPlanSummary,
} from '@klicker-uzh/types'
import type { ContextWithUser } from '../lib/context.js'
import { createElementRevisionBuildInTransaction } from './elementGenerationAccounting.js'
import {
  canonicalElementGenerationJson,
  elementTypeSupportsRevision,
} from './elementGenerationProvider.js'
import { questionGenerationServiceError } from './questionGenerationErrors.js'
import { assertQuestionGenerationPreviewAccess } from './questionGenerationGraph.js'

const MAX_NAME_LENGTH = 500
const MAX_STEM_LENGTH = 20_000
const MAX_OPTION_LENGTH = 10_000
const MAX_OPTION_COUNT = 10
const MC_OPTION_COUNT = 5
const KPRIM_OPTION_COUNT = 4
const MAX_TAG_COUNT = 20
const MAX_TAG_LENGTH = 200

// A partial question run settles as INCOMPLETE with only the grounded drafts,
// and those drafts stay fully reviewable; a strict run settles as COMPLETED.
// This mirrors the flashcard incomplete-publication flow.
const REVIEWABLE_BUILD_STATUSES: DB.ElementGenerationBuildStatus[] = [
  DB.ElementGenerationBuildStatus.COMPLETED,
  DB.ElementGenerationBuildStatus.INCOMPLETE,
]

// A revision request is fulfilled by a child build; its draft stays frozen
// until that build reaches one of these states.
const FINISHED_BUILD_STATUSES: DB.ElementGenerationBuildStatus[] = [
  DB.ElementGenerationBuildStatus.COMPLETED,
  DB.ElementGenerationBuildStatus.INCOMPLETE,
  DB.ElementGenerationBuildStatus.REJECTED,
  DB.ElementGenerationBuildStatus.FAILED,
]

const MAX_REVISION_NOTE_LENGTH = 1000

export type UpdateGeneratedQuestionDraftInput = {
  draftId: string
  expectedRevision: number
  current: GeneratedQuestionEditableInputValue
  // Omitted preserves the stored selection; an explicit selection replaces it.
  tagSelection?: GeneratedQuestionTagSelection
}

export type GeneratedQuestionEditableInputValue = Omit<
  GeneratedQuestionEditable,
  'itemType' | 'context' | 'explanation' | 'choices' | 'tags' | 'tagSelection'
> & {
  itemType?: QuestionGenerationItemType | null
  context?: string | null
  explanation?: string | null
  tags?: string[] | null
  choices: Array<
    Omit<GeneratedQuestionEditable['choices'][number], 'feedback'> & {
      feedback?: string | null
    }
  >
}

function normalizeTags(value: string[] | null | undefined): string[] {
  const tags = [...new Set((value ?? []).map((tag) => tag.trim()))].filter(
    (tag) => tag.length > 0
  )
  if (
    tags.length > MAX_TAG_COUNT ||
    tags.some((tag) => tag.length > MAX_TAG_LENGTH)
  ) {
    return draftError('Generated question tags are invalid')
  }
  return tags
}

export type GeneratedQuestionDecisionInput =
  | 'OPEN'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'REVISION_REQUESTED'

function draftError(message: string): never {
  throw questionGenerationServiceError('DRAFT_INVALID', message)
}

function requiredText(value: string, field: string, maxLength: number): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > maxLength) {
    return draftError(`${field} is invalid`)
  }
  return normalized
}

function optionalText(
  value: string | null | undefined,
  field: string,
  maxLength: number
): string | null {
  const normalized = value?.trim() ?? ''
  if (normalized.length > maxLength) return draftError(`${field} is invalid`)
  return normalized || null
}

export function normalizeGeneratedQuestionEditable(
  value: GeneratedQuestionEditableInputValue,
  expectedItemType?: QuestionGenerationItemType
): GeneratedQuestionEditable {
  const itemType = value.itemType ?? expectedItemType ?? 'SC'
  if (itemType !== 'SC' && itemType !== 'MC' && itemType !== 'KPRIM') {
    return draftError('Generated question type is not supported')
  }
  if (expectedItemType !== undefined && itemType !== expectedItemType) {
    return draftError('Generated question type cannot be changed')
  }
  if (
    !Array.isArray(value.choices) ||
    (itemType === 'SC' &&
      (value.choices.length < 2 || value.choices.length > MAX_OPTION_COUNT)) ||
    (itemType === 'MC' && value.choices.length !== MC_OPTION_COUNT) ||
    (itemType === 'KPRIM' && value.choices.length !== KPRIM_OPTION_COUNT)
  ) {
    return draftError(
      itemType === 'SC'
        ? 'A generated SC draft requires 2-10 choices'
        : itemType === 'MC'
          ? 'A generated MC draft requires exactly five choices'
          : 'A generated KPRIM draft requires exactly four statements'
    )
  }

  const choices = value.choices.map((choice, index) => ({
    id: requiredText(choice.id, `Choice ${index + 1} ID`, 100),
    label: requiredText(choice.label, `Choice ${index + 1} label`, 20),
    text: requiredText(
      choice.text,
      `Choice ${index + 1} text`,
      MAX_OPTION_LENGTH
    ),
    correct: choice.correct,
    feedback: optionalText(
      choice.feedback,
      `Choice ${index + 1} feedback`,
      MAX_OPTION_LENGTH
    ),
  }))
  const tags = normalizeTags(value.tags)
  if (
    choices.some((choice) => typeof choice.correct !== 'boolean') ||
    (itemType === 'SC' &&
      choices.filter((choice) => choice.correct).length !== 1) ||
    (itemType === 'MC' &&
      (choices.filter((choice) => choice.correct).length < 2 ||
        choices.filter((choice) => choice.correct).length > 4 ||
        choices.map((choice) => choice.label).join('') !== 'ABCDE')) ||
    new Set(choices.map((choice) => choice.id)).size !== choices.length ||
    new Set(choices.map((choice) => choice.label)).size !== choices.length
  ) {
    return draftError(`Generated ${itemType} draft choices are inconsistent`)
  }

  const feedbackCount = choices.filter(
    (choice) => choice.feedback !== null
  ).length
  if (feedbackCount !== 0 && feedbackCount !== choices.length) {
    return draftError(
      'Answer feedback must be provided for either every choice or no choice'
    )
  }

  return {
    itemType,
    name: requiredText(value.name, 'Draft name', MAX_NAME_LENGTH),
    stem: requiredText(value.stem, 'Draft stem', MAX_STEM_LENGTH),
    context: optionalText(value.context, 'Draft context', MAX_STEM_LENGTH),
    explanation: optionalText(
      value.explanation,
      'Draft explanation',
      MAX_STEM_LENGTH
    ),
    tags,
    choices,
  }
}

async function findOwnedDraft(draftId: string, ctx: ContextWithUser) {
  const draft = await ctx.prisma.generatedElementDraft.findFirst({
    where: {
      id: draftId,
      elementType: {
        in: [DB.ElementType.SC, DB.ElementType.MC, DB.ElementType.KPRIM],
      },
      build: { is: { ownerId: ctx.user.sub } },
    },
    include: { build: { select: { status: true } } },
  })
  if (!draft) {
    throw questionGenerationServiceError(
      'GENERATED_QUESTION_DRAFT_NOT_FOUND',
      'Generated question draft not found'
    )
  }
  return draft
}

function assertDraftCanChange(
  draft: Awaited<ReturnType<typeof findOwnedDraft>>
) {
  if (!REVIEWABLE_BUILD_STATUSES.includes(draft.build.status)) {
    throw questionGenerationServiceError(
      'INVALID_STAGE',
      'Generated question drafts can only change after build completion'
    )
  }
  if (draft.savedElementId !== null) {
    return draftError('A saved generated question draft is immutable')
  }
}

async function lockQuestionGenerationBuild(
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

export async function assertNoUnfinishedRevision(
  transaction: DB.Prisma.TransactionClient,
  draftId: string
) {
  const unfinished = await transaction.elementGenerationBuild.count({
    where: {
      revisionOfDraftId: draftId,
      status: { notIn: FINISHED_BUILD_STATUSES },
    },
  })
  if (unfinished > 0) {
    throw questionGenerationServiceError(
      'INVALID_STAGE',
      'This draft has a revision in progress'
    )
  }
}

// Accepting any draft of a revision chain rejects the chain's other unsaved
// drafts. The chain is every draft reachable through `revisionOfDraftId`
// links in either direction; manual duplicates are not linked that way. A
// chain with an unfinished revision build refuses the accept, because the
// build would otherwise deliver a draft for an already rejected one. The
// caller holds the parent build's row lock.
export async function rejectOtherRevisionChainDrafts(
  transaction: DB.Prisma.TransactionClient,
  draftId: string
) {
  const chain = new Set<string>([draftId])
  let frontier = [draftId]
  while (frontier.length > 0) {
    const linked = await transaction.generatedElementDraft.findMany({
      where: {
        OR: [{ id: { in: frontier } }, { revisionOfDraftId: { in: frontier } }],
      },
      select: { id: true, revisionOfDraftId: true },
    })
    frontier = []
    for (const draft of linked) {
      for (const id of [draft.id, draft.revisionOfDraftId]) {
        if (id !== null && !chain.has(id)) {
          chain.add(id)
          frontier.push(id)
        }
      }
    }
  }
  const unfinished = await transaction.elementGenerationBuild.count({
    where: {
      revisionOfDraftId: { in: [...chain] },
      status: { notIn: FINISHED_BUILD_STATUSES },
    },
  })
  if (unfinished > 0) {
    throw questionGenerationServiceError(
      'INVALID_STAGE',
      'A draft of this revision chain has a revision in progress'
    )
  }
  chain.delete(draftId)
  if (chain.size === 0) return
  await transaction.generatedElementDraft.updateMany({
    where: {
      id: { in: [...chain] },
      savedElementId: null,
      decision: { not: DB.GeneratedElementDecision.REJECTED },
    },
    data: { decision: DB.GeneratedElementDecision.REJECTED },
  })
}

export async function updateGeneratedQuestionDraft(
  input: UpdateGeneratedQuestionDraftInput,
  ctx: ContextWithUser
) {
  await assertQuestionGenerationPreviewAccess(ctx)
  const owned = await findOwnedDraft(input.draftId, ctx)
  assertDraftCanChange(owned)
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) {
    return draftError('Expected draft revision is invalid')
  }
  return ctx.prisma.$transaction(async (transaction) => {
    await lockQuestionGenerationBuild(transaction, owned.buildId)
    const draft = await transaction.generatedElementDraft.findFirst({
      where: {
        id: owned.id,
        build: { is: { ownerId: ctx.user.sub } },
      },
      include: { build: { select: { status: true } } },
    })
    if (!draft) {
      throw questionGenerationServiceError(
        'GENERATED_QUESTION_DRAFT_NOT_FOUND',
        'Generated question draft not found'
      )
    }
    assertDraftCanChange(draft)
    await assertNoUnfinishedRevision(transaction, draft.id)
    const storedCurrent = draft.current as GeneratedQuestionEditable
    const current = normalizeGeneratedQuestionEditable(
      input.current,
      storedCurrent.itemType ?? 'SC'
    )
    const tagSelection = input.tagSelection ?? storedCurrent.tagSelection
    const nextCurrent: GeneratedQuestionEditable = tagSelection
      ? { ...current, tagSelection }
      : current

    const updated = await transaction.generatedElementDraft.updateMany({
      where: {
        id: draft.id,
        revision: input.expectedRevision,
        savedElementId: null,
      },
      data: { current: nextCurrent, revision: { increment: 1 } },
    })
    if (updated.count !== 1) {
      throw questionGenerationServiceError(
        'CONCURRENT_MODIFICATION',
        'Generated question draft was changed by another request'
      )
    }
    return transaction.generatedElementDraft.findUniqueOrThrow({
      where: { id: draft.id },
    })
  })
}

export async function duplicateGeneratedQuestionDraft(
  draftId: string,
  ctx: ContextWithUser
) {
  await assertQuestionGenerationPreviewAccess(ctx)
  const owned = await findOwnedDraft(draftId, ctx)
  assertDraftCanChange(owned)

  return ctx.prisma.$transaction(async (transaction) => {
    await lockQuestionGenerationBuild(transaction, owned.buildId)
    const draft = await transaction.generatedElementDraft.findFirst({
      where: {
        id: draftId,
        savedElementId: null,
        build: {
          is: {
            ownerId: ctx.user.sub,
            status: { in: REVIEWABLE_BUILD_STATUSES },
          },
        },
      },
    })
    if (!draft) {
      return draftError('Generated question draft can no longer be duplicated')
    }
    const maximum = await transaction.generatedElementDraft.aggregate({
      where: {
        buildId: draft.buildId,
        sourceElementId: draft.sourceElementId,
      },
      _max: { duplicationIndex: true },
    })
    return transaction.generatedElementDraft.create({
      data: {
        buildId: draft.buildId,
        sourceElementId: draft.sourceElementId,
        order: draft.order,
        duplicationIndex: (maximum._max.duplicationIndex ?? 0) + 1,
        elementType: draft.elementType,
        parentDraftId: draft.id,
        original: draft.original,
        current: draft.current,
        bloomLevel: draft.bloomLevel,
        targetDifficulty: draft.targetDifficulty,
        predictedDifficulty: draft.predictedDifficulty,
        qualityFlags: draft.qualityFlags,
        citations: draft.citations,
        provenance: draft.provenance ?? DB.Prisma.DbNull,
      },
    })
  })
}

function normalizeRevisionNote(value: string | null | undefined) {
  const note = value?.trim() ?? ''
  if (note.length > MAX_REVISION_NOTE_LENGTH) {
    return draftError('The revision note is too long')
  }
  return note || null
}

// A one-slot configuration derived from the parent build: the slot keeps the
// parent's sources, objectives and language and asks for the draft's level.
function revisionConfiguration(
  parent: QuestionGenerationConfiguration,
  targetDifficulty: number | null
): QuestionGenerationConfiguration {
  const level =
    targetDifficulty !== null && targetDifficulty >= 1 && targetDifficulty <= 5
      ? targetDifficulty
      : 3
  return {
    ...parent,
    questionCount: 1,
    difficultyPreset:
      `D${level}` as QuestionGenerationConfiguration['difficultyPreset'],
    difficultyCounts: { d1: 0, d2: 0, d3: 0, d4: 0, d5: 0, [`d${level}`]: 1 },
  }
}

function revisionSlotSummaries(
  parent: Pick<DB.ElementGenerationBuild, 'designSummary' | 'planSummary'>,
  slotId: string
) {
  const design = parent.designSummary as QuestionGenerationDesignSummary | null
  const plan = parent.planSummary as QuestionGenerationPlanSummary | null
  // A draft carries its question id; the design slot is found through the
  // stored slot specification, whose question id names that draft's question.
  const slot = design?.slots.find((entry) =>
    entry.specification
      ? entry.specification.question_id === slotId
      : entry.sourceQuestionId === slotId
  )
  const question = plan?.questions.find(
    (entry) => entry.sourceQuestionId === slotId
  )
  return {
    ...(design && slot
      ? {
          designSummary: {
            ...design,
            questionCount: 1,
            modules: design.modules.filter(
              (entry) => entry.moduleId === slot.moduleId
            ),
            slots: [slot],
          },
        }
      : {}),
    ...(plan && question
      ? {
          planSummary: {
            questionCount: 1,
            questions: [question],
            warnings: [],
          },
        }
      : {}),
  }
}

export async function setGeneratedQuestionDecision(
  input: {
    draftId: string
    decision: GeneratedQuestionDecisionInput
    note?: string | null
  },
  ctx: ContextWithUser
) {
  await assertQuestionGenerationPreviewAccess(ctx)
  if (!Object.values(DB.GeneratedElementDecision).includes(input.decision)) {
    return draftError('Generated question decision is invalid')
  }
  const isRevision =
    input.decision === DB.GeneratedElementDecision.REVISION_REQUESTED
  const note = normalizeRevisionNote(input.note)
  if (note !== null && !isRevision) {
    return draftError('A note is only accepted with a revision request')
  }
  const draft = await findOwnedDraft(input.draftId, ctx)
  if (isRevision && !elementTypeSupportsRevision(draft.elementType)) {
    return draftError('Revision requests are not available yet')
  }
  if (draft.savedElementId !== null && draft.decision !== input.decision) {
    return draftError('A saved generated question decision is immutable')
  }
  if (!REVIEWABLE_BUILD_STATUSES.includes(draft.build.status)) {
    throw questionGenerationServiceError(
      'INVALID_STAGE',
      'Generated question decisions require a completed build'
    )
  }
  if (draft.decision === input.decision && !isRevision) return draft

  return ctx.prisma.$transaction(async (transaction) => {
    await lockQuestionGenerationBuild(transaction, draft.buildId)
    const current = await transaction.generatedElementDraft.findFirst({
      where: { id: draft.id, build: { is: { ownerId: ctx.user.sub } } },
      include: { build: true },
    })
    if (
      !current ||
      current.savedElementId !== null ||
      !REVIEWABLE_BUILD_STATUSES.includes(current.build.status)
    ) {
      throw questionGenerationServiceError(
        'CONCURRENT_MODIFICATION',
        'Generated question draft was saved by another request'
      )
    }
    await assertNoUnfinishedRevision(transaction, current.id)
    if (current.decision === input.decision && !isRevision) return current

    if (isRevision) {
      const runtime = ctx.elementGenerationRuntime
      if (!runtime) {
        throw questionGenerationServiceError(
          'QUESTION_GENERATION_UNAVAILABLE',
          'Question generation is not configured'
        )
      }
      const attempt = await transaction.elementGenerationBuild.count({
        where: { revisionOfDraftId: current.id },
      })
      const configuration = revisionConfiguration(
        current.build.configuration as QuestionGenerationConfiguration,
        current.targetDifficulty
      )
      const buildId = randomUUID()
      const idempotencyKey = `revision:${current.id}:${current.revision}:${attempt}`
      await createElementRevisionBuildInTransaction(transaction, {
        ownerId: ctx.user.sub,
        idempotencyKey,
        parentRequestedElementCount: current.build.requestedElementCount,
        data: {
          id: buildId,
          ownerId: ctx.user.sub,
          sourceGraphBuildId: current.build.sourceGraphBuildId,
          elementType: current.build.elementType,
          idempotencyKey,
          configurationHash: createHash('sha256')
            .update(
              JSON.stringify(canonicalElementGenerationJson(configuration))
            )
            .digest('hex'),
          configuration,
          requestedElementCount: 1,
          parentBuildId: current.buildId,
          revisionOfDraftId: current.id,
          revisionNote: note,
          // The child carries its own one-slot design and plan so that its
          // result is verified against the slot it reworks, even after the
          // old draft or the parent's summaries change.
          ...revisionSlotSummaries(current.build, current.sourceElementId),
          revisionDraftSnapshot:
            current.current as DB.GeneratedElementDraft['current'],
          inputArtifactContainer: runtime.questionInputContainer,
          inputArtifactPrefix: `question-builds/${buildId}`,
          outputArtifactContainer: runtime.questionOutputContainer,
          outputArtifactPrefix: `${runtime.questionOutputPrefix}/${buildId}`,
        },
      })
    }

    const updated = await transaction.generatedElementDraft.updateMany({
      where: { id: current.id, savedElementId: null },
      data: { decision: input.decision },
    })
    if (updated.count !== 1) {
      throw questionGenerationServiceError(
        'CONCURRENT_MODIFICATION',
        'Generated question draft was saved by another request'
      )
    }
    if (input.decision === DB.GeneratedElementDecision.ACCEPTED) {
      await rejectOtherRevisionChainDrafts(transaction, current.id)
    }
    return transaction.generatedElementDraft.findUniqueOrThrow({
      where: { id: current.id },
      include: { build: { select: { status: true } } },
    })
  })
}
