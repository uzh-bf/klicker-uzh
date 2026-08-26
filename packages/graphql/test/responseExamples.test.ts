import type { EventEmitter } from 'node:events'
import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  type Prisma,
  type PrismaClient,
  ResponseExampleStatus,
  ResponseExampleStyle,
} from '@klicker-uzh/prisma/client'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  approveResponseExample,
  computeResponseExampleSetDigest,
  editAndApproveResponseExample,
  getChatbotResponseExamples,
  RESPONSE_EXAMPLE_DUPLICATE,
  RESPONSE_EXAMPLE_MODE_UNAVAILABLE,
  RESPONSE_EXAMPLE_SOURCES_REQUIRED,
  RESPONSE_EXAMPLE_STALE_UPDATE,
  RESPONSE_EXAMPLE_STATUS_INVALID,
  refreshResponseExampleSetDigest,
  rejectResponseExample,
} from '../src/services/responseExamples.js'
import {
  initializePrisma,
  seedCourse,
  testCleanup,
  testInitialization,
} from './helpers.js'

const responseExampleSetInclude = {
  examples: {
    orderBy: [{ chatMode: 'asc' }, { studentMessage: 'asc' }, { id: 'asc' }],
    include: {
      evidenceReferences: {
        orderBy: [
          { citationIndex: 'asc' },
          { sourceId: 'asc' },
          { chunkId: 'asc' },
          { contentHash: 'asc' },
          { citationAnchor: 'asc' },
          { id: 'asc' },
        ],
      },
    },
  },
  chatbot: {
    select: { systemPrompts: true },
  },
} satisfies Prisma.ResponseExampleSetInclude

