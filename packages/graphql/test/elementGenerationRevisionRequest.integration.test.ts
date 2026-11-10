import { randomUUID } from 'node:crypto'
import { prisma } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import type { QuestionGenerationConfiguration } from '@klicker-uzh/types'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

vi.mock(
  '../src/services/questionGenerationGraph.js',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../src/services/questionGenerationGraph.js')
      >()
    return {
      ...actual,
      assertQuestionGenerationPreviewAccess: vi.fn(async () => undefined),
    }
  }
)

import type { ContextWithUser } from '../src/lib/context.js'
import { keepGeneratedElementDraft } from '../src/services/elementGeneration.js'
import { completeElementGeneration } from '../src/services/elementGenerationCompletion.js'
import { acquireElementGenerationLease } from '../src/services/elementGenerationLease.js'
import {
  REVISION_SUPPORTED_ELEMENT_TYPES,
  setGeneratedQuestionDecision,
  updateGeneratedQuestionDraft,
} from '../src/services/questionGenerationDrafts.js'

const costEnv = {
  KB_GRAPH_COST_CURRENCY: 'CHF',
  KB_GRAPH_STANDARD_ESTIMATE_MINOR_UNITS: '70',
  KB_GRAPH_HIGH_ESTIMATE_MINOR_UNITS: '90',
  KB_GRAPH_MAX_COST_MINOR_UNITS: '90',
  KB_GRAPH_SEMESTER_QUOTA_MINOR_UNITS: '1000',
  KB_GRAPH_COST_PRICING_VERSION: 'graph-test-v1',
  KB_GRAPH_SEMESTER_KEY: '2026-H2',
  KB_ELEMENT_GENERATION_QUESTION_COST_MINOR_UNITS: '40',
  KB_ELEMENT_GENERATION_FLASHCARD_COST_MINOR_UNITS: '30',
  KB_ELEMENT_GENERATION_FLASHCARD_RETRY_COST_MINOR_UNITS: '10',
  KB_ELEMENT_GENERATION_COST_PRICING_VERSION: 'elements-test-v1',
}

const configuration: QuestionGenerationConfiguration = {
  itemType: 'SC',
  language: 'en',
  questionCount: 3,
  difficultyPreset: 'MIXED',
  difficultyCounts: { d1: 1, d2: 1, d3: 1, d4: 0, d5: 0 },
  sourceScopes: [],
  objectives: [],
  bloomLevels: ['understand'],
  focusTopic: null,
}

const editable = {
  itemType: 'SC' as const,
  name: 'Synthetic question',
  stem: 'Choose the correct answer',
  context: null,
  explanation: null,
  tags: [],
  choices: [
    { id: 'a', label: 'A', text: 'One', correct: true, feedback: null },
    { id: 'b', label: 'B', text: 'Two', correct: false, feedback: null },
  ],
}

let ownerId: string
let graphBuildId: string
let parentId: string

const ctx = () =>
  ({
    prisma,
    user: { sub: ownerId },
    elementGenerationRuntime: {
      questionInputContainer: 'question-inputs',
      questionOutputContainer: 'question-results',
      questionOutputPrefix: 'element-results',
    },
  }) as unknown as ContextWithUser

async function createDraft(
  overrides: Partial<DB.Prisma.GeneratedElementDraftUncheckedCreateInput> = {}
) {
  return prisma.generatedElementDraft.create({
    data: {
      buildId: parentId,
      sourceElementId: 'slot-1',
      order: 0,
      elementType: DB.ElementType.SC,
      original: editable as never,
      current: editable,
      citations: [],
      targetDifficulty: 2,
      ...overrides,
    },
  })
}

async function createChild(
  revisionOfDraftId: string,
  status: DB.ElementGenerationBuildStatus
) {
  return prisma.elementGenerationBuild.create({
    data: {
      ownerId,
      sourceGraphBuildId: graphBuildId,
      elementType: DB.ElementType.SC,
      idempotencyKey: `child-${randomUUID()}`,
      configurationHash: 'child',
      configuration: configuration as never,
      requestedElementCount: 1,
      parentBuildId: parentId,
      revisionOfDraftId,
      status,
    },
  })
}

