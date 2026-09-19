import * as DB from '@klicker-uzh/prisma/client'
import { getPrisma } from '../../global-setup.js'
import { USER_ID_TEST } from '../constants.js'

const FIXTURE_PREFIX = 'Synthetic question-generation review fixture'

const BUILD_ID = 'b0000000-0000-4000-8000-000000000001'
const ATTENTION_BUILD_ID = 'b0000000-0000-4000-8000-000000000002'
const GATE_BUILD_ID = 'b0000000-0000-4000-8000-000000000003'
const FAILURE_BUILD_ID = 'b0000000-0000-4000-8000-000000000004'
const PARTIAL_BUILD_ID = 'b0000000-0000-4000-8000-000000000005'
const LEGACY_FAILURE_BUILD_ID = 'b0000000-0000-4000-8000-000000000006'
const ZERO_PASSING_BUILD_ID = 'b0000000-0000-4000-8000-000000000007'
const FIXTURE_BUILD_IDS = [
  BUILD_ID,
  ATTENTION_BUILD_ID,
  GATE_BUILD_ID,
  FAILURE_BUILD_ID,
  PARTIAL_BUILD_ID,
  LEGACY_FAILURE_BUILD_ID,
  ZERO_PASSING_BUILD_ID,
]

const KB_ID = 'b0000000-0000-4000-8000-000000000010'
const GRAPH_BUILD_ID = 'b0000000-0000-4000-8000-000000000011'
const URL_RESOURCE_ID = 'b0000000-0000-4000-8000-000000000020'
const BLOB_RESOURCE_ID = 'b0000000-0000-4000-8000-000000000021'

export type QuestionGenerationReviewFixture = {
  primaryBuildId: string
  primaryDraftIds: string[]
  draftIdsByType: Record<'SC' | 'MC' | 'KPRIM' | 'FLASHCARD', string>
  // Synthetic owner tags that make the suggestion matching verifiable.
  tagIdByExistingName: Record<string, number>
  attentionBuildId: string
  attentionDraftIds: {
    mixedFlags: string
    unknownFlags: string
    noFlags: string
    acceptedUnsaved: string
  }
  gateBuildId: string
  // Failure-visibility surfaces. Each build is a settled question-generation
  // build whose per-slot attention cards were persisted on the build summary,
  // so the query serves them without a result manifest.
  failureBuildId: string
  partialBuildId: string
  partialDeliveredDraftId: string
  legacyFailureBuildId: string
  zeroPassingBuildId: string
}

// One structured reason per unsupported slot. The set covers every failure
// class the reviewing client renders plus one reason code this client does not
// know, so the class-level fallback rendering is exercised by real data.
type SlotFailureSeed = {
  slotId: string
  moduleId: string | null
  objective: string | null
  objectiveSource: 'provided' | 'neutral' | null
  requestedLevel: string | null
  evidenceTarget: string | null
  reasonCode: string
  failureClass: 'user_input' | 'self_repairable' | 'system'
  detail: string | null
  suggestions: string[]
}

function failureSlot(
  slotId: string,
  reasonCode: string,
  failureClass: SlotFailureSeed['failureClass'],
  overrides: Partial<SlotFailureSeed> = {}
): SlotFailureSeed {
  return {
    slotId,
    moduleId: 'MOD-01',
    objective: 'Explain the synthetic source evidence.',
    objectiveSource: 'provided',
    requestedLevel: 'apply',
    evidenceTarget: 'Synthetic evidence target',
    reasonCode,
    failureClass,
    detail: null,
    suggestions: [],
    ...overrides,
  }
}

// A plan summary that carries the attention cards. The persisted shape is the
// full QuestionGenerationPlanSummary plus the optional slotFailures list the
// build query serves, so the resolver's plan-summary view stays well formed.
function planSummaryWithFailures(
  questionCount: number,
  questions: Array<{
    sourceQuestionId: string
    moduleId: string
    objectiveId: string | null
    stem: string
    bloomLevel: string
    targetDifficulty: number
  }>,
  slotFailures: SlotFailureSeed[]
) {
  return {
    questionCount,
    questions: questions.map((question) => ({
      ...question,
      sources: [
        {
          resourceId: URL_RESOURCE_ID,
          sourceFile: `${URL_RESOURCE_ID}.md`,
          pageFrom: 7,
          pageTo: 7,
        },
      ],
    })),
    warnings: [],
    slotFailures,
  }
}

