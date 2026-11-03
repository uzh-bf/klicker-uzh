import { createHash, randomUUID } from 'node:crypto'
import { prisma, requireDisposableDatabase } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  GeneratedFlashcard,
  GeneratedQuestionWithProvenance,
  QuestionGenerationArtifactRef,
  QuestionGenerationItemType,
} from '@klicker-uzh/types'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { completeElementGeneration } from '../src/services/elementGenerationCompletion.js'
import { acquireElementGenerationLease } from '../src/services/elementGenerationLease.js'
import { getQuestionGenerationBuild } from '../src/services/questionGeneration.js'
import type { QuestionGenerationRuntime } from '../src/services/questionGenerationRuntime.js'

const NOW = new Date('2026-09-05T10:00:00Z')
const artifact: QuestionGenerationArtifactRef = {
  containerName: 'synthetic',
  blobName: 'completion/result.json',
  sha256: 'a'.repeat(64),
}
const card: GeneratedFlashcard = {
  sourceFlashcardId: 'card-1',
  name: ' Synthetic card ',
  front: ' Front ',
  back: ' Back ',
  cardType: 'definition',
  tags: ['topic', 'topic'],
}
function question(
  itemType: QuestionGenerationItemType = 'SC'
): GeneratedQuestionWithProvenance {
  return {
    sourceQuestionId: 'question-1',
    suggestedTags: ['synthetic-topic'],
    itemType,
    name: 'Synthetic question',
    stem: 'Choose the correct answer',
    context: null,
    explanation: 'Explanation',
    tags: ['synthetic-question'],
    choices: Array.from(
      { length: itemType === 'MC' ? 5 : itemType === 'KPRIM' ? 4 : 2 },
      (_, index) => ({
        id: `choice-${index}`,
        label: String(index),
        text: `Answer ${index}`,
        correct: index === 0,
        feedback: null,
      })
    ),
    bloomLevel: 'remember',
    targetDifficulty: 1,
    predictedDifficulty: 1.5,
    qualityFlags: ['synthetic-review'],
    citations: [
      {
        resourceId: 'synthetic-resource',
        sourceFile: 'synthetic.md',
        pageFrom: 1,
        pageTo: 2,
        chunkIds: ['chunk-1'],
      },
    ],
    provenance: {
      schemaVersion: 1,
      lineageStatus: 'complete',
      graphVersionId: 'synthetic-graph',
      bundleSha256: 'b'.repeat(64),
      graphSha256: 'c'.repeat(64),
      domainPolicyDigest: null,
      generationRecipeDigest: null,
      nodeIds: ['node-1'],
      relationshipIds: [],
      sourceCitations: [],
      assertionCitations: [],
    },
  }
}
type Variant = 'question' | 'flashcard'
const variants: Variant[] = ['question', 'flashcard']
const flashStates = [
  DB.ElementGenerationBuildStatus.QUEUED,
  DB.ElementGenerationBuildStatus.RUNNING,
  DB.ElementGenerationBuildStatus.PUBLISHING_INCOMPLETE,
]
const flashResults = [
  'completed',
  'completed_with_review',
  'incomplete',
] as const
let ownerId: string
let graphBuildId: string

