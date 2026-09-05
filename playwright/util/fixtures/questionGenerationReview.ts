import * as DB from '@klicker-uzh/prisma/client'
import { getPrisma } from '../../global-setup.js'
import { USER_ID_TEST } from '../constants.js'

const FIXTURE_PREFIX = 'Synthetic question-generation review fixture'

const BUILD_ID = 'b0000000-0000-4000-8000-000000000001'

const KB_ID = 'b0000000-0000-4000-8000-000000000010'
const GRAPH_BUILD_ID = 'b0000000-0000-4000-8000-000000000011'
const URL_RESOURCE_ID = 'b0000000-0000-4000-8000-000000000020'
const BLOB_RESOURCE_ID = 'b0000000-0000-4000-8000-000000000021'

export type QuestionGenerationReviewFixture = {
  primaryBuildId: string
  primaryDraftIds: string[]
  draftIdsByType: Record<'SC' | 'MC' | 'KPRIM' | 'FLASHCARD', string>
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
    where: { buildId: BUILD_ID },
    select: { savedElementId: true },
  })
  const savedElementIds = drafts.flatMap((draft) =>
    draft.savedElementId === null ? [] : [draft.savedElementId]
  )

  if (savedElementIds.length > 0) {
    await prisma.element.deleteMany({ where: { id: { in: savedElementIds } } })
  }
  await prisma.elementGenerationBuild.deleteMany({
    where: { id: BUILD_ID },
  })
  await prisma.kBGraphBuild.deleteMany({ where: { id: GRAPH_BUILD_ID } })
  await prisma.kB.deleteMany({ where: { id: KB_ID } })
}

export async function seedQuestionGenerationReviewFixture(): Promise<QuestionGenerationReviewFixture> {
  await deleteFixtureRows()
  const prisma = await getPrisma()

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
            original: values.original,
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

  return {
    primaryBuildId,
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
  }
}

export async function cleanupQuestionGenerationReviewFixture() {
  await deleteFixtureRows()
}