// One suggestion resolves to each seeded owner tag and one stays a proposal, so
// the review UI can be exercised for existing and new tags at the same time.
export const REVIEW_EXISTING_TAG_NAMES = [
  'QG-fixture portfolio diversification',
  'QG-fixture bond duration',
] as const
export const REVIEW_NEW_TAG_SUGGESTION = 'QG-fixture liquidity risk'
export const REVIEW_SUGGESTED_TAGS = [
  REVIEW_EXISTING_TAG_NAMES[0],
  REVIEW_NEW_TAG_SUGGESTION,
] as const

function suggestedTagsFor(type: 'SC' | 'MC' | 'KPRIM' | 'FLASHCARD') {
  return type === 'FLASHCARD' ? undefined : [...REVIEW_SUGGESTED_TAGS]
}

async function deleteFixtureTags() {
  const prisma = await getPrisma()
  await prisma.tag.deleteMany({
    where: {
      ownerId: USER_ID_TEST,
      name: { in: [...REVIEW_EXISTING_TAG_NAMES, REVIEW_NEW_TAG_SUGGESTION] },
    },
  })
}

function questionChoices(type: 'SC' | 'MC' | 'KPRIM', index: number) {
  const count = type === 'SC' ? 2 : type === 'MC' ? 5 : 4
  return Array.from({ length: count }, (_, choiceIndex) => ({
    id: `choice-${type}-${index}-${choiceIndex}`,
    label: String.fromCharCode(65 + choiceIndex),
    text: `Synthetic ${type} choice ${choiceIndex + 1}`,
    correct: type === 'MC' ? choiceIndex < 2 : choiceIndex === 0,
    feedback: null,
  }))
}

function draftValues(type: 'SC' | 'MC' | 'KPRIM' | 'FLASHCARD', index: number) {
  if (type === 'FLASHCARD') {
    return {
      original: {
        sourceFlashcardId: `source-flashcard-${index}`,
        name: `${FIXTURE_PREFIX} Flashcard ${index + 1}`,
        front: `Synthetic flashcard front ${index + 1}`,
        back: `Synthetic flashcard back ${index + 1}`,
        cardType: 'definition',
        tags: ['generated-flashcard', 'flashcard:definition'],
      },
      current: {
        name: `${FIXTURE_PREFIX} Flashcard ${index + 1}`,
        front: `Synthetic flashcard front ${index + 1}`,
        back: `Synthetic flashcard back ${index + 1}`,
        cardType: 'definition',
        tags: ['generated-flashcard', 'flashcard:definition'],
      },
    }
  }

  const choices = questionChoices(type, index)
  return {
    original: {
      itemType: type,
      name: `${FIXTURE_PREFIX} ${type} ${index + 1}`,
      stem: `Synthetic ${type} prompt ${index + 1}`,
      context: null,
      explanation: `Synthetic ${type} explanation ${index + 1}`,
      choices,
    },
    current: {
      itemType: type,
      name: `${FIXTURE_PREFIX} ${type} ${index + 1}`,
      stem: `Synthetic ${type} prompt ${index + 1}`,
      context: null,
      explanation: `Synthetic ${type} explanation ${index + 1}`,
      choices,
    },
  }
}

function attentionDraftId(index: number) {
  return `b0000000-0000-4000-8000-${String(200 + index).padStart(12, '0')}`
}

function failureDraftId(index: number) {
  return `b0000000-0000-4000-8000-${String(300 + index).padStart(12, '0')}`
}

function attentionDraft(index: number, qualityFlags: string[]) {
  const values = draftValues('SC', index)
  return {
    id: attentionDraftId(index),
    sourceElementId: `synthetic-attention-${index + 1}`,
    order: index,
    elementType: 'SC' as const,
    original: values.original,
    current: values.current,
    citations: [],
    bloomLevel: 'understand',
    targetDifficulty: 3,
    predictedDifficulty: 3.2,
    qualityFlags,
  }
}