function context(client = prisma) {
  return { prisma: client } as unknown as ContextWithUser
}
function complete(
  variant: Variant,
  buildId: string,
  leaseOwner: string,
  ctx = context()
) {
  return variant === 'question'
    ? completeElementGeneration(
        {
          kind: 'questions',
          buildId,
          leaseOwner,
          questions: [{ ...question(), provenance: null }],
          resultStatus: 'completed',
          resultManifestArtifact: artifact,
          finalBankArtifact: artifact,
          questionProvenanceIndexArtifact: null,
        },
        ctx
      )
    : completeElementGeneration(
        {
          kind: 'flashcards',
          buildId,
          leaseOwner,
          cards: [card],
          resultStatus: 'completed',
          unresolvedElementCount: 0,
          warningCount: 0,
          resultManifestArtifact: artifact,
          finalBankArtifact: artifact,
          checkpointArtifact: null,
        },
        ctx
      )
}
function leaseError(variant: Variant) {
  return {
    message:
      variant === 'question'
        ? 'Question-generation build completion lost its lease'
        : 'Flashcard build completion lost its lease',
    code: 'CONCURRENT_MODIFICATION',
  }
}
async function createBuild(
  variant: Variant,
  data: Partial<DB.Prisma.ElementGenerationBuildUncheckedCreateInput> = {}
) {
  return prisma.elementGenerationBuild.create({
    data: {
      id: randomUUID(),
      ownerId,
      sourceGraphBuildId: graphBuildId,
      elementType:
        variant === 'question' ? DB.ElementType.SC : DB.ElementType.FLASHCARD,
      configuration: {} as never,
      configurationHash: 'synthetic-completion',
      idempotencyKey: randomUUID(),
      requestedElementCount: 1,
      status:
        variant === 'question'
          ? DB.ElementGenerationBuildStatus.FINALIZING
          : DB.ElementGenerationBuildStatus.RUNNING,
      syncLeaseOwner: randomUUID(),
      syncLeaseUntil: NOW,
      ...data,
    },
  })
}
async function snapshot(buildId: string) {
  return {
    build: await prisma.elementGenerationBuild.findUniqueOrThrow({
      where: { id: buildId },
    }),
    drafts: await prisma.generatedElementDraft.findMany({
      where: { buildId },
      orderBy: { id: 'asc' },
    }),
    spends: await prisma.elementGenerationSpend.findMany({
      where: { buildId },
      orderBy: { id: 'asc' },
    }),
    quotas: await prisma.kBGraphQuota.findMany({
      where: { ownerId },
      orderBy: { id: 'asc' },
    }),
  }
}
async function existingDraft(
  buildId: string,
  variant: Variant,
  duplicationIndex = 0
) {
  const { provenance, ...original } = question()
  return prisma.generatedElementDraft.create({
    data: {
      buildId,
      sourceElementId: variant === 'question' ? 'question-1' : 'card-1',
      order: 0,
      duplicationIndex,
      elementType:
        variant === 'question' ? DB.ElementType.SC : DB.ElementType.FLASHCARD,
      original: variant === 'question' ? original : card,
      current:
        variant === 'question'
          ? { ...original, name: 'Previously edited' }
          : { ...card, name: 'Previously edited' },
      citations: [],
      provenance: provenance ?? DB.Prisma.DbNull,
      revision: 3,
    },
  })
}
function signal() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Completion barrier timed out')),
          3000
        )
      }),
    ])
  } finally {
    clearTimeout(timeout)
  }
}