describe('response-example foundation', () => {
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser

  beforeAll(async () => {
    const {
      prisma: newPrisma,
      hatchet: newHatchet,
      emitter: newEmitter,
    } = await initializePrisma()
    prisma = newPrisma
    hatchet = newHatchet
    emitter = newEmitter
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    const { userOneCtx: ownerContext, userTwoCtx: otherContext } =
      await testInitialization(prisma, hatchet, emitter)
    userOneCtx = ownerContext
    userTwoCtx = otherContext
  })

  afterEach(async () => await testCleanup(prisma))

  async function seedResponseExampleSet() {
    const course = await seedCourse({}, userOneCtx)
    const chatbot = await prisma.chatbot.create({
      data: {
        name: 'Response example test chatbot',
        courseId: course.id,
        ownerId: userOneCtx.user.sub,
        systemPrompts: {
          tutor: { prompt: 'Tutor prompt', description: 'Tutor mode' },
          explainer: {
            prompt: 'Explainer prompt',
            description: 'Explainer mode',
          },
        },
      },
    })
    const set = await prisma.responseExampleSet.create({
      data: {
        chatbotId: chatbot.id,
        examples: {
          create: [
            {
              chatMode: 'tutor',
              studentMessage: 'How should I start?',
              referenceAnswer: 'Start by identifying the relevant concept [1].',
              responseStyle: ResponseExampleStyle.GUIDED_QUESTIONS,
              status: ResponseExampleStatus.CANDIDATE,
              evidenceReferences: {
                create: {
                  citationIndex: 1,
                  sourceId: 'source-synthetic-1',
                  chunkId: 'chunk-synthetic-1',
                  contentHash: 'hash-synthetic-1',
                  citationAnchor: 'page 1',
                  evidenceEligible: true,
                },
              },
            },
            {
              chatMode: 'explainer',
              studentMessage: 'What is the next step?',
              referenceAnswer: 'Check the assumptions first.',
              responseStyle: ResponseExampleStyle.STEP_BY_STEP_EXPLANATION,
              status: ResponseExampleStatus.NEEDS_REVIEW,
              evidenceReferences: {
                create: {
                  citationIndex: 2,
                  sourceId: 'source-synthetic-2',
                  chunkId: 'chunk-synthetic-2',
                  contentHash: 'hash-synthetic-2',
                  citationAnchor: 'page 2',
                  evidenceEligible: false,
                },
              },
            },
          ],
        },
      },
    })

    const refreshedSet = await refreshResponseExampleSetDigest(prisma, set.id)
    if (!refreshedSet) throw new Error('Failed to refresh response-example set')

    return { chatbot, set: refreshedSet }
  }

  it('returns one exact-scope set only to its chatbot owner', async () => {
    const { chatbot } = await seedResponseExampleSet()

    const ownerSet = await getChatbotResponseExamples(
      { chatbotId: chatbot.id },
      userOneCtx
    )
    const otherUserSet = await getChatbotResponseExamples(
      { chatbotId: chatbot.id },
      userTwoCtx
    )

    expect(ownerSet).not.toBeNull()
    expect(ownerSet?.chatbotId).toBe(chatbot.id)
    expect(ownerSet?.chatModes).toEqual(['explainer', 'tutor'])
    expect(ownerSet?.examples).toHaveLength(2)
    expect(
      ownerSet?.examples.map(({ chatMode, studentMessage, status }) => ({
        chatMode,
        studentMessage,
        status,
      }))
    ).toEqual([
      {
        chatMode: 'explainer',
        studentMessage: 'What is the next step?',
        status: ResponseExampleStatus.NEEDS_REVIEW,
      },
      {
        chatMode: 'tutor',
        studentMessage: 'How should I start?',
        status: ResponseExampleStatus.CANDIDATE,
      },
    ])
    expect(ownerSet?.examples[1]?.evidenceReferences[0]).toMatchObject({
      citationIndex: 1,
      sourceId: 'source-synthetic-1',
      chunkId: 'chunk-synthetic-1',
      contentHash: 'hash-synthetic-1',
      citationAnchor: 'page 1',
      evidenceEligible: true,
    })
    expect(otherUserSet).toBeNull()
  })

  it('keeps owner review mutations current, mutable, and digest-bound', async () => {
    const { chatbot, set } = await seedResponseExampleSet()
    const candidate = set.examples.find(
      (example) => example.status === ResponseExampleStatus.CANDIDATE
    )!
    const needsReview = set.examples.find(
      (example) => example.status === ResponseExampleStatus.NEEDS_REVIEW
    )!
    const initialDigest = set.digest

    expect(
      await approveResponseExample({ id: candidate.id }, userTwoCtx)
    ).toBeNull()

    const approvedSet = await approveResponseExample(
      { id: candidate.id },
      userOneCtx
    )
    expect(
      approvedSet?.examples.find(({ id }) => id === candidate.id)
    ).toMatchObject({
      status: ResponseExampleStatus.APPROVED,
      reviewedById: userOneCtx.user.sub,
    })
    await expect(
      approveResponseExample({ id: candidate.id }, userOneCtx)
    ).rejects.toMatchObject({
      extensions: { code: RESPONSE_EXAMPLE_STATUS_INVALID },
    })

    const expectedUpdatedAt = approvedSet?.examples.find(
      ({ id }) => id === candidate.id
    )?.updatedAt
    if (!expectedUpdatedAt) throw new Error('Missing updatedAt after approval')
    const editedSet = await editAndApproveResponseExample(
      {
        id: candidate.id,
        chatMode: 'tutor',
        studentMessage: 'How do I begin this task?',
        referenceAnswer: 'Begin by naming the relevant concept [1].',
        responseStyle: ResponseExampleStyle.WORKED_EXAMPLE,
        expectedUpdatedAt,
      },
      userOneCtx
    )
    expect(
      editedSet?.examples.find(({ id }) => id === candidate.id)
    ).toMatchObject({
      studentMessage: 'How do I begin this task?',
      referenceAnswer: 'Begin by naming the relevant concept [1].',
      responseStyle: ResponseExampleStyle.WORKED_EXAMPLE,
      status: ResponseExampleStatus.APPROVED,
    })

    const rejectedSet = await rejectResponseExample(
      { id: needsReview.id },
      userOneCtx
    )
    const rejected = rejectedSet?.examples.find(
      ({ id }) => id === needsReview.id
    )
    expect(rejected).toMatchObject({
      status: ResponseExampleStatus.REJECTED,
      reviewedById: userOneCtx.user.sub,
    })
    expect(rejectedSet?.digest).not.toBe(initialDigest)
    await expect(
      rejectResponseExample({ id: needsReview.id }, userOneCtx)
    ).rejects.toMatchObject({
      extensions: { code: RESPONSE_EXAMPLE_STATUS_INVALID },
    })

    if (!rejected) throw new Error('Missing rejected response example')
    await expect(
      editAndApproveResponseExample(
        {
          id: rejected.id,
          chatMode: 'explainer',
          studentMessage: 'This edit must remain blocked.',
          referenceAnswer: 'Rejected examples stay terminal [2].',
          responseStyle: ResponseExampleStyle.CONCISE_ANSWER,
          expectedUpdatedAt: rejected.updatedAt,
        },
        userOneCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: RESPONSE_EXAMPLE_STATUS_INVALID },
    })
    await expect(
      prisma.responseExample.findUniqueOrThrow({
        where: { id: rejected.id },
      })
    ).resolves.toMatchObject({
      status: ResponseExampleStatus.REJECTED,
      reviewedById: rejected.reviewedById,
      reviewedAt: rejected.reviewedAt,
      studentMessage: rejected.studentMessage,
      referenceAnswer: rejected.referenceAnswer,
      responseStyle: rejected.responseStyle,
    })

    expect(
      await prisma.responseExample.count({ where: { setId: set.id } })
    ).toBe(2)
    expect(
      await getChatbotResponseExamples({ chatbotId: chatbot.id }, userOneCtx)
    ).toMatchObject({ digest: rejectedSet?.digest })
  })

  it('requires eligible sources and available modes before approval', async () => {
    const { chatbot, set } = await seedResponseExampleSet()
    const needsReview = set.examples.find(
      (example) => example.status === ResponseExampleStatus.NEEDS_REVIEW
    )!

    await expect(
      approveResponseExample({ id: needsReview.id }, userOneCtx)
    ).rejects.toMatchObject({
      extensions: { code: RESPONSE_EXAMPLE_SOURCES_REQUIRED },
    })

    await prisma.chatbot.update({
      where: { id: chatbot.id },
      data: { systemPrompts: { explainer: { prompt: 'Explainer' } } },
    })
    const candidate = set.examples.find(
      (example) => example.status === ResponseExampleStatus.CANDIDATE
    )!
    await expect(
      approveResponseExample({ id: candidate.id }, userOneCtx)
    ).rejects.toMatchObject({
      extensions: { code: RESPONSE_EXAMPLE_MODE_UNAVAILABLE },
    })
  })

  it('rejects stale edits, duplicate questions, and oversized input', async () => {
    const { chatbot, set } = await seedResponseExampleSet()
    const candidate = set.examples.find(
      (example) => example.status === ResponseExampleStatus.CANDIDATE
    )!

    const staleUpdatedAt = candidate.updatedAt
    const staleBefore = await prisma.responseExample.findUniqueOrThrow({
      where: { id: candidate.id },
    })
    const digestBeforeStale = (
      await getChatbotResponseExamples({ chatbotId: chatbot.id }, userOneCtx)
    )?.digest
    const changedAt = new Date(staleUpdatedAt.getTime() + 1_000)
    await prisma.responseExample.update({
      where: { id: candidate.id },
      data: { updatedAt: changedAt },
    })
    await expect(
      editAndApproveResponseExample(
        {
          id: candidate.id,
          chatMode: 'tutor',
          studentMessage: 'A stale edit',
          referenceAnswer: 'This should not be saved [1].',
          responseStyle: ResponseExampleStyle.CONCISE_ANSWER,
          expectedUpdatedAt: staleUpdatedAt,
        },
        userOneCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: RESPONSE_EXAMPLE_STALE_UPDATE },
    })
    await expect(
      prisma.responseExample.findUniqueOrThrow({ where: { id: candidate.id } })
    ).resolves.toMatchObject({
      studentMessage: candidate.studentMessage,
      chatMode: staleBefore.chatMode,
      referenceAnswer: staleBefore.referenceAnswer,
      responseStyle: staleBefore.responseStyle,
      status: ResponseExampleStatus.CANDIDATE,
      reviewedById: staleBefore.reviewedById,
      reviewedAt: staleBefore.reviewedAt,
    })
    expect(
      (await getChatbotResponseExamples({ chatbotId: chatbot.id }, userOneCtx))
        ?.digest
    ).toBe(digestBeforeStale)

    const duplicate = await prisma.responseExample.create({
      data: {
        setId: set.id,
        chatMode: 'tutor',
        studentMessage: 'Existing tutor question',
        referenceAnswer: 'Existing answer [3].',
        responseStyle: ResponseExampleStyle.CONCISE_ANSWER,
        evidenceReferences: {
          create: {
            citationIndex: 3,
            sourceId: 'source-synthetic-3',
            chunkId: 'chunk-synthetic-3',
            contentHash: 'hash-synthetic-3',
            citationAnchor: 'page 3',
            evidenceEligible: true,
          },
        },
      },
    })
    const currentCandidate = await prisma.responseExample.findUniqueOrThrow({
      where: { id: candidate.id },
    })
    await expect(
      editAndApproveResponseExample(
        {
          id: candidate.id,
          chatMode: 'tutor',
          studentMessage: duplicate.studentMessage,
          referenceAnswer: 'A duplicate question [1].',
          responseStyle: ResponseExampleStyle.CONCISE_ANSWER,
          expectedUpdatedAt: currentCandidate.updatedAt,
        },
        userOneCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: RESPONSE_EXAMPLE_DUPLICATE },
    })

    await expect(
      editAndApproveResponseExample(
        {
          id: candidate.id,
          chatMode: 'tutor',
          studentMessage: 'x'.repeat(4_001),
          referenceAnswer: 'Valid answer [1].',
          responseStyle: ResponseExampleStyle.CONCISE_ANSWER,
          expectedUpdatedAt: currentCandidate.updatedAt,
        },
        userOneCtx
      )
    ).rejects.toThrow()

    await expect(
      editAndApproveResponseExample(
        {
          id: candidate.id,
          chatMode: 'tutor',
          studentMessage: 'Valid question',
          referenceAnswer: 'x'.repeat(20_001),
          responseStyle: ResponseExampleStyle.CONCISE_ANSWER,
          expectedUpdatedAt: currentCandidate.updatedAt,
        },
        userOneCtx
      )
    ).rejects.toThrow()

    await expect(
      editAndApproveResponseExample(
        {
          id: candidate.id,
          chatMode: 'x'.repeat(101),
          studentMessage: 'Valid question',
          referenceAnswer: 'Valid answer [1].',
          responseStyle: ResponseExampleStyle.CONCISE_ANSWER,
          expectedUpdatedAt: currentCandidate.updatedAt,
        },
        userOneCtx
      )
    ).rejects.toThrow()
  })

  it('computes the same digest independent of relation order', async () => {
    const { set } = await seedResponseExampleSet()
    const loadedSet = await prisma.responseExampleSet.findUniqueOrThrow({
      where: { id: set.id },
      include: responseExampleSetInclude,
    })
    const reversedSet = {
      ...loadedSet,
      examples: loadedSet.examples
        .slice()
        .reverse()
        .map((example) => ({
          ...example,
          evidenceReferences: example.evidenceReferences.slice().reverse(),
        })),
    }

    expect(computeResponseExampleSetDigest(loadedSet)).toBe(
      computeResponseExampleSetDigest(reversedSet)
    )
  })

  it('cascades the set, entries, and evidence when a chatbot is deleted', async () => {
    const { chatbot, set } = await seedResponseExampleSet()

    await prisma.chatbot.delete({ where: { id: chatbot.id } })

    await expect(
      prisma.responseExampleSet.findUnique({ where: { id: set.id } })
    ).resolves.toBeNull()
    await expect(
      prisma.responseExample.count({ where: { setId: set.id } })
    ).resolves.toBe(0)
    await expect(prisma.responseExampleEvidenceReference.count()).resolves.toBe(
      0
    )
  })
})