function buildConfiguration() {
  return {
    itemType: 'SC',
    language: 'en',
    questionCount: 20,
    difficultyPreset: 'MIXED',
    difficultyCounts: { d1: 4, d2: 4, d3: 4, d4: 4, d5: 4 },
    sourceScopes: [
      { resourceId: URL_RESOURCE_ID, pageFrom: 7, pageTo: 7 },
      { resourceId: BLOB_RESOURCE_ID, pageFrom: 12, pageTo: 12 },
    ],
    objectives: [
      {
        id: 'OBJ-01',
        text: 'Explain the synthetic source evidence.',
        bloomLevel: 'understand',
      },
    ],
    bloomLevels: ['understand'],
  }
}

async function deleteFixtureRows() {
  const prisma = await getPrisma()
  const drafts = await prisma.generatedElementDraft.findMany({
    where: { buildId: { in: FIXTURE_BUILD_IDS } },
    select: { savedElementId: true },
  })
  const savedElementIds = drafts.flatMap((draft) =>
    draft.savedElementId === null ? [] : [draft.savedElementId]
  )

  if (savedElementIds.length > 0) {
    await prisma.element.deleteMany({ where: { id: { in: savedElementIds } } })
  }
  await prisma.elementGenerationBuild.deleteMany({
    where: { id: { in: FIXTURE_BUILD_IDS } },
  })
  await prisma.kBGraphBuild.deleteMany({ where: { id: GRAPH_BUILD_ID } })
  await prisma.kB.deleteMany({ where: { id: KB_ID } })
  await deleteFixtureTags()
}