describe('initial Element completion', () => {
  beforeEach(async () => {
    await requireDisposableDatabase(prisma)
    ownerId = randomUUID()
    const kbId = randomUUID()
    graphBuildId = randomUUID()
    await prisma.user.create({
      data: {
        id: ownerId,
        email: `${ownerId}@example.org`,
        shortname: `completion-${ownerId.slice(0, 8)}`,
      },
    })
    await prisma.kB.create({
      data: { id: kbId, ownerId, name: 'Synthetic completion KB' },
    })
    await prisma.kBGraphBuild.create({
      data: {
        id: graphBuildId,
        kbId,
        requestedById: ownerId,
        sourceContentDigest: 'a'.repeat(64),
        graphName: `synthetic:${graphBuildId}`,
      },
    })
  })
  afterEach(async () => {
    await requireDisposableDatabase(prisma)
    await prisma.user.delete({ where: { id: ownerId } })
  })
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it.each([
    'SC',
    'MC',
    'KPRIM',
  ] as const)('preserves %s content and provenance when completing a build', async (itemType) => {
    const build = await createBuild('question', { elementType: itemType })
    const generated = question(itemType)
    const {
      provenance,
      sourceQuestionId,
      bloomLevel,
      targetDifficulty,
      predictedDifficulty,
      qualityFlags,
      citations,
      suggestedTags,
      ...current
    } = generated
    const { provenance: _provenance, ...original } = generated
    await completeElementGeneration(
      {
        kind: 'questions',
        buildId: build.id,
        leaseOwner: build.syncLeaseOwner!,
        questions: [generated],
        resultStatus: 'completed',
        resultManifestArtifact: artifact,
        finalBankArtifact: artifact,
        questionProvenanceIndexArtifact: artifact,
      },
      context()
    )
    const after = await snapshot(build.id)
    expect(after.drafts).toHaveLength(1)
    expect(after.drafts[0]).toMatchObject({
      sourceElementId: sourceQuestionId,
      elementType: itemType,
      original,
      current,
      provenance,
      bloomLevel,
      targetDifficulty,
      predictedDifficulty,
      qualityFlags,
      citations,
      duplicationIndex: 0,
      revision: 0,
      decision: 'OPEN',
      savedElementId: null,
    })
    expect(after.build).toMatchObject({
      status: 'COMPLETED',
      stage: 'completed',
      generatedElementCount: 1,
      resultManifestArtifact: artifact,
      finalBankArtifact: artifact,
      provenanceIndexArtifact: artifact,
      completedAt: expect.any(Date),
      lastSynchronizedAt: expect.any(Date),
    })
    expect(after.spends).toEqual([])
    expect(after.drafts[0]?.original).toMatchObject({ suggestedTags })
    expect(after.drafts[0]?.current).not.toHaveProperty('suggestedTags')
    expect(await prisma.element.count({ where: { ownerId } })).toBe(0)
  })

  it('settles a partial question build as incomplete and persists its attention cards', async () => {
    const build = await createBuild('question', { requestedElementCount: 2 })
    await completeElementGeneration(
      {
        kind: 'questions',
        buildId: build.id,
        leaseOwner: build.syncLeaseOwner!,
        questions: [{ ...question(), provenance: null }],
        resultStatus: 'incomplete',
        unresolvedElementCount: 1,
        slotFailures: [
          {
            slotId: 'q02',
            moduleId: 'M1',
            objective: 'Explain malolactic fermentation.',
            objectiveSource: 'provided',
            requestedLevel: 'remember',
            evidenceTarget: 'wine-chemistry.pdf#page=3',
            reasonCode: 'NO_SUPPORTING_DOCUMENTS',
            failureClass: 'user_input',
            detail: null,
            suggestions: ['Malolactic fermentation'],
          },
        ],
        resultManifestArtifact: artifact,
        finalBankArtifact: artifact,
        questionProvenanceIndexArtifact: null,
      },
      context()
    )
    const after = await snapshot(build.id)
    expect(after.build).toMatchObject({
      status: 'INCOMPLETE',
      stage: 'incomplete',
      generatedElementCount: 1,
      unresolvedElementCount: 1,
      planSummary: {
        slotFailures: [
          expect.objectContaining({
            slotId: 'q02',
            reasonCode: 'NO_SUPPORTING_DOCUMENTS',
            failureClass: 'user_input',
          }),
        ],
      },
    })
    // The passing question is delivered for review; nothing is published.
    expect(after.drafts).toHaveLength(1)
    expect(after.drafts[0]).toMatchObject({ decision: 'OPEN' })
    expect(await prisma.element.count({ where: { ownerId } })).toBe(0)
  })

  it.each([
    false,
    true,
  ])('validates a provenance-bound partial result before SQL completion (invalid partition: %s)', async (invalidPartition) => {
    const build = await createBuild('question', {
      requestedElementCount: 2,
      costAccountingVersion: 1,
      configuration: {
        itemType: 'SC',
        language: 'en',
        questionCount: 2,
        difficultyPreset: 'D1',
        difficultyCounts: { d1: 2, d2: 0, d3: 0, d4: 0, d5: 0 },
        sourceScopes: [],
        objectives: [],
        bloomLevels: ['remember'],
        focusTopic: null,
      },
      planSummary: {
        questionCount: 2,
        questions: ['question-1', 'question-2'].map((sourceQuestionId) => ({
          sourceQuestionId,
          moduleId: 'M1',
          objectiveId: null,
          stem: 'Synthetic plan',
          bloomLevel: 'remember',
          targetDifficulty: 1,
          sources: [],
        })),
        warnings: [],
      },
      designSummary: {
        title: 'Synthetic design',
        questionCount: 2,
        objectives: [],
        modules: [
          { moduleId: 'M1', moduleName: 'Synthetic module', questionCount: 2 },
        ],
        sources: [],
        slots: ['slot-A', 'slot-B'].map((sourceQuestionId) => ({
          sourceQuestionId,
          moduleId: 'M1',
          objectiveId: null,
          bloomLevel: 'remember',
          targetDifficulty: 1,
          evidenceEntityIds: [],
        })),
        warnings: [],
      },
    })
    await prisma.user.update({
      where: { id: ownerId },
      data: { aiFeaturesEnabled: true, betaEnabled: true },
    })
    const stored = new Map<
      string,
      { ref: QuestionGenerationArtifactRef; bytes: Buffer }
    >()
    const put = (blobName: string, value: unknown) => {
      const bytes =
        typeof value === 'string'
          ? Buffer.from(value)
          : Buffer.from(JSON.stringify(value))
      const ref = {
        containerName: 'synthetic',
        blobName,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      }
      stored.set(blobName, { ref, bytes })
      return ref
    }
    const wireRef = (ref: QuestionGenerationArtifactRef) => ({
      container_name: ref.containerName,
      blob_name: ref.blobName,
      sha256: ref.sha256,
    })
    const nodeId = `node_${'a'.repeat(32)}`
    const graph = put(
      'graph_chunk_entity_relation.graphml',
      `<graphml xmlns="http://graphml.graphdrawing.org/xmlns"><key id="node-id" for="node" attr.name="kg_node_id" attr.type="string"/><graph edgedefault="undirected"><node id="physical"><data key="node-id">${nodeId}</data></node></graph></graphml>`
    )
    const chunks = put('vdb_chunks.json', {
      data: [{ __id__: 'chunk-1' }],
      matrix: '',
    })
    const policy = put('resolved_domain_policy.json', {})
    const recipe = put('generation_recipe.json', {})
    const graphArtifact = (
      ref: QuestionGenerationArtifactRef,
      contentType: string
    ) => ({
      ...wireRef(ref),
      filename: ref.blobName,
      size_bytes: stored.get(ref.blobName)!.bytes.length,
      content_type: contentType,
    })
    const manifest = put('manifest.json', {
      schema_version: 2,
      course_id: graphBuildId,
      storage_name: graphBuildId,
      falkordb_graph_name: `synthetic:${graphBuildId}`,
      bundle_sha256: 'b'.repeat(64),
      graph_sha256: graph.sha256,
      domain_policy_digest: policy.sha256,
      generation_recipe_digest: recipe.sha256,
      artifacts: [
        graphArtifact(graph, 'application/graphml+xml'),
        graphArtifact(chunks, 'application/json'),
        graphArtifact(policy, 'application/json'),
        graphArtifact(recipe, 'application/json'),
      ],
      policy: graphArtifact(policy, 'application/json'),
      recipe: graphArtifact(recipe, 'application/json'),
      parent_bundle_sha256: null,
      correction_set: null,
      instructor_assertions: [],
    })
    await prisma.kBGraphBuild.update({
      where: { id: graphBuildId },
      data: {
        graphManifestArtifact: manifest,
        graphBundleSha256: 'b'.repeat(64),
        graphSha256: graph.sha256,
        graphManifestSchemaVersion: 2,
        graphBundleStorageName: graphBuildId,
      },
    })
    const bank = put(`question-builds/${build.id}/questions/final.json`, {
      metadata: { format: 'SC', item_format: 'sc', total_questions: 1 },
      questions: [
        {
          id: 'question-1',
          design_slot_id: invalidPartition ? 'slot-B' : 'slot-A',
          stem: 'Synthetic prompt',
          bloom_level: 'remember',
          origin_mode: 'new',
          item_format: 'single_choice',
          difficulty_scale: 1,
          difficulty_status: 'llm_reviewed',
          options: [
            { label: 'A', text: 'First', is_correct: true },
            { label: 'B', text: 'Second', is_correct: false },
          ],
          correct_label: 'A',
          citations: [],
          provenance: {
            schema_version: 1,
            lineage_status: 'complete',
            graph_version_id: graphBuildId,
            bundle_sha256: 'b'.repeat(64),
            graph_sha256: graph.sha256,
            domain_policy_digest: policy.sha256,
            generation_recipe_digest: recipe.sha256,
            node_ids: [nodeId],
            relationship_ids: [],
            source_citations: [
              {
                element_type: 'node',
                element_id: nodeId,
                chunk_ids: ['chunk-1'],
                source_pages: [],
                lecture_markers: [],
              },
            ],
            assertion_citations: [],
          },
        },
      ],
    })
    const index = put(
      `question-builds/${build.id}/questions/question_provenance_index.json`,
      {
        schema_version: 1,
        question_ids: ['question-1'],
        by_node_id: { [nodeId]: ['question-1'] },
        by_relationship_id: {},
        by_assertion_id: {},
        by_source_ref: { 'chunk:chunk-1': ['question-1'] },
      }
    )
    put(`question-builds/${build.id}/result.json`, {
      schema_version: 2,
      question_build_id: build.id,
      status: 'completed_partial',
      generation_policy: 'new_only',
      requested_questions: 2,
      generated_questions: 1,
      final_questions: wireRef(bank),
      question_provenance_index: wireRef(index),
      review_required_questions: 0,
      review_required_question_ids: [],
      rejected_at: null,
      reviewed_by: null,
      slot_failures: [
        {
          slot_id: 'slot-B',
          module_id: 'M1',
          objective: 'Synthetic missing objective',
          objective_source: 'provided',
          requested_level: 'remember',
          evidence_target: null,
          reason_code: 'NO_SUPPORTING_DOCUMENTS',
          failure_class: 'user_input',
          detail: null,
          suggestions: [],
        },
      ],
    })
    const verify = (ref: QuestionGenerationArtifactRef) => {
      const entry = stored.get(ref.blobName)
      expect(entry?.ref).toEqual(ref)
      if (!entry) throw new Error('Unexpected synthetic artifact')
      return entry.bytes
    }
    const unused = vi.fn(async () => {
      throw new Error('Unexpected provider operation')
    })
    const runtime: QuestionGenerationRuntime = {
      questionInputContainer: 'synthetic',
      questionOutputContainer: 'synthetic',
      questionOutputPrefix: 'question-builds',
      downloadImmutable: vi.fn(async (containerName, blobName) => {
        const entry = stored.get(blobName)!
        expect(entry.ref.containerName).toBe(containerName)
        return entry
      }),
      downloadVerified: vi.fn(async (ref) => verify(ref)),
      downloadVerifiedStream: vi.fn(async function* (ref) {
        yield verify(ref)
      }),
      uploadCreateOnly: unused,
      start: unused,
      review: unused,
      getRun: unused,
      getRunById: unused,
      findRunByBuildId: unused,
      findRunByQuestionReview: unused,
    }
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    let result: Awaited<ReturnType<typeof getQuestionGenerationBuild>>
    try {
      result = await getQuestionGenerationBuild(build.id, {
        ...context(),
        user: { sub: ownerId },
        elementGenerationRuntime: runtime,
        featureFlags: { getAiBetaDecision: () => 'enabled' },
      } as unknown as ContextWithUser)
    } finally {
      errorLog.mockRestore()
    }
    const after = await snapshot(build.id)
    expect(result.status).toBe(invalidPartition ? 'FAILED' : 'INCOMPLETE')
    expect(after.build.syncLeaseOwner).toBeNull()
    expect(after.drafts).toHaveLength(invalidPartition ? 0 : 1)
    if (invalidPartition) {
      expect(after.build.errorCode).toBe('ARTIFACT_INVALID')
    } else {
      expect(after.build).toMatchObject({
        generatedElementCount: 1,
        unresolvedElementCount: 1,
        provenanceIndexArtifact: index,
      })
      expect(after.build.planSummary).toMatchObject({
        slotFailures: [
          expect.objectContaining({
            slotId: 'slot-B',
            reasonCode: 'NO_SUPPORTING_DOCUMENTS',
          }),
        ],
      })
      expect(after.drafts[0]).toMatchObject({
        sourceElementId: 'question-1',
        decision: 'OPEN',
        savedElementId: null,
        provenance: {
          lineageStatus: 'complete',
          graphVersionId: graphBuildId,
          nodeIds: [nodeId],
        },
      })
      expect(runtime.downloadVerifiedStream).toHaveBeenCalledTimes(2)
      expect(runtime.downloadVerified).toHaveBeenCalledWith(index)
    }
    expect(unused).not.toHaveBeenCalled()
    expect(await prisma.element.count({ where: { ownerId } })).toBe(0)
  })

  it('keeps a strict question build free of attention cards', async () => {
    const build = await createBuild('question')
    await completeElementGeneration(
      {
        kind: 'questions',
        buildId: build.id,
        leaseOwner: build.syncLeaseOwner!,
        questions: [{ ...question(), provenance: null }],
        resultStatus: 'completed',
        unresolvedElementCount: 0,
        slotFailures: [],
        resultManifestArtifact: artifact,
        finalBankArtifact: artifact,
        questionProvenanceIndexArtifact: null,
      },
      context()
    )
    const after = await snapshot(build.id)
    expect(after.build).toMatchObject({
      status: 'COMPLETED',
      stage: 'completed',
      unresolvedElementCount: 0,
    })
    expect(after.build.planSummary).toBeNull()
  })

  it('rolls back a partial publication that lost its lease without attention cards', async () => {
    const build = await createBuild('question', { requestedElementCount: 2 })
    const before = await snapshot(build.id)
    await expect(
      completeElementGeneration(
        {
          kind: 'questions',
          buildId: build.id,
          leaseOwner: randomUUID(),
          questions: [{ ...question(), provenance: null }],
          resultStatus: 'incomplete',
          unresolvedElementCount: 1,
          slotFailures: [
            {
              slotId: 'q02',
              moduleId: 'M1',
              objective: 'Explain malolactic fermentation.',
              objectiveSource: 'provided',
              requestedLevel: 'remember',
              evidenceTarget: 'wine-chemistry.pdf#page=3',
              reasonCode: 'NO_SUPPORTING_DOCUMENTS',
              failureClass: 'user_input',
              detail: null,
              suggestions: ['Malolactic fermentation'],
            },
          ],
          resultManifestArtifact: artifact,
          finalBankArtifact: artifact,
          questionProvenanceIndexArtifact: null,
        },
        context()
      )
    ).rejects.toMatchObject(leaseError('question'))
    // A failed publication leaves neither drafts nor persisted attention cards.
    expect(await snapshot(build.id)).toEqual(before)
  })

  it.each(
    flashStates.flatMap((status) =>
      flashResults.map((resultStatus) => ({ status, resultStatus }))
    )
  )('accepts flashcard $status with $resultStatus', async ({
    status,
    resultStatus,
  }) => {
    const build = await createBuild('flashcard', { status })
    await completeElementGeneration(
      {
        kind: 'flashcards',
        buildId: build.id,
        leaseOwner: build.syncLeaseOwner!,
        cards: [card],
        resultStatus,
        unresolvedElementCount: 2,
        warningCount: 3,
        resultManifestArtifact: artifact,
        finalBankArtifact: artifact,
        checkpointArtifact: artifact,
      },
      context()
    )
    const after = await snapshot(build.id)
    expect(after.build).toMatchObject({
      status: resultStatus === 'incomplete' ? 'INCOMPLETE' : 'COMPLETED',
      stage: resultStatus === 'incomplete' ? 'incomplete' : 'completed',
      generatedElementCount: 1,
      unresolvedElementCount: 2,
      warningCount: 3,
      resultManifestArtifact: artifact,
      finalBankArtifact: artifact,
      checkpointArtifact: artifact,
      completedAt: expect.any(Date),
      lastSynchronizedAt: expect.any(Date),
    })
    expect(after.drafts).toHaveLength(1)
    expect(after.drafts[0]).toMatchObject({
      elementType: 'FLASHCARD',
      original: card,
      current: {
        name: 'Synthetic card',
        front: 'Front',
        back: 'Back',
        cardType: 'definition',
        tags: ['generated-flashcard', 'flashcard:definition', 'topic'],
      },
      citations: [],
      provenance: null,
      duplicationIndex: 0,
      revision: 0,
      qualityFlags: [],
      bloomLevel: null,
      targetDifficulty: null,
      predictedDifficulty: null,
      savedElementId: null,
    })
  })

  it.each(
    variants.flatMap((variant) =>
      ['lease', 'state', 'type'].map((invalid) => ({ variant, invalid }))
    )
  )('rejects $variant completion with invalid $invalid without writes', async ({
    variant,
    invalid,
  }) => {
    const build = await createBuild(variant, {
      ...(invalid === 'state'
        ? { status: DB.ElementGenerationBuildStatus.FAILED }
        : {}),
      ...(invalid === 'type'
        ? {
            elementType:
              variant === 'question'
                ? DB.ElementType.FLASHCARD
                : DB.ElementType.SC,
          }
        : {}),
    })
    const before = await snapshot(build.id)
    await expect(
      complete(
        variant,
        build.id,
        invalid === 'lease' ? randomUUID() : build.syncLeaseOwner!
      )
    ).rejects.toMatchObject(leaseError(variant))
    expect(await snapshot(build.id)).toEqual(before)
  })

  it('rejects a mismatched question item type before inserting drafts', async () => {
    const build = await createBuild('question', {
      elementType: DB.ElementType.MC,
    })
    const before = await snapshot(build.id)
    await expect(
      complete('question', build.id, build.syncLeaseOwner!)
    ).rejects.toMatchObject({
      message:
        'Generated question types do not match the requested element type',
      code: 'DRAFT_INVALID',
    })
    expect(await snapshot(build.id)).toEqual(before)
  })

  it.each(
    variants
  )('preserves a matching existing %s draft on re-entry', async (variant) => {
    const build = await createBuild(variant, {
      provenanceIndexArtifact: artifact,
      checkpointArtifact: artifact,
    })
    const draft = await existingDraft(build.id, variant)
    await complete(variant, build.id, build.syncLeaseOwner!)
    const after = await snapshot(build.id)
    expect(after.drafts).toEqual([draft])
    expect(after.build.status).toBe(DB.ElementGenerationBuildStatus.COMPLETED)
    expect(
      variant === 'question'
        ? after.build.provenanceIndexArtifact
        : after.build.checkpointArtifact
    ).toBeNull()
  })

  it.each(
    variants
  )('preserves the %s duplicate-counting rule and rolls back invalid cardinality', async (variant) => {
    const build = await createBuild(variant)
    const draft = await existingDraft(build.id, variant, 1)
    const before = await snapshot(build.id)
    if (variant === 'question') {
      await complete(variant, build.id, build.syncLeaseOwner!)
      const after = await snapshot(build.id)
      expect(after.drafts).toHaveLength(2)
      expect(after.drafts).toContainEqual(draft)
      expect(
        after.drafts.find((row) => row.duplicationIndex === 0)?.provenance
      ).toBeNull()
      expect(after.build.generatedElementCount).toBe(1)
    } else {
      await expect(
        complete(variant, build.id, build.syncLeaseOwner!)
      ).rejects.toMatchObject({
        message: 'Generated flashcard count does not match the bank',
        code: 'DRAFT_INVALID',
      })
      expect(await snapshot(build.id)).toEqual(before)
    }
  })

  it('rolls back newly inserted questions when original-draft cardinality is wrong', async () => {
    const build = await createBuild('question')
    const existing = await existingDraft(build.id, 'question')
    await prisma.generatedElementDraft.update({
      where: { id: existing.id },
      data: { sourceElementId: 'different-original' },
    })
    const before = await snapshot(build.id)
    await expect(
      complete('question', build.id, build.syncLeaseOwner!)
    ).rejects.toMatchObject({
      message: 'Generated draft count does not match the final bank',
      code: 'DRAFT_INVALID',
    })
    expect(await snapshot(build.id)).toEqual(before)
  })

  it.each(
    variants
  )('rolls back %s drafts after a real post-read lease takeover', async (variant) => {
    const build = await createBuild(variant)
    const quota = await prisma.kBGraphQuota.create({
      data: {
        ownerId,
        semesterKey: 'synthetic-completion',
        currency: 'CHF',
        limitMinorUnits: 100,
        reservedMinorUnits: 20,
      },
    })
    await prisma.elementGenerationSpend.create({
      data: {
        buildId: build.id,
        quotaId: quota.id,
        dispatchAttemptId: randomUUID(),
        spendClass:
          variant === 'question'
            ? DB.KBGraphQuotaSpendClass.QUESTION_GENERATION
            : DB.KBGraphQuotaSpendClass.FLASHCARD_GENERATION,
        semesterKey: quota.semesterKey,
        estimatedCostMinorUnits: 20,
        costCurrency: 'CHF',
        costPricingVersion: 'synthetic',
        dispatchClaimedAt: NOW,
      },
    })
    const arrived = signal()
    const release = signal()
    let completionPid: number | undefined
    const queryClient = prisma.$extends({
      query: {
        elementGenerationBuild: {
          async findFirst({ args, query }) {
            const result = await query(args)
            if (args.where?.id === build.id) {
              arrived.resolve()
              await bounded(release.promise)
            }
            return result
          },
        },
      },
    })
    // Observe the real transaction connection; delegate its entire lifetime to Prisma.
    const client = queryClient.$extends({
      client: {
        async $transaction<T>(
          operation: (transaction: DB.Prisma.TransactionClient) => Promise<T>
        ) {
          return queryClient.$transaction(async (transaction) => {
            const rows = await transaction.$queryRaw<
              Array<{ pid: number }>
            >`SELECT pg_backend_pid() AS pid`
            completionPid = rows[0]!.pid
            return operation(
              transaction as unknown as DB.Prisma.TransactionClient
            )
          })
        },
      },
    })
    // Attach rejection handling immediately so a failed scheduling assertion cannot leak it.
    const pending = complete(
      variant,
      build.id,
      build.syncLeaseOwner!,
      context(client as unknown as DB.PrismaClient)
    ).then(
      () => null,
      (error: unknown) => error
    )
    try {
      await bounded(arrived.promise)
      const successor = await prisma.$transaction(async (transaction) => {
        const rows = await transaction.$queryRaw<
          Array<{ pid: number }>
        >`SELECT pg_backend_pid() AS pid`
        const token = await acquireElementGenerationLease(transaction, {
          buildId: build.id,
          ownerId,
          now: new Date(NOW.getTime() + 1),
        })
        return { pid: rows[0]!.pid, token }
      })
      expect(completionPid).toEqual(expect.any(Number))
      expect(successor.pid).not.toBe(completionPid)
      expect(successor.token).toEqual(expect.any(String))
      const winner = await snapshot(build.id)
      release.resolve()
      expect(await bounded(pending)).toMatchObject(leaseError(variant))
      expect(await snapshot(build.id)).toEqual(winner)
      expect(winner.drafts).toEqual([])
      expect(winner.build.syncLeaseOwner).toBe(successor.token)
      expect(await prisma.element.count({ where: { ownerId } })).toBe(0)
    } finally {
      release.resolve()
      await pending
    }
  })
})
