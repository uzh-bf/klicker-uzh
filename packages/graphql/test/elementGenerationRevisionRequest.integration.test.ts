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
import { reserveElementGenerationRetrySpend } from '../src/services/elementGenerationAccounting.js'
import { acquireElementGenerationLease } from '../src/services/elementGenerationLease.js'
import {
  getQuestionGenerationBuild,
  questionWorkflowStartManifestSha256,
  questionWorkflowStartPayload,
} from '../src/services/questionGeneration.js'
import {
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
  status: DB.ElementGenerationBuildStatus,
  overrides: Partial<DB.Prisma.ElementGenerationBuildUncheckedCreateInput> = {}
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
      ...overrides,
    },
  })
}

describe('revision request decision', () => {
  beforeEach(async () => {
    vi.stubEnv('NODE_ENV', 'test')
    for (const [key, value] of Object.entries(costEnv)) {
      vi.stubEnv(key, value)
    }
    vi.stubEnv('ELEMENT_REVISION_WORKER_ENABLED', 'true')
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
    vi.stubEnv('ELEMENT_REVISION_WORKER_ENABLED', 'false')
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

  describe('retrying a failed child build', () => {
    const retry = (buildId: string) =>
      reserveElementGenerationRetrySpend(prisma, {
        buildId,
        ownerId,
        dispatchAttemptId: randomUUID(),
        spendClass: DB.KBGraphQuotaSpendClass.ELEMENT_REVISION,
        parentRequestedElementCount: 3,
        elementTypes: [DB.ElementType.SC],
        expectedStatus: DB.ElementGenerationBuildStatus.FAILED,
        clearCompletedAt: true,
      })
    const failedChild = (draftId: string, createdAt?: Date) =>
      createChild(draftId, DB.ElementGenerationBuildStatus.FAILED, {
        costAccountingVersion: 1,
        errorRetryable: true,
        ...(createdAt ? { createdAt } : {}),
      })

    it('reserves the revision share once when it is the only request', async () => {
      const draft = await createDraft({
        decision: DB.GeneratedElementDecision.REVISION_REQUESTED,
      })
      const child = await failedChild(draft.id)

      await expect(retry(child.id)).resolves.toBe(true)

      expect(
        await prisma.elementGenerationSpend.count({
          where: { buildId: child.id },
        })
      ).toBe(1)
      expect(
        (
          await prisma.elementGenerationBuild.findUniqueOrThrow({
            where: { id: child.id },
          })
        ).status
      ).toBe(DB.ElementGenerationBuildStatus.PREPARING_INPUT)
    })

    it('refuses a retry beside an unfinished or newer request for the same draft', async () => {
      const draft = await createDraft({
        decision: DB.GeneratedElementDecision.REVISION_REQUESTED,
      })
      const old = await failedChild(draft.id, new Date('2026-01-01'))
      const newer = await createChild(
        draft.id,
        DB.ElementGenerationBuildStatus.RUNNING
      )

      await expect(retry(old.id)).rejects.toThrow('newer or unfinished')
      await prisma.elementGenerationBuild.update({
        where: { id: newer.id },
        data: { status: DB.ElementGenerationBuildStatus.FAILED },
      })
      await expect(retry(old.id)).rejects.toThrow('newer or unfinished')

      expect(
        await prisma.elementGenerationSpend.count({
          where: { buildId: old.id },
        })
      ).toBe(0)
      expect(
        (
          await prisma.elementGenerationBuild.findUniqueOrThrow({
            where: { id: old.id },
          })
        ).status
      ).toBe(DB.ElementGenerationBuildStatus.FAILED)
    })

    it('lets only one of two concurrent retries of the same child run', async () => {
      const draft = await createDraft({
        decision: DB.GeneratedElementDecision.REVISION_REQUESTED,
      })
      const child = await failedChild(draft.id)

      const results = await Promise.allSettled([
        retry(child.id),
        retry(child.id),
      ])

      expect(
        results.filter((r) => r.status === 'fulfilled' && r.value === true)
      ).toHaveLength(1)
      expect(
        await prisma.elementGenerationSpend.count({
          where: { buildId: child.id },
        })
      ).toBe(1)
    })
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

describe('revision child build dispatch and completion', () => {
  const bundleSha = 'b'.repeat(64)
  const graphSha = 'c'.repeat(64)
  const digest = 'd'.repeat(64)
  const ref = (blob: string, sha = 'e'.repeat(64)) => ({
    container_name: 'graph-artifacts',
    blob_name: `bundle/${blob}`,
    sha256: sha,
    filename: blob,
    size_bytes: 1,
    content_type: 'application/json',
  })
  const policy = ref('policy.json', '1'.repeat(64))
  const recipe = ref('recipe.json', '2'.repeat(64))
  const graphManifestBytes = () =>
    Buffer.from(
      JSON.stringify({
        schema_version: 2,
        course_id: graphBuildId,
        storage_name: 'synthetic-storage',
        falkordb_graph_name: `klickeruzh:kb:${graphKbId}:${graphBuildId}`,
        bundle_sha256: bundleSha,
        graph_sha256: graphSha,
        domain_policy_digest: digest,
        generation_recipe_digest: digest,
        artifacts: [
          ref('graph_chunk_entity_relation.graphml', graphSha),
          ref('vdb_chunks.json', '3'.repeat(64)),
          policy,
          recipe,
        ],
        policy,
        recipe,
        parent_bundle_sha256: null,
        correction_set: null,
        instructor_assertions: [],
      })
    )

  let graphKbId: string
  let draftId: string

  const slot = {
    sourceQuestionId: 'slot-1',
    moduleId: 'M1',
    objectiveId: null,
    bloomLevel: 'understand',
    targetDifficulty: 2,
    evidenceEntityIds: [],
  }
  const plannedQuestion = {
    sourceQuestionId: 'slot-1',
    moduleId: 'M1',
    objectiveId: null,
    stem: 'Choose the correct answer',
    bloomLevel: 'understand',
    targetDifficulty: 2,
    sources: [],
  }

  function resultBytes(childId: string, overrides: object = {}) {
    return Buffer.from(
      JSON.stringify({
        schema_version: 1,
        question_build_id: childId,
        status: 'completed',
        generation_policy: 'new_only',
        requested_questions: 1,
        generated_questions: 1,
        final_questions: {
          container_name: 'question-results',
          blob_name: `element-results/${childId}/questions/final.json`,
          sha256: 'a'.repeat(64),
        },
        question_provenance_index: null,
        review_required_questions: 0,
        review_required_question_ids: [],
        rejected_at: null,
        reviewed_by: null,
        ...overrides,
      })
    )
  }

  function bankBytes(withTarget = true) {
    return Buffer.from(
      JSON.stringify({
        metadata: { format: 'MC5', total_questions: 1 },
        questions: [
          {
            id: 'slot-1',
            stem: 'A revised question?',
            bloom_level: 'understand',
            origin_mode: 'new',
            item_format: 'single_choice',
            difficulty_scale: 2,
            ...(withTarget ? { target_difficulty_scale: 2 } : {}),
            difficulty_status: 'llm_reviewed',
            options: [
              { label: 'A', text: 'One', is_correct: true },
              { label: 'B', text: 'Two', is_correct: false },
            ],
            correct_label: 'A',
            citations: [],
          },
        ],
      })
    )
  }

  function fakeRuntime(
    options: {
      runStatus?: 'SUCCEEDED' | 'FAILED'
      result?: (childId: string) => Buffer
      bank?: Buffer
    } = {}
  ) {
    let childId = ''
    const startSlotRevision = vi.fn(
      async (
        payload: { build_id: string },
        _scope: string,
        before: () => Promise<void>
      ) => {
        childId = payload.build_id
        await before()
        return { eventId: `event-${payload.build_id}` }
      }
    )
    return {
      startSlotRevision,
      runtime: {
        questionInputContainer: 'question-inputs',
        questionOutputContainer: 'question-results',
        questionOutputPrefix: 'element-results',
        startSlotRevision,
        findRunBySlotRevision: vi.fn(async () => null),
        getRun: vi.fn(async () => ({
          runId: 'run-1',
          status: options.runStatus ?? 'SUCCEEDED',
        })),
        getRunById: vi.fn(async () => ({
          runId: 'run-1',
          status: options.runStatus ?? 'SUCCEEDED',
        })),
        downloadImmutable: vi.fn(async (_container: string, blob: string) => ({
          ref: {
            containerName: 'question-results',
            blobName: blob,
            sha256: 'a'.repeat(64),
          },
          bytes: (options.result ?? ((id: string) => resultBytes(id)))(childId),
        })),
        downloadVerified: vi.fn(async (artifact: { blobName: string }) =>
          artifact.blobName.endsWith('final.json')
            ? (options.bank ?? bankBytes())
            : graphManifestBytes()
        ),
      },
    }
  }

  async function setup(graph: 'purged' | 'available') {
    vi.stubEnv('NODE_ENV', 'test')
    for (const [key, value] of Object.entries(costEnv)) vi.stubEnv(key, value)
    vi.stubEnv('ELEMENT_REVISION_WORKER_ENABLED', 'true')
    ownerId = randomUUID()
    graphKbId = randomUUID()
    graphBuildId = randomUUID()
    parentId = randomUUID()
    await prisma.user.create({
      data: {
        id: ownerId,
        email: `${ownerId}@example.org`,
        shortname: `revchild-${ownerId.slice(0, 8)}`,
      },
    })
    await prisma.kB.create({
      data: { id: graphKbId, ownerId, name: 'Revision child test KB' },
    })
    await prisma.kBGraphBuild.create({
      data: {
        id: graphBuildId,
        kbId: graphKbId,
        requestedById: ownerId,
        sourceContentDigest: 'a'.repeat(64),
        graphName: `klickeruzh:kb:${graphKbId}:${graphBuildId}`,
        graphBundleStorageName: 'synthetic-storage',
        graphBundleSha256: bundleSha,
        graphSha256: graphSha,
        graphManifestArtifact: {
          containerName: 'graph-artifacts',
          blobName: 'bundle/manifest.json',
          sha256: 'f'.repeat(64),
        },
        ...(graph === 'purged'
          ? { generationArtifactsPurgedAt: new Date() }
          : {}),
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
        designSummary: {
          title: 'Synthetic design',
          questionCount: 3,
          objectives: [],
          modules: [{ moduleId: 'M1', moduleName: 'Module', questionCount: 3 }],
          sources: [],
          warnings: [],
          slots: [slot],
        } as never,
        planSummary: {
          questionCount: 3,
          questions: [plannedQuestion],
          warnings: [],
        } as never,
      },
    })
    const draft = await createDraft({ sourceElementId: 'slot-1' })
    draftId = draft.id
    const { runtime, startSlotRevision } = fakeRuntime()
    return { draft, runtime, startSlotRevision }
  }

  async function request(runtime: object) {
    const context = {
      ...ctx(),
      elementGenerationRuntime: runtime,
    } as unknown as ContextWithUser
    await setGeneratedQuestionDecision(
      {
        draftId,
        decision: 'REVISION_REQUESTED',
        note: 'Make it harder',
      },
      context
    )
    return context
  }

  async function withRuntime(
    graph: 'purged' | 'available',
    options: Parameters<typeof fakeRuntime>[0] = {}
  ) {
    const fixture = await setup(graph)
    const fake = fakeRuntime(options)
    const context = await request(fake.runtime)
    return { ...fixture, ...fake, context }
  }

  afterEach(async () => {
    vi.unstubAllEnvs()
    await prisma.user.delete({ where: { id: ownerId } })
  })

  it('sends the slot revision without graph references once the graph is purged', async () => {
    const { context, startSlotRevision } = await withRuntime('purged')

    await getQuestionGenerationBuild(parentId, context)

    expect(startSlotRevision).toHaveBeenCalledTimes(1)
    const payload = startSlotRevision.mock.calls[0]![0] as Record<
      string,
      unknown
    >
    expect(payload).toMatchObject({
      schema_version: 1,
      parent_build_id: parentId,
      element_type: 'question',
      question_id: 'slot-1',
      language: 'en',
      note: 'Make it harder',
      previous_element: expect.objectContaining({ name: editable.name }),
      slot_summary: expect.objectContaining({ sourceQuestionId: 'slot-1' }),
    })
    for (const key of [
      'graph_manifest',
      'resolved_domain_policy',
      'generation_recipe',
      'domain_policy_digest',
      'generation_recipe_digest',
    ]) {
      expect(payload).not.toHaveProperty(key)
    }
  })

  it('sends graph references and digests while the graph exists', async () => {
    const { context, startSlotRevision } = await withRuntime('available')

    await getQuestionGenerationBuild(parentId, context)

    expect(startSlotRevision.mock.calls[0]![0]).toMatchObject({
      graph_manifest: { blob_name: 'bundle/manifest.json' },
      resolved_domain_policy: { blob_name: 'bundle/policy.json' },
      generation_recipe: { blob_name: 'bundle/recipe.json' },
      domain_policy_digest: digest,
      generation_recipe_digest: digest,
    })
  })

  it('adds the revised draft to the parent review once, without failing the parent', async () => {
    const { context, draft } = await withRuntime('purged')

    await getQuestionGenerationBuild(parentId, context)
    await getQuestionGenerationBuild(parentId, context)
    await getQuestionGenerationBuild(parentId, context)

    const drafts = await prisma.generatedElementDraft.findMany({
      where: { buildId: parentId },
      orderBy: { duplicationIndex: 'asc' },
    })
    expect(drafts).toHaveLength(2)
    expect(drafts[1]).toMatchObject({
      sourceElementId: 'slot-1',
      duplicationIndex: 1,
      parentDraftId: draft.id,
      revisionOfDraftId: draft.id,
      targetDifficulty: 2,
      decision: DB.GeneratedElementDecision.OPEN,
    })
    const [child] = await prisma.elementGenerationBuild.findMany({
      where: { parentBuildId: parentId },
    })
    expect(child!.status).toBe(DB.ElementGenerationBuildStatus.COMPLETED)
    const parent = await prisma.elementGenerationBuild.findUniqueOrThrow({
      where: { id: parentId },
    })
    expect(parent.status).toBe(DB.ElementGenerationBuildStatus.COMPLETED)
  })

  it('keeps a failed run on the child build', async () => {
    const { context } = await withRuntime('purged', { runStatus: 'FAILED' })

    await getQuestionGenerationBuild(parentId, context)
    // The first poll dispatches the child; the second reads its result.
    await getQuestionGenerationBuild(parentId, context)

    const [child] = await prisma.elementGenerationBuild.findMany({
      where: { parentBuildId: parentId },
    })
    expect(child!.status).toBe(DB.ElementGenerationBuildStatus.FAILED)
    const parent = await prisma.elementGenerationBuild.findUniqueOrThrow({
      where: { id: parentId },
    })
    expect(parent.status).toBe(DB.ElementGenerationBuildStatus.COMPLETED)
    expect(
      await prisma.generatedElementDraft.count({ where: { buildId: parentId } })
    ).toBe(1)
  })

  it('rejects a revised question without a target difficulty', async () => {
    const { context } = await withRuntime('purged', {
      bank: bankBytes(false),
    })

    await getQuestionGenerationBuild(parentId, context)
    // The first poll dispatches the child; the second reads its result.
    await getQuestionGenerationBuild(parentId, context)

    const [child] = await prisma.elementGenerationBuild.findMany({
      where: { parentBuildId: parentId },
    })
    expect(child!.status).toBe(DB.ElementGenerationBuildStatus.FAILED)
    expect(child!.errorCode).toBe('ARTIFACT_INVALID')
    expect(
      await prisma.generatedElementDraft.count({ where: { buildId: parentId } })
    ).toBe(1)
  })

  it('accepts a v1 result only while the graph is purged', async () => {
    const { context } = await withRuntime('available')

    await getQuestionGenerationBuild(parentId, context)
    // The first poll dispatches the child; the second reads its result.
    await getQuestionGenerationBuild(parentId, context)

    const [child] = await prisma.elementGenerationBuild.findMany({
      where: { parentBuildId: parentId },
    })
    expect(child!.status).toBe(DB.ElementGenerationBuildStatus.FAILED)
    expect(child!.errorCode).toBe('ARTIFACT_INVALID')
  })
})

describe('slot-specification request switch', () => {
  const input = {
    buildId: randomUUID(),
    graphVersionId: randomUUID(),
    graphManifest: {
      containerName: 'graph-artifacts',
      blobName: 'bundle/manifest.json',
      sha256: 'f'.repeat(64),
    },
    storageName: 'synthetic-storage',
    blueprint: {
      containerName: 'question-inputs',
      blobName: 'blueprint.json',
      sha256: 'a'.repeat(64),
    },
    output: {
      containerName: 'question-results',
      blobPrefix: 'element-results',
    },
    language: 'en' as const,
  }

  afterEach(() => vi.unstubAllEnvs())

  it('leaves the start input and its manifest hash untouched while off', () => {
    vi.stubEnv('ELEMENT_REVISION_WORKER_ENABLED', '')
    const off = questionWorkflowStartPayload(input)
    expect(off).not.toHaveProperty('emit_slot_specifications')
    expect(questionWorkflowStartManifestSha256(off)).toBe(
      questionWorkflowStartManifestSha256(
        questionWorkflowStartPayload(input, { emitSlotSpecifications: false })
      )
    )

    vi.stubEnv('ELEMENT_REVISION_WORKER_ENABLED', 'true')
    expect(questionWorkflowStartPayload(input)).toMatchObject({
      emit_slot_specifications: true,
    })
  })
})