describe('revision request decision', () => {
  beforeEach(async () => {
    vi.stubEnv('NODE_ENV', 'test')
    for (const [key, value] of Object.entries(costEnv)) {
      vi.stubEnv(key, value)
    }
    REVISION_SUPPORTED_ELEMENT_TYPES.add(DB.ElementType.SC)
    ownerId = randomUUID()
    const kbId = randomUUID()
    graphBuildId = randomUUID()
    parentId = randomUUID()
    await prisma.user.create({
      data: {
        id: ownerId,
        email: `${ownerId}@example.org`,
        shortname: `revision-${ownerId.slice(0, 8)}`,
      },
    })
    await prisma.kB.create({
      data: { id: kbId, ownerId, name: 'Revision request test KB' },
    })
    await prisma.kBGraphBuild.create({
      data: {
        id: graphBuildId,
        kbId,
        requestedById: ownerId,
        sourceContentDigest: 'a'.repeat(64),
        graphName: `klickeruzh:kb:${kbId}:${graphBuildId}`,
      },
    })
    await prisma.elementGenerationBuild.create({
      data: {
        id: parentId,
        ownerId,
        sourceGraphBuildId: graphBuildId,
        elementType: DB.ElementType.SC,
        idempotencyKey: `parent-${parentId}`,
        configurationHash: 'parent',
        configuration: configuration as never,
        requestedElementCount: 3,
        status: DB.ElementGenerationBuildStatus.COMPLETED,
        costAccountingVersion: 1,
      },
    })
  })

  afterEach(async () => {
    REVISION_SUPPORTED_ELEMENT_TYPES.clear()
    vi.unstubAllEnvs()
    await prisma.user.delete({ where: { id: ownerId } })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('starts one child build and reserves one question share without touching the parent', async () => {
    const draft = await createDraft()

    const results = await Promise.allSettled([
      setGeneratedQuestionDecision(
        {
          draftId: draft.id,
          decision: 'REVISION_REQUESTED',
          note: ' Make it harder ',
        },
        ctx()
      ),
      setGeneratedQuestionDecision(
        { draftId: draft.id, decision: 'REVISION_REQUESTED' },
        ctx()
      ),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)

    const children = await prisma.elementGenerationBuild.findMany({
      where: { parentBuildId: parentId },
      include: { spends: true },
    })
    expect(children).toHaveLength(1)
    const child = children[0]!
    expect(child).toMatchObject({
      requestedElementCount: 1,
      sourceGraphBuildId: graphBuildId,
      revisionOfDraftId: draft.id,
      status: DB.ElementGenerationBuildStatus.PREPARING_INPUT,
    })
    expect(child.revisionDraftSnapshot).toMatchObject({ name: editable.name })
    // 40 minor units for a three-question build: ceil(40 / 3).
    expect(child.spends).toHaveLength(1)
    expect(child.spends[0]).toMatchObject({
      spendClass: DB.KBGraphQuotaSpendClass.ELEMENT_REVISION,
      estimatedCostMinorUnits: 14,
      costStatus: DB.KBGraphCostStatus.RESERVED,
    })
    const quota = await prisma.kBGraphQuota.findFirstOrThrow({
      where: { ownerId },
    })
    expect(quota.reservedMinorUnits).toBe(14)

    const parent = await prisma.elementGenerationBuild.findUniqueOrThrow({
      where: { id: parentId },
    })
    expect(parent.status).toBe(DB.ElementGenerationBuildStatus.COMPLETED)
    const stored = await prisma.generatedElementDraft.findUniqueOrThrow({
      where: { id: draft.id },
    })
    expect(stored.decision).toBe(DB.GeneratedElementDecision.REVISION_REQUESTED)
  })

  it('refuses a revision request until the element type supports it', async () => {
    REVISION_SUPPORTED_ELEMENT_TYPES.clear()
    const draft = await createDraft()

    await expect(
      setGeneratedQuestionDecision(
        { draftId: draft.id, decision: 'REVISION_REQUESTED' },
        ctx()
      )
    ).rejects.toThrow()
    expect(
      await prisma.elementGenerationBuild.count({
        where: { parentBuildId: parentId },
      })
    ).toBe(0)
  })

  it('freezes the draft while its child build is unfinished', async () => {
    const draft = await createDraft({
      decision: DB.GeneratedElementDecision.REVISION_REQUESTED,
    })
    const child = await createChild(
      draft.id,
      DB.ElementGenerationBuildStatus.RUNNING
    )

    await expect(
      setGeneratedQuestionDecision(
        { draftId: draft.id, decision: 'REJECTED' },
        ctx()
      )
    ).rejects.toThrow()
    await expect(
      setGeneratedQuestionDecision(
        { draftId: draft.id, decision: 'REVISION_REQUESTED' },
        ctx()
      )
    ).rejects.toThrow()
    await expect(
      updateGeneratedQuestionDraft(
        {
          draftId: draft.id,
          expectedRevision: 0,
          current: { ...editable, name: 'Edited' },
        },
        ctx()
      )
    ).rejects.toThrow()

    await expect(
      keepGeneratedElementDraft(
        {
          draftId: draft.id,
          expectedRevision: 0,
          status: DB.ElementStatus.REVIEW,
          type: DB.ElementType.SC,
          name: editable.name,
          content: editable.stem,
          basePoints: true,
          pointsMultiplier: 1,
          tags: [],
          choiceIds: editable.choices.map((choice) => choice.id),
          options: {
            displayMode: 'LIST',
            hasSampleSolution: true,
            hasAnswerFeedbacks: false,
            choices: editable.choices.map((choice, ix) => ({
              ix,
              value: choice.text,
              correct: choice.correct,
              feedback: null,
            })),
          },
        } as never,
        ctx()
      )
    ).rejects.toThrow('revision in progress')
    expect(
      (
        await prisma.generatedElementDraft.findUniqueOrThrow({
          where: { id: draft.id },
        })
      ).savedElementId
    ).toBeNull()

    await prisma.elementGenerationBuild.update({
      where: { id: child.id },
      data: { status: DB.ElementGenerationBuildStatus.FAILED },
    })
    await expect(
      setGeneratedQuestionDecision(
        { draftId: draft.id, decision: 'REJECTED' },
        ctx()
      )
    ).resolves.toMatchObject({ decision: DB.GeneratedElementDecision.REJECTED })
  })

  it('rejects the other unsaved drafts of a revision chain when one is accepted', async () => {
    const first = await createDraft({
      decision: DB.GeneratedElementDecision.REVISION_REQUESTED,
    })
    const second = await createDraft({
      duplicationIndex: 1,
      revisionOfDraftId: first.id,
    })
    const third = await createDraft({
      duplicationIndex: 2,
      revisionOfDraftId: second.id,
    })
    const duplicate = await createDraft({
      duplicationIndex: 3,
      parentDraftId: second.id,
    })
    const unrelated = await createDraft({
      sourceElementId: 'slot-2',
      order: 1,
    })

    await setGeneratedQuestionDecision(
      { draftId: second.id, decision: 'ACCEPTED' },
      ctx()
    )

    const decisions = Object.fromEntries(
      (
        await prisma.generatedElementDraft.findMany({
          where: { buildId: parentId },
        })
      ).map((row) => [row.id, row.decision])
    )
    expect(decisions[second.id]).toBe(DB.GeneratedElementDecision.ACCEPTED)
    expect(decisions[first.id]).toBe(DB.GeneratedElementDecision.REJECTED)
    expect(decisions[third.id]).toBe(DB.GeneratedElementDecision.REJECTED)
    expect(decisions[duplicate.id]).toBe(DB.GeneratedElementDecision.OPEN)
    expect(decisions[unrelated.id]).toBe(DB.GeneratedElementDecision.OPEN)
  })

  it('refuses to accept a chain draft while a sibling has an unfinished revision', async () => {
    const first = await createDraft({
      decision: DB.GeneratedElementDecision.REVISION_REQUESTED,
    })
    const second = await createDraft({
      duplicationIndex: 1,
      revisionOfDraftId: first.id,
      decision: DB.GeneratedElementDecision.REVISION_REQUESTED,
    })
    const third = await createDraft({
      duplicationIndex: 2,
      revisionOfDraftId: first.id,
    })
    const running = await createChild(
      second.id,
      DB.ElementGenerationBuildStatus.RUNNING
    )

    await expect(
      setGeneratedQuestionDecision(
        { draftId: third.id, decision: 'ACCEPTED' },
        ctx()
      )
    ).rejects.toThrow('revision in progress')
    const decisions = await prisma.generatedElementDraft.findMany({
      where: { buildId: parentId },
      orderBy: { duplicationIndex: 'asc' },
    })
    expect(decisions.map((row) => row.decision)).toEqual([
      DB.GeneratedElementDecision.REVISION_REQUESTED,
      DB.GeneratedElementDecision.REVISION_REQUESTED,
      DB.GeneratedElementDecision.OPEN,
    ])

    await prisma.elementGenerationBuild.update({
      where: { id: running.id },
      data: { status: DB.ElementGenerationBuildStatus.FAILED },
    })
    await expect(
      setGeneratedQuestionDecision(
        { draftId: third.id, decision: 'ACCEPTED' },
        ctx()
      )
    ).resolves.toMatchObject({ decision: DB.GeneratedElementDecision.ACCEPTED })
  })
})

describe('slot specifications', () => {
  const specification = {
    question_id: 'slot-1',
    design_slot_id: 'design-1',
    module_id: 'module-1',
    module_name: 'Synthetic module',
    objective_id: null,
    objective_source: null,
    learning_objective: 'synthetic objective',
    topic_targets: [],
    item_format: 'SC',
    bloom_level: 'understand',
    content_type: 'concept',
    difficulty_scale: 2,
    difficulty_mechanism: 'synthetic',
    planned_true_count: null,
    permitted_aids: null,
    evidence_target: null,
    question_kind: 'definition',
    difficulty_label: 'medium',
    graph_resolution: {},
    evidence: [{ id: 'chunk-1', text: 'synthetic evidence' }],
    assertions: [
      {
        id: 'assertion-1',
        version: 1,
        statement: 'synthetic claim',
        rationale: 'synthetic reason',
      },
    ],
  }
  const designSummary = {
    title: 'Synthetic design',
    questionCount: 1,
    objectives: [],
    modules: [],
    sources: [],
    warnings: [],
    slots: [
      {
        sourceQuestionId: 'slot-1',
        moduleId: 'module-1',
        objectiveId: null,
        bloomLevel: null,
        targetDifficulty: 2,
        evidenceEntityIds: [],
      },
    ],
  }

  beforeEach(async () => {
    ownerId = randomUUID()
    const kbId = randomUUID()
    graphBuildId = randomUUID()
    parentId = randomUUID()
    await prisma.user.create({
      data: {
        id: ownerId,
        email: `${ownerId}@example.org`,
        shortname: `slotspec-${ownerId.slice(0, 8)}`,
      },
    })
    await prisma.kB.create({
      data: { id: kbId, ownerId, name: 'Slot specification test KB' },
    })
    await prisma.kBGraphBuild.create({
      data: {
        id: graphBuildId,
        kbId,
        requestedById: ownerId,
        sourceContentDigest: 'a'.repeat(64),
        graphName: `klickeruzh:kb:${kbId}:${graphBuildId}`,
      },
    })
    await prisma.elementGenerationBuild.create({
      data: {
        id: parentId,
        ownerId,
        sourceGraphBuildId: graphBuildId,
        elementType: DB.ElementType.SC,
        idempotencyKey: `parent-${parentId}`,
        configurationHash: 'parent',
        configuration: configuration as never,
        requestedElementCount: 1,
        status: DB.ElementGenerationBuildStatus.FINALIZING,
        designSummary: designSummary as never,
        planSummary: { questionCount: 1, questions: [], warnings: [] },
      },
    })
  })

  afterEach(async () => {
    await prisma.user.delete({ where: { id: ownerId } })
  })

  it('stores each specification beside its design slot on completion', async () => {
    const leaseOwner = await acquireElementGenerationLease(prisma, {
      buildId: parentId,
      ownerId,
    })
    if (!leaseOwner) throw new Error('lease unavailable')
    const artifact = {
      containerName: 'synthetic',
      blobName: 'result.json',
      sha256: 'a'.repeat(64),
    }
    await completeElementGeneration(
      {
        kind: 'questions',
        buildId: parentId,
        leaseOwner,
        questions: [
          {
            sourceQuestionId: 'slot-1',
            suggestedTags: [],
            itemType: 'SC',
            name: editable.name,
            stem: editable.stem,
            context: null,
            explanation: null,
            tags: [],
            choices: editable.choices,
            bloomLevel: 'understand',
            targetDifficulty: 2,
            predictedDifficulty: 2,
            qualityFlags: [],
            citations: [],
            provenance: null,
          },
        ],
        resultStatus: 'completed',
        slotSpecifications: [specification],
        resultManifestArtifact: artifact,
        finalBankArtifact: artifact,
        questionProvenanceIndexArtifact: null,
      },
      ctx()
    )

    const build = await prisma.elementGenerationBuild.findUniqueOrThrow({
      where: { id: parentId },
    })
    const slots = (build.designSummary as typeof designSummary).slots as Array<{
      specification?: unknown
    }>
    expect(slots[0]!.specification).toEqual(specification)
  })
})