export async function seedQuestionGenerationReviewFixture(): Promise<QuestionGenerationReviewFixture> {
  await deleteFixtureRows()
  const prisma = await getPrisma()
  const tagIdByExistingName: Record<string, number> = {}
  for (const name of REVIEW_EXISTING_TAG_NAMES) {
    const tag = await prisma.tag.create({
      data: { name, ownerId: USER_ID_TEST },
    })
    tagIdByExistingName[name] = tag.id
  }

  await prisma.kB.create({
    data: {
      id: KB_ID,
      name: `${FIXTURE_PREFIX} knowledge base`,
      description: 'Local-only synthetic data for the hosted review journey.',
      ownerId: USER_ID_TEST,
      knowledgeGraphEnabled: true,
      resources: {
        create: [
          {
            id: URL_RESOURCE_ID,
            type: DB.KBResourceType.URL,
            title: 'Synthetic course website',
            sourceUrl: 'https://example.invalid/synthetic-course',
            status: DB.KBResourceStatus.READY,
            contentSha256: 'url-source-sha256',
            resourceVersion: 1,
            activeResourceVersion: 1,
            activeContentSha256: 'url-source-sha256',
          },
          {
            id: BLOB_RESOURCE_ID,
            type: DB.KBResourceType.BLOB,
            title: 'Synthetic course handout.pdf',
            originalFilename: 'Synthetic course handout.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 128,
            blobName: 'synthetic/course-handout.pdf',
            blobHref:
              'https://example.invalid/blob/synthetic-course-handout.pdf',
            status: DB.KBResourceStatus.READY,
            contentSha256: 'blob-source-sha256',
            resourceVersion: 1,
            activeResourceVersion: 1,
            activeContentSha256: 'blob-source-sha256',
          },
        ],
      },
    },
  })

  await prisma.kBGraphBuild.create({
    data: {
      id: GRAPH_BUILD_ID,
      kbId: KB_ID,
      requestedById: USER_ID_TEST,
      status: DB.KBGraphBuildStatus.SUCCEEDED,
      sourceContentDigest: 'synthetic-source-content-digest',
      graphName: `synthetic:${KB_ID}:${GRAPH_BUILD_ID}`,
      sources: {
        create: [
          {
            resourceId: URL_RESOURCE_ID,
            title: 'Synthetic course website',
            type: DB.KBResourceType.URL,
            contentSha256: 'url-source-sha256',
            sourceUrl: 'https://example.invalid/synthetic-course',
          },
          {
            resourceId: BLOB_RESOURCE_ID,
            title: 'Synthetic course handout.pdf',
            type: DB.KBResourceType.BLOB,
            contentSha256: 'blob-source-sha256',
            sourceUrl: 'javascript:alert("synthetic")',
            blobName: 'synthetic/course-handout.pdf',
          },
        ],
      },
    },
  })
  await prisma.kB.update({
    where: { id: KB_ID },
    data: { publishedGraphBuildId: GRAPH_BUILD_ID },
  })

  const primaryBuildId = BUILD_ID
  await prisma.elementGenerationBuild.create({
    data: {
      id: primaryBuildId,
      ownerId: USER_ID_TEST,
      sourceGraphBuildId: GRAPH_BUILD_ID,
      elementType: 'SC',
      idempotencyKey: `${FIXTURE_PREFIX}-all-types`,
      configurationHash: 'synthetic-configuration-all-types',
      configuration: buildConfiguration(),
      requestedElementCount: 20,
      generatedElementCount: 20,
      status: DB.ElementGenerationBuildStatus.COMPLETED,
      stage: 'completed',
      completedAt: new Date('2026-08-29T08:00:00.000Z'),
      drafts: {
        create: Array.from({ length: 20 }, (_, index) => {
          const type = (['SC', 'MC', 'KPRIM', 'FLASHCARD'] as const)[
            Math.floor(index / 5)
          ]
          const values = draftValues(type, index)
          return {
            id: `b0000000-0000-4000-8000-${String(100 + index).padStart(12, '0')}`,
            sourceElementId: `synthetic-source-${type}-${(index % 5) + 1}`,
            order: index,
            elementType: type,
            original: {
              ...values.original,
              ...(type === 'FLASHCARD'
                ? {}
                : { suggestedTags: suggestedTagsFor(type) }),
            },
            current: values.current,
            citations: [
              {
                resourceId: URL_RESOURCE_ID,
                sourceFile: `${URL_RESOURCE_ID}.md`,
                pageFrom: 7,
                pageTo: 7,
                chunkIds: [`url-chunk-${type}-${index + 1}`],
              },
              {
                resourceId: BLOB_RESOURCE_ID,
                sourceFile: `${BLOB_RESOURCE_ID}.md`,
                pageFrom: 12,
                pageTo: 12,
                chunkIds: [`blob-chunk-${type}-${index + 1}`],
              },
            ],
            bloomLevel: type === 'FLASHCARD' ? null : 'understand',
            targetDifficulty: type === 'FLASHCARD' ? null : 3,
            predictedDifficulty: type === 'FLASHCARD' ? null : 3.1,
            qualityFlags: index === 4 ? ['manual_review_required'] : undefined,
          }
        }),
      },
    },
  })

  const attentionBuildId = ATTENTION_BUILD_ID
  await prisma.elementGenerationBuild.create({
    data: {
      id: attentionBuildId,
      ownerId: USER_ID_TEST,
      sourceGraphBuildId: GRAPH_BUILD_ID,
      elementType: 'SC',
      idempotencyKey: `${FIXTURE_PREFIX}-attention`,
      configurationHash: 'synthetic-configuration-attention',
      configuration: buildConfiguration(),
      requestedElementCount: 4,
      generatedElementCount: 4,
      warningCount: 2,
      status: DB.ElementGenerationBuildStatus.COMPLETED,
      stage: 'completed',
      completedAt: new Date('2026-08-29T09:00:00.000Z'),
      drafts: {
        create: [
          attentionDraft(0, [
            'difficulty_review_required',
            'difficulty_validation_failed',
            'manual_review_required',
            'weak_distractors',
          ]),
          attentionDraft(1, ['weak_distractors', 'synthetic_review_flag']),
          attentionDraft(2, []),
          {
            ...attentionDraft(3, []),
            decision: DB.GeneratedElementDecision.ACCEPTED,
          },
        ],
      },
    },
  })

  // The design-review build carries just enough design summary to render the
  // approval gate; the review gate itself is exercised against it.
  const gateBuildId = GATE_BUILD_ID
  await prisma.elementGenerationBuild.create({
    data: {
      id: gateBuildId,
      ownerId: USER_ID_TEST,
      sourceGraphBuildId: GRAPH_BUILD_ID,
      elementType: 'SC',
      idempotencyKey: `${FIXTURE_PREFIX}-design-review`,
      configurationHash: 'synthetic-configuration-design-review',
      configuration: buildConfiguration(),
      requestedElementCount: 4,
      status: DB.ElementGenerationBuildStatus.WAITING_FOR_DESIGN_REVIEW,
      stage: 'waiting_for_design_review',
      designSummary: {
        title: `${FIXTURE_PREFIX} design`,
        questionCount: 4,
        objectives: [],
        modules: [],
        sources: [],
        slots: [],
        warnings: [],
      },
    },
  })

  // A failed run that reported reasons for every slot it could not supply. The
  // three classes are covered plus one unknown reason code, so the client
  // renders the class explanation for the code it does not know.
  const failureBuildId = FAILURE_BUILD_ID
  const failureReasonSeeds: SlotFailureSeed[] = [
    failureSlot('q01', 'NO_SUPPORTING_DOCUMENTS', 'user_input', {
      moduleId: 'MOD-01',
      objective: 'Explain the synthetic source evidence.',
      evidenceTarget: 'Controller responsibilities on page 12',
      suggestions: [
        'Portfolio diversification',
        'Bond duration',
        'Portfolio diversification',
      ],
    }),
    failureSlot('q02', 'LEVEL_NOT_GROUNDABLE', 'self_repairable', {
      moduleId: 'MOD-02',
      objective: 'Apply the synthetic model to a new case.',
      objectiveSource: 'neutral',
      requestedLevel: 'evaluate',
      evidenceTarget: 'Synthetic evaluation evidence',
    }),
    failureSlot('q03', 'SYSTEM_FAILURE', 'system', {
      moduleId: 'MOD-02',
      objective: 'Analyze the synthetic source evidence.',
      requestedLevel: 'analyze',
      evidenceTarget: null,
      detail: 'Synthetic provider timeout while resolving evidence.',
    }),
    failureSlot('q04', 'FUTURE_WORKER_REASON', 'user_input', {
      moduleId: 'MOD-03',
      objective: 'Recall the synthetic definitions.',
      requestedLevel: 'remember',
      evidenceTarget: 'Synthetic definition list',
      detail: 'Synthetic reason code from a newer worker release.',
    }),
  ]
  await prisma.elementGenerationBuild.create({
    data: {
      id: failureBuildId,
      ownerId: USER_ID_TEST,
      sourceGraphBuildId: GRAPH_BUILD_ID,
      elementType: 'SC',
      idempotencyKey: `${FIXTURE_PREFIX}-failure-reasons`,
      configurationHash: 'synthetic-configuration-failure-reasons',
      configuration: buildConfiguration(),
      requestedElementCount: 4,
      generatedElementCount: 0,
      unresolvedElementCount: 4,
      status: DB.ElementGenerationBuildStatus.FAILED,
      stage: 'failed',
      errorCode: 'WORKFLOW_FAILED',
      errorMessage: 'Question-generation workflow reported a failure',
      errorRetryable: false,
      completedAt: new Date('2026-08-29T10:00:00.000Z'),
      planSummary: planSummaryWithFailures(4, [], failureReasonSeeds),
    },
  })

  // A partial run that delivered a passing subset and reported reasons for the
  // slots it could not supply; the delivered draft stays reviewable.
  const partialBuildId = PARTIAL_BUILD_ID
  const partialDeliveredDraftId = failureDraftId(0)
  await prisma.elementGenerationBuild.create({
    data: {
      id: partialBuildId,
      ownerId: USER_ID_TEST,
      sourceGraphBuildId: GRAPH_BUILD_ID,
      elementType: 'SC',
      idempotencyKey: `${FIXTURE_PREFIX}-partial-delivery`,
      configurationHash: 'synthetic-configuration-partial-delivery',
      configuration: buildConfiguration(),
      requestedElementCount: 4,
      generatedElementCount: 1,
      unresolvedElementCount: 3,
      status: DB.ElementGenerationBuildStatus.INCOMPLETE,
      stage: 'incomplete',
      completedAt: new Date('2026-08-29T11:00:00.000Z'),
      incompletePublishedAt: new Date('2026-08-29T11:00:00.000Z'),
      drafts: {
        create: [
          {
            ...attentionDraft(0, ['manual_review_required']),
            id: partialDeliveredDraftId,
          },
        ],
      },
      planSummary: planSummaryWithFailures(
        1,
        [
          {
            sourceQuestionId: 'synthetic-partial-1',
            moduleId: 'MOD-01',
            objectiveId: null,
            stem: 'Synthetic delivered partial prompt 1',
            bloomLevel: 'understand',
            targetDifficulty: 3,
          },
        ],
        [
          failureSlot('q02', 'NO_DISTINCT_EVIDENCE', 'self_repairable', {
            moduleId: 'MOD-02',
            requestedLevel: 'apply',
          }),
          failureSlot('q03', 'TOPIC_NOT_IN_MATERIAL', 'user_input', {
            moduleId: 'MOD-02',
            evidenceTarget: 'Synthetic uncovered topic',
            suggestions: ['Bond duration'],
          }),
          failureSlot('q04', 'SYSTEM_FAILURE', 'system', {
            moduleId: 'MOD-03',
            detail: 'Synthetic upstream failure.',
          }),
        ]
      ),
    },
  })

  // A failed run without structured reasons: the distinct legacy surface.
  const legacyFailureBuildId = LEGACY_FAILURE_BUILD_ID
  await prisma.elementGenerationBuild.create({
    data: {
      id: legacyFailureBuildId,
      ownerId: USER_ID_TEST,
      sourceGraphBuildId: GRAPH_BUILD_ID,
      elementType: 'SC',
      idempotencyKey: `${FIXTURE_PREFIX}-legacy-failure`,
      configurationHash: 'synthetic-configuration-legacy-failure',
      configuration: buildConfiguration(),
      requestedElementCount: 4,
      generatedElementCount: 0,
      status: DB.ElementGenerationBuildStatus.FAILED,
      stage: 'failed',
      errorCode: 'WORKFLOW_FAILED',
      errorMessage: 'Question-generation workflow did not complete',
      errorRetryable: false,
      completedAt: new Date('2026-08-29T12:00:00.000Z'),
    },
  })

  // A partial run whose slots all failed: it settled with reasons and no
  // drafts, so the reason surface replaces the empty review state.
  const zeroPassingBuildId = ZERO_PASSING_BUILD_ID
  await prisma.elementGenerationBuild.create({
    data: {
      id: zeroPassingBuildId,
      ownerId: USER_ID_TEST,
      sourceGraphBuildId: GRAPH_BUILD_ID,
      elementType: 'SC',
      idempotencyKey: `${FIXTURE_PREFIX}-zero-passing`,
      configurationHash: 'synthetic-configuration-zero-passing',
      configuration: buildConfiguration(),
      requestedElementCount: 2,
      generatedElementCount: 0,
      unresolvedElementCount: 2,
      status: DB.ElementGenerationBuildStatus.INCOMPLETE,
      stage: 'incomplete',
      completedAt: new Date('2026-08-29T13:00:00.000Z'),
      planSummary: planSummaryWithFailures(
        2,
        [],
        [
          failureSlot('q01', 'GROUNDING_EXHAUSTED', 'self_repairable', {
            moduleId: 'MOD-01',
            requestedLevel: 'understand',
          }),
          failureSlot('q02', 'NO_SUPPORTING_DOCUMENTS', 'user_input', {
            moduleId: 'MOD-02',
            evidenceTarget: 'Synthetic missing evidence',
            suggestions: ['Bond duration'],
          }),
        ]
      ),
    },
  })

  return {
    primaryBuildId,
    tagIdByExistingName,
    primaryDraftIds: Array.from(
      { length: 5 },
      (_, index) =>
        `b0000000-0000-4000-8000-${String(100 + index).padStart(12, '0')}`
    ),
    draftIdsByType: {
      SC: 'b0000000-0000-4000-8000-000000000100',
      MC: 'b0000000-0000-4000-8000-000000000105',
      KPRIM: 'b0000000-0000-4000-8000-000000000110',
      FLASHCARD: 'b0000000-0000-4000-8000-000000000115',
    },
    attentionBuildId,
    attentionDraftIds: {
      mixedFlags: attentionDraftId(0),
      unknownFlags: attentionDraftId(1),
      noFlags: attentionDraftId(2),
      acceptedUnsaved: attentionDraftId(3),
    },
    gateBuildId,
    failureBuildId,
    partialBuildId,
    partialDeliveredDraftId,
    legacyFailureBuildId,
    zeroPassingBuildId,
  }
}

export async function cleanupQuestionGenerationReviewFixture() {
  await deleteFixtureRows()
}
