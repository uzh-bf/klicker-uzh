import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  type Prisma,
  type PrismaClient,
  ResponseExampleStatus,
} from '@klicker-uzh/prisma/client'
import type { EventEmitter } from 'node:events'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  approveResponseExample,
  computeResponseExampleSetDigest,
  editAndApproveResponseExample,
  getChatbotResponseExamples,
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
    orderBy: [
      { chatMode: 'asc' },
      { locale: 'asc' },
      { studentTurn: 'asc' },
      { id: 'asc' },
    ],
    include: {
      evidenceReferences: {
        orderBy: [
          { sourceId: 'asc' },
          { chunkId: 'asc' },
          { contentHash: 'asc' },
          { citationAnchor: 'asc' },
          { id: 'asc' },
        ],
      },
    },
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
      },
    })
    const set = await prisma.responseExampleSet.create({
      data: {
        chatbotId: chatbot.id,
        examples: {
          create: [
            {
              chatMode: 'tutor',
              locale: 'en',
              studentTurn: 'How should I start?',
              idealResponse: 'Start by identifying the relevant concept.',
              behaviorTag: 'scaffold',
              status: ResponseExampleStatus.CANDIDATE,
              evidenceReferences: {
                create: {
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
              locale: 'de',
              studentTurn: 'Was ist der nächste Schritt?',
              idealResponse: 'Prüfe zuerst die Annahmen.',
              behaviorTag: 'clarify',
              status: ResponseExampleStatus.NEEDS_REVIEW,
              evidenceReferences: {
                create: {
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
    expect(ownerSet?.examples).toHaveLength(2)
    expect(
      ownerSet?.examples.map(({ chatMode, locale, status }) => ({
        chatMode,
        locale,
        status,
      }))
    ).toEqual([
      {
        chatMode: 'explainer',
        locale: 'de',
        status: ResponseExampleStatus.NEEDS_REVIEW,
      },
      {
        chatMode: 'tutor',
        locale: 'en',
        status: ResponseExampleStatus.CANDIDATE,
      },
    ])
    expect(ownerSet?.examples[1]?.evidenceReferences[0]).toMatchObject({
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

    const editedSet = await editAndApproveResponseExample(
      {
        id: candidate.id,
        chatMode: 'tutor',
        locale: 'en-GB',
        studentTurn: 'How do I begin this task?',
        idealResponse: 'Begin by naming the relevant concept.',
        behaviorTag: 'scaffold',
      },
      userOneCtx
    )
    expect(
      editedSet?.examples.find(({ id }) => id === candidate.id)
    ).toMatchObject({
      locale: 'en-GB',
      studentTurn: 'How do I begin this task?',
      idealResponse: 'Begin by naming the relevant concept.',
      status: ResponseExampleStatus.APPROVED,
    })

    const rejectedSet = await rejectResponseExample(
      { id: needsReview.id },
      userOneCtx
    )
    expect(
      rejectedSet?.examples.find(({ id }) => id === needsReview.id)
    ).toMatchObject({ status: ResponseExampleStatus.REJECTED })
    expect(rejectedSet?.digest).not.toBe(initialDigest)

    expect(
      await prisma.responseExample.count({ where: { setId: set.id } })
    ).toBe(2)
    expect(
      await getChatbotResponseExamples({ chatbotId: chatbot.id }, userOneCtx)
    ).toMatchObject({ digest: rejectedSet?.digest })
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
