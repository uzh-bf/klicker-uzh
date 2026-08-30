import { randomUUID } from 'node:crypto'
import { prisma } from '@klicker-uzh/prisma'
import {
  ChatbotStatus,
  ElementType,
  type PersonalElement,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import { FlashcardCorrectness } from '@klicker-uzh/types'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  abortCardGenerationLease,
  applyPersonalElementRevision,
  claimCardGenerationLease,
  completeCardGenerationLease,
  createPersonalElements,
  deletePersonalElement,
  discardPersonalElementCandidate,
  getPersonalElementGenerationContext,
  listPersonalElements,
  listSavedPersonalElementCandidateIds,
  normalizeElementSourceReferences,
  prepareCardPlan,
  readElementSourceReferences,
  respondToPersonalElement,
  savePersonalElementCandidate,
  updatePersonalElement,
  validateCardCandidate,
} from '../src/services/personalElements.js'

const createdUserIds: string[] = []
const createdParticipantIds: string[] = []
const createdCourseIds: string[] = []
const createdChatbotIds: string[] = []

function candidate(
  overrides: Partial<
    Parameters<typeof createPersonalElements>[0]['candidates'][number]
  > = {}
) {
  return {
    candidateId: randomUUID(),
    name: 'Opportunity cost',
    content: 'What is opportunity cost?',
    explanation: 'The value of the best alternative forgone.',
    sources: [
      {
        sourceId: 'course-material',
        kind: 'DOCUMENT' as const,
        title: 'Economics notes',
        canonicalUrl: 'https://example.org/economics.pdf',
        chunkIds: [randomUUID()],
        locators: [
          {
            type: 'PAGE_RANGE' as const,
            pageFrom: 4,
            pageTo: 4,
            labelFrom: 'iv',
            labelTo: 'iv',
          },
        ],
      },
    ],
    sourceMessageId: randomUUID(),
    sourceToolCallId: `tool-${randomUUID()}`,
    ...overrides,
  }
}

async function createFixture() {
  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.org`,
      shortname: `owner-${randomUUID()}`,
    },
  })
  const course = await prisma.course.create({
    data: {
      name: `Course ${randomUUID()}`,
      displayName: `Course ${randomUUID()}`,
      startDate: new Date(Date.now() - 86_400_000),
      endDate: new Date(Date.now() + 86_400_000),
      groupDeadlineDate: new Date(Date.now() + 86_400_000),
      pinCode: Math.floor(Math.random() * 9000 + 1000),
      ownerId: user.id,
    },
  })
  const participant = await prisma.participant.create({
    data: {
      username: `participant-${randomUUID()}`,
      password: 'test-password',
      participations: { create: [{ courseId: course.id }] },
    },
  })
  const chatbot = await prisma.chatbot.create({
    data: {
      name: `Chatbot ${randomUUID()}`,
      courseId: course.id,
      ownerId: user.id,
      status: ChatbotStatus.PUBLISHED,
    },
  })
  const thread = await prisma.chatThread.create({
    data: { participantId: participant.id, chatbotId: chatbot.id },
  })
  const planMessage = await prisma.chatMessage.create({
    data: {
      threadId: thread.id,
      role: 'assistant',
      content: [],
    },
  })

  createdUserIds.push(user.id)
  createdCourseIds.push(course.id)
  createdParticipantIds.push(participant.id)
  createdChatbotIds.push(chatbot.id)
  return { course, participant, chatbot, planMessage }
}

function context(participantId: string) {
  return { prisma, participantId }
}

async function createGeneratedCandidateAttempt(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  { persisted = false, title = 'Opportunity cost' } = {}
) {
  const planId = randomUUID()
  const candidateId = `${planId}:card-1`
  const planToolCallId = `plan-${randomUUID()}`
  const generationToolCallId = `generate-${randomUUID()}`
  await prisma.chatMessage.update({
    where: { id: fixture.planMessage.id },
    data: {
      content: [
        {
          type: 'tool-call',
          toolName: 'propose_card_plan',
          toolCallId: planToolCallId,
          result: {
            status: 'ready',
            planId,
            topic: 'Economics',
            cards: [
              {
                type: 'FLASHCARD',
                candidateId,
                title,
                intent: `Explain ${title}`,
                query: title,
              },
            ],
          },
        },
      ],
    },
  })
  const message = await prisma.chatMessage.create({
    data: {
      threadId: fixture.planMessage.threadId,
      parentId: fixture.planMessage.id,
      role: 'assistant',
      content: [],
      lifecycleStatus: persisted ? 'COMPLETED' : 'IN_PROGRESS',
    },
  })
  const generated = candidate({
    candidateId,
    name: title,
    sourceMessageId: message.id,
    sourceToolCallId: generationToolCallId,
    origin: 'AI_GENERATED',
  })
  if (persisted) {
    await prisma.chatMessage.update({
      where: { id: message.id },
      data: {
        content: [
          {
            type: 'tool-call',
            toolName: 'generate_cards',
            toolCallId: generationToolCallId,
            result: {
              status: 'completed',
              completed: 1,
              total: 1,
              candidates: [{ type: 'FLASHCARD', ...generated }],
            },
          },
        ],
      },
    })
  }
  await prisma.cardGenerationLease.create({
    data: {
      participantId: fixture.participant.id,
      planMessageId: fixture.planMessage.id,
      planToolCallId,
      attemptToken: message.id,
      leaseExpiresAt: new Date(Date.now() + 60_000),
      completedAt: persisted ? new Date() : null,
    },
  })
  return {
    generated,
    linkage: {
      courseId: fixture.course.id,
      messageId: message.id,
      toolCallId: generationToolCallId,
      candidateId,
    },
  }
}

async function createPersistedRevisionAttempt(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  element: PersonalElement,
  overrides: Partial<{
    name: string
    content: string
    explanation: string
    sources: ReturnType<typeof candidate>['sources']
    lifecycleStatus: 'COMPLETED' | 'IN_PROGRESS'
  }> = {}
) {
  const toolCallId = `revise-${randomUUID()}`
  const message = await prisma.chatMessage.create({
    data: {
      threadId: fixture.planMessage.threadId,
      parentId: fixture.planMessage.id,
      role: 'assistant',
      lifecycleStatus: overrides.lifecycleStatus ?? 'COMPLETED',
      content: [
        {
          type: 'tool-call',
          toolName: 'revise_personal_element',
          toolCallId,
          result: {
            status: 'updated',
            id: element.id,
            expectedVersion: element.version,
            name: overrides.name ?? element.name,
            content: overrides.content ?? element.content,
            explanation: overrides.explanation ?? element.explanation,
            sources: overrides.sources ?? candidate().sources,
          },
        },
      ],
    },
  })
  return {
    courseId: fixture.course.id,
    messageId: message.id,
    toolCallId,
  }
}

async function createLeasePlan(
  fixture: Awaited<ReturnType<typeof createFixture>>
) {
  const planId = randomUUID()
  const planToolCallId = `plan-${randomUUID()}`
  await prisma.chatMessage.update({
    where: { id: fixture.planMessage.id },
    data: {
      content: [
        {
          type: 'tool-call',
          toolName: 'propose_card_plan',
          toolCallId: planToolCallId,
          result: {
            status: 'ready',
            planId,
            topic: 'Economics',
            cards: [
              {
                type: 'FLASHCARD',
                candidateId: `${planId}:card-1`,
                title: 'Opportunity cost',
                intent: 'Explain opportunity cost',
                query: 'opportunity cost',
              },
            ],
          },
        },
      ],
    },
  })

  return {
    courseId: fixture.course.id,
    planMessageId: fixture.planMessage.id,
    planToolCallId,
    createAttempt: async (parentId = fixture.planMessage.id) => {
      const attempt = await prisma.chatMessage.create({
        data: {
          threadId: fixture.planMessage.threadId,
          parentId,
          role: 'assistant',
          content: [],
          lifecycleStatus: 'IN_PROGRESS',
          lifecycleAttemptId: randomUUID(),
        },
      })
      return attempt.id
    },
  }
}

async function persistCompletedGenerationAttempt(attemptToken: string) {
  const toolCallId = `generate-${randomUUID()}`
  await prisma.chatMessage.update({
    where: { id: attemptToken },
    data: {
      lifecycleStatus: 'COMPLETED',
      content: [
        {
          type: 'tool-call',
          toolName: 'generate_cards',
          toolCallId,
          result: {
            status: 'completed',
            completed: 1,
            total: 1,
            candidates: [{ candidateId: randomUUID() }],
          },
        },
      ],
    },
  })
}

function expectNewLearningState(
  element: Pick<
    PersonalElement,
    | 'eFactor'
    | 'interval'
    | 'correctCountStreak'
    | 'correctCount'
    | 'partialCorrectCount'
    | 'wrongCount'
    | 'nextDueAt'
    | 'lastAnsweredAt'
    | 'lastCorrectAt'
    | 'lastPartialCorrectAt'
    | 'lastWrongAt'
    | 'lastResponseCorrectness'
  >
) {
  expect(element.eFactor).toBe(2.5)
  expect(element.interval).toBe(0)
  expect(element.correctCountStreak).toBe(0)
  expect(element.correctCount).toBe(0)
  expect(element.partialCorrectCount).toBe(0)
  expect(element.wrongCount).toBe(0)
  expect(element.nextDueAt).toBeNull()
  expect(element.lastAnsweredAt).toBeNull()
  expect(element.lastCorrectAt).toBeNull()
  expect(element.lastPartialCorrectAt).toBeNull()
  expect(element.lastWrongAt).toBeNull()
  expect(element.lastResponseCorrectness).toBeNull()
}

describe('personal elements service', () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  afterEach(async () => {
    await prisma.personalElement.deleteMany({
      where: { participantId: { in: createdParticipantIds } },
    })
    await prisma.personalElementDiscard.deleteMany({
      where: { participantId: { in: createdParticipantIds } },
    })
    await prisma.cardGenerationLease.deleteMany({
      where: { participantId: { in: createdParticipantIds } },
    })
    await prisma.chatbot.deleteMany({
      where: { id: { in: createdChatbotIds } },
    })
    await prisma.participant.deleteMany({
      where: { id: { in: createdParticipantIds } },
    })
    await prisma.course.deleteMany({ where: { id: { in: createdCourseIds } } })
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
    createdParticipantIds.length = 0
    createdCourseIds.length = 0
    createdUserIds.length = 0
    createdChatbotIds.length = 0
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('rejects missing and non-participating participants before writing', async () => {
    const { course } = await createFixture()
    await expect(
      createPersonalElements(
        { courseId: course.id, candidates: [candidate()] },
        context('')
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_UNAUTHORIZED' },
    })

    const other = await prisma.participant.create({
      data: { username: `other-${randomUUID()}`, password: 'test-password' },
    })
    createdParticipantIds.push(other.id)
    await expect(
      createPersonalElements(
        { courseId: course.id, candidates: [candidate()] },
        context(other.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_NOT_PARTICIPATING' },
    })
  })

  it('is idempotent and preserves bounded, card-local sources', async () => {
    const { course, participant } = await createFixture()
    const input = candidate()
    const first = await createPersonalElements(
      { courseId: course.id, candidates: [input] },
      context(participant.id)
    )
    const second = await createPersonalElements(
      { courseId: course.id, candidates: [input] },
      context(participant.id)
    )

    expect(first[0]?.id).toBe(second[0]?.id)
    expect(await prisma.personalElement.count()).toBe(1)
    expect(first[0]?.type).toBe(ElementType.FLASHCARD)
    expect(first[0]?.sources).toEqual(input.sources)
  })

  it('normalizes the flat prototype into grouped disjoint page ranges', () => {
    expect(
      normalizeElementSourceReferences([
        {
          sourceId: 'script',
          chunkId: 'chunk-1',
          title: 'Course script',
          url: 'https://example.org/course-script.PDF?edition=2',
          page: 1,
        },
        {
          sourceId: 'script',
          chunkId: 'chunk-2',
          title: 'Course script',
          url: 'https://example.org/course-script.PDF?edition=2',
          page: 2,
        },
        {
          sourceId: 'script',
          chunkId: 'chunk-7',
          title: 'Course script',
          url: 'https://example.org/course-script.PDF?edition=2',
          page: 7,
        },
      ])
    ).toEqual([
      {
        sourceId: 'script',
        kind: 'DOCUMENT',
        title: 'Course script',
        canonicalUrl: 'https://example.org/course-script.PDF?edition=2',
        chunkIds: ['chunk-1', 'chunk-2', 'chunk-7'],
        locators: [
          { type: 'PAGE_RANGE', pageFrom: 1, pageTo: 2 },
          { type: 'PAGE_RANGE', pageFrom: 7, pageTo: 7 },
        ],
      },
    ])
  })

  it('rejects signed URLs and source bodies at the service boundary', () => {
    expect(() =>
      normalizeElementSourceReferences([
        {
          sourceId: 'script',
          kind: 'DOCUMENT',
          title: 'Course script',
          canonicalUrl: 'https://example.org/script.pdf?sig=secret',
          chunkIds: ['chunk-1'],
          locators: [{ type: 'PAGE_RANGE', pageFrom: 1, pageTo: 1 }],
        },
      ])
    ).toThrowError(/stable http\(s\) addresses/u)
    expect(() =>
      normalizeElementSourceReferences([
        {
          sourceId: 'script',
          chunkId: 'chunk-1',
          title: 'Course script',
          page: 1,
          metadata: { excerpt: 'Raw source text must not persist' },
        },
      ])
    ).toThrowError(/Source text must not be persisted/u)
  })

  it('keeps legacy source identity readable while dropping unsafe locators', () => {
    expect(
      readElementSourceReferences([
        {
          sourceId:
            's3://user:password@bucket/legacy-script?token=temporary#section',
          chunkId: '//user:password@example.org/chunk-1?token=temporary#part',
          title:
            'ftp://user:password@example.org/legacy-script?token=temporary#section',
          url: 'https://example.org/script.pdf?sig=expired',
          page: 0.5,
          metadata: { excerpt: 'Old source text is not retained' },
        },
      ])
    ).toEqual([
      {
        sourceId: 's3://bucket/legacy-script',
        kind: 'DOCUMENT',
        title: 'legacy-script',
        chunkIds: ['//example.org/chunk-1'],
        locators: [],
      },
    ])
  })

  it('keeps grouped stored references readable after sanitization collisions', () => {
    expect(
      readElementSourceReferences([
        {
          sourceId: 's3://first:secret@bucket/script',
          kind: 'DOCUMENT',
          title: 'Course script',
          chunkIds: ['s3://first:secret@bucket/chunk-1'],
          locators: [{ type: 'PAGE_RANGE', pageFrom: 1, pageTo: 1 }],
        },
        {
          sourceId: 's3://second:secret@bucket/script',
          kind: 'DOCUMENT',
          title: 'Course script',
          chunkIds: ['s3://second:secret@bucket/chunk-1'],
          locators: [{ type: 'PAGE_RANGE', pageFrom: 2, pageTo: 2 }],
        },
      ])
    ).toMatchObject([
      { sourceId: 's3://bucket/script', chunkIds: ['s3://bucket/chunk-1'] },
      { sourceId: 'stored-source-2', chunkIds: ['stored-chunk-2'] },
    ])
  })

  it('deduplicates identical raw chunk IDs in stored flat references', () => {
    expect(
      readElementSourceReferences([
        {
          sourceId: 'script',
          chunkId: 'chunk-1',
          title: 'Course script',
          page: 1,
        },
        {
          sourceId: 'script',
          chunkId: 'chunk-1',
          title: 'Course script',
          page: 2,
        },
      ])
    ).toMatchObject([
      {
        sourceId: 'script',
        chunkIds: ['chunk-1'],
        locators: [{ type: 'PAGE_RANGE', pageFrom: 1, pageTo: 2 }],
      },
    ])
  })

  it('rejects repeated candidate IDs within one batch', async () => {
    const { course, participant } = await createFixture()
    const input = candidate()
    const retryInput = candidate({
      candidateId: input.candidateId,
      sourceMessageId: randomUUID(),
      sourceToolCallId: `retry-tool-${randomUUID()}`,
    })

    await expect(
      createPersonalElements(
        { courseId: course.id, candidates: [input, retryInput] },
        context(participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_INVALID_INPUT' },
    })
    expect(
      await prisma.personalElement.count({
        where: { participantId: participant.id, courseId: course.id },
      })
    ).toBe(0)
  })

  it('accepts a structurally valid explanation regardless of language', async () => {
    const { course, participant } = await createFixture()
    const [element] = await createPersonalElements(
      {
        courseId: course.id,
        candidates: [
          candidate({
            explanation:
              'Die Flashcard verwendet ausschließlich die Informationen aus dem bereitgestellten Chunk.',
          }),
        ],
      },
      context(participant.id)
    )
    expect(element).toBeDefined()

    await expect(
      createPersonalElements(
        {
          courseId: course.id,
          candidates: [candidate({ explanation: 'x' })],
        },
        context(participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_INVALID_INPUT' },
    })
  })

  it('accepts a provenance-only explanation during card updates', async () => {
    const { course, participant } = await createFixture()
    const [element] = await createPersonalElements(
      { courseId: course.id, candidates: [candidate()] },
      context(participant.id)
    )

    const revised = await updatePersonalElement(
      {
        id: element!.id,
        expectedVersion: element!.version,
        explanation:
          'Die Flashcard verwendet ausschließlich die Informationen aus dem bereitgestellten Chunk.',
      },
      context(participant.id)
    )
    expect(revised.explanation).toBe(
      'Die Flashcard verwendet ausschließlich die Informationen aus dem bereitgestellten Chunk.'
    )
  })

  it('preserves system-managed sources during manual card updates', async () => {
    const { course, participant } = await createFixture()
    const [element] = await createPersonalElements(
      { courseId: course.id, candidates: [candidate()] },
      context(participant.id)
    )

    const updated = await updatePersonalElement(
      {
        id: element!.id,
        expectedVersion: element!.version,
        content: 'What is the value of the next-best alternative?',
      },
      context(participant.id)
    )
    expect(updated.sources).toEqual(element!.sources)
  })

  it('applies only a persisted terminal generated revision', async () => {
    const fixture = await createFixture()
    const [element] = await createPersonalElements(
      { courseId: fixture.course.id, candidates: [candidate()] },
      context(fixture.participant.id)
    )
    const linkage = await createPersistedRevisionAttempt(fixture, element!, {
      content: 'Revised front',
      explanation: 'Revised back with enough detail.',
      lifecycleStatus: 'IN_PROGRESS',
    })

    await expect(
      applyPersonalElementRevision(linkage, context(fixture.participant.id))
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENT_REVISION_NOT_FOUND' },
    })
    expect(
      await prisma.personalElement.findUniqueOrThrow({
        where: { id: element!.id },
      })
    ).toMatchObject({
      version: element!.version,
      content: element!.content,
      sources: element!.sources,
    })
  })

  it('rejects a persisted revision after its chatbot is paused', async () => {
    const fixture = await createFixture()
    const [element] = await createPersonalElements(
      { courseId: fixture.course.id, candidates: [candidate()] },
      context(fixture.participant.id)
    )
    const linkage = await createPersistedRevisionAttempt(fixture, element!, {
      content: 'Revised front',
      explanation: 'Revised back with enough detail.',
    })
    await prisma.chatbot.update({
      where: { id: fixture.chatbot.id },
      data: { status: ChatbotStatus.PAUSED },
    })

    await expect(
      applyPersonalElementRevision(linkage, context(fixture.participant.id))
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENT_REVISION_NOT_FOUND' },
    })
  })

  it('rejects a candidate that was durably discarded', async () => {
    const { course, participant } = await createFixture()
    const input = candidate()
    await prisma.personalElementDiscard.create({
      data: {
        participantId: participant.id,
        courseId: course.id,
        candidateId: input.candidateId,
      },
    })

    await expect(
      createPersonalElements(
        { courseId: course.id, candidates: [input] },
        context(participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_CANDIDATE_DISCARDED' },
    })
    expect(
      await prisma.personalElement.count({
        where: { participantId: participant.id, courseId: course.id },
      })
    ).toBe(0)
  })

  it('serializes save and discard so only one candidate disposition wins', async () => {
    const fixture = await createFixture()
    const attempt = await createGeneratedCandidateAttempt(fixture, {
      persisted: true,
    })

    const results = await Promise.allSettled([
      savePersonalElementCandidate(
        attempt.linkage,
        context(fixture.participant.id)
      ),
      discardPersonalElementCandidate(
        attempt.linkage,
        context(fixture.participant.id)
      ),
    ])

    const saved = await prisma.personalElement.count({
      where: {
        participantId: fixture.participant.id,
        courseId: fixture.course.id,
        candidateId: attempt.generated.candidateId,
      },
    })
    const discarded = await prisma.personalElementDiscard.count({
      where: {
        participantId: fixture.participant.id,
        courseId: fixture.course.id,
        candidateId: attempt.generated.candidateId,
      },
    })

    expect(saved + discarded).toBe(1)
    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1)
  })

  it('treats the plan candidate ID as stable across generation attempts', async () => {
    const fixture = await createFixture()
    const { course, participant } = fixture
    const firstAttempt = candidate()
    const retryAttempt = candidate({
      candidateId: firstAttempt.candidateId,
      sourceMessageId: randomUUID(),
      sourceToolCallId: `retry-tool-${randomUUID()}`,
    })

    const [saved] = await createPersonalElements(
      { courseId: course.id, candidates: [firstAttempt] },
      context(participant.id)
    )
    const [sameSaved] = await createPersonalElements(
      { courseId: course.id, candidates: [retryAttempt] },
      context(participant.id)
    )

    expect(sameSaved?.id).toBe(saved?.id)
    expect(sameSaved?.sourceMessageId).toBe(firstAttempt.sourceMessageId)
    expect(
      await prisma.personalElement.count({
        where: { participantId: participant.id, courseId: course.id },
      })
    ).toBe(1)

    const discardedAttempt = await createGeneratedCandidateAttempt(fixture, {
      persisted: true,
      title: 'Marginal cost',
    })
    await discardPersonalElementCandidate(
      discardedAttempt.linkage,
      context(participant.id)
    )
    await expect(
      createPersonalElements(
        {
          courseId: course.id,
          candidates: [
            candidate({
              candidateId: discardedAttempt.generated.candidateId,
              sourceMessageId: randomUUID(),
              sourceToolCallId: `retry-tool-${randomUUID()}`,
            }),
          ],
        },
        context(participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_CANDIDATE_DISCARDED' },
    })
  })

  it('allows only one concurrent generation lease claim', async () => {
    const fixture = await createFixture()
    const { createAttempt, ...key } = await createLeasePlan(fixture)
    const claims = await Promise.allSettled([
      claimCardGenerationLease(
        { ...key, attemptToken: await createAttempt() },
        context(fixture.participant.id)
      ),
      claimCardGenerationLease(
        { ...key, attemptToken: await createAttempt() },
        context(fixture.participant.id)
      ),
    ])

    expect(claims.filter((claim) => claim.status === 'fulfilled')).toHaveLength(
      1
    )
    expect(claims.filter((claim) => claim.status === 'rejected')).toHaveLength(
      1
    )
    expect(
      await prisma.cardGenerationLease.count({
        where: { participantId: fixture.participant.id },
      })
    ).toBe(1)
  })

  it('does not complete a lease before terminal generation is persisted', async () => {
    const fixture = await createFixture()
    const { createAttempt, ...key } = await createLeasePlan(fixture)
    const attemptToken = await createAttempt()
    const lease = await claimCardGenerationLease(
      { ...key, attemptToken },
      context(fixture.participant.id)
    )

    expect(
      await completeCardGenerationLease(
        lease.id,
        attemptToken,
        context(fixture.participant.id)
      )
    ).toBe(false)
    expect(
      await prisma.cardGenerationLease.findUniqueOrThrow({
        where: { id: lease.id },
        select: { completedAt: true },
      })
    ).toEqual({ completedAt: null })
  })

  it('rejects a lease claim for an arbitrary plan tool call', async () => {
    const fixture = await createFixture()
    const { createAttempt, ...key } = await createLeasePlan(fixture)

    await expect(
      claimCardGenerationLease(
        {
          ...key,
          planToolCallId: `forged-${randomUUID()}`,
          attemptToken: await createAttempt(),
        },
        context(fixture.participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'CARD_GENERATION_PLAN_NOT_FOUND' },
    })
    expect(
      await prisma.cardGenerationLease.count({
        where: { participantId: fixture.participant.id },
      })
    ).toBe(0)
  })

  it('rejects the completed plan message as a generation attempt', async () => {
    const fixture = await createFixture()
    const leasePlan = await createLeasePlan(fixture)
    const key = {
      courseId: leasePlan.courseId,
      planMessageId: leasePlan.planMessageId,
      planToolCallId: leasePlan.planToolCallId,
    }

    await expect(
      claimCardGenerationLease(
        { ...key, attemptToken: fixture.planMessage.id },
        context(fixture.participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'CARD_GENERATION_ATTEMPT_NOT_FOUND' },
    })
  })

  it('rejects a completed assistant message as a generation attempt', async () => {
    const fixture = await createFixture()
    const { createAttempt, ...key } = await createLeasePlan(fixture)
    const attemptToken = await createAttempt()
    await prisma.chatMessage.update({
      where: { id: attemptToken },
      data: { lifecycleStatus: 'COMPLETED' },
    })

    await expect(
      claimCardGenerationLease(
        { ...key, attemptToken },
        context(fixture.participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'CARD_GENERATION_ATTEMPT_NOT_FOUND' },
    })
  })

  it('rejects an unclaimed in-progress assistant message', async () => {
    const fixture = await createFixture()
    const leasePlan = await createLeasePlan(fixture)
    const key = {
      courseId: leasePlan.courseId,
      planMessageId: leasePlan.planMessageId,
      planToolCallId: leasePlan.planToolCallId,
    }
    const attempt = await prisma.chatMessage.create({
      data: {
        threadId: fixture.planMessage.threadId,
        parentId: fixture.planMessage.id,
        role: 'assistant',
        content: [],
        lifecycleStatus: 'IN_PROGRESS',
      },
    })

    await expect(
      claimCardGenerationLease(
        { ...key, attemptToken: attempt.id },
        context(fixture.participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'CARD_GENERATION_ATTEMPT_NOT_FOUND' },
    })
  })

  it('rejects a lease claim after course participation is removed', async () => {
    const fixture = await createFixture()
    const { createAttempt, ...key } = await createLeasePlan(fixture)
    await prisma.participation.delete({
      where: {
        courseId_participantId: {
          courseId: fixture.course.id,
          participantId: fixture.participant.id,
        },
      },
    })

    await expect(
      claimCardGenerationLease(
        { ...key, attemptToken: await createAttempt() },
        context(fixture.participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_NOT_PARTICIPATING' },
    })
    expect(
      await prisma.cardGenerationLease.count({
        where: { participantId: fixture.participant.id },
      })
    ).toBe(0)
  })

  it('rejects a lease claim for a superseded plan', async () => {
    const fixture = await createFixture()
    const { createAttempt, ...key } = await createLeasePlan(fixture)
    const newerPlanId = randomUUID()
    const newerPlan = await prisma.chatMessage.create({
      data: {
        threadId: fixture.planMessage.threadId,
        parentId: fixture.planMessage.id,
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolName: 'propose_card_plan',
            toolCallId: `plan-${randomUUID()}`,
            result: {
              status: 'ready',
              planId: newerPlanId,
              topic: 'Economics',
              cards: [
                {
                  type: 'FLASHCARD',
                  candidateId: `${newerPlanId}:card-1`,
                  title: 'Marginal cost',
                  intent: 'Explain marginal cost',
                  query: 'marginal cost',
                },
              ],
            },
          },
        ],
      },
    })

    await expect(
      claimCardGenerationLease(
        { ...key, attemptToken: await createAttempt(newerPlan.id) },
        context(fixture.participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'CARD_GENERATION_PLAN_SUPERSEDED' },
    })
    expect(
      await prisma.cardGenerationLease.count({
        where: { participantId: fixture.participant.id },
      })
    ).toBe(0)
  })

  it('reclaims an expired lease once and protects the new owner', async () => {
    const fixture = await createFixture()
    const { createAttempt, ...key } = await createLeasePlan(fixture)
    const staleAttemptToken = await createAttempt()
    const initial = await claimCardGenerationLease(
      { ...key, attemptToken: staleAttemptToken },
      context(fixture.participant.id)
    )
    await prisma.cardGenerationLease.update({
      where: { id: initial.id },
      data: { leaseExpiresAt: new Date(Date.now() - 1_000) },
    })

    const attemptTokens = await Promise.all([createAttempt(), createAttempt()])
    const reclaims = await Promise.allSettled(
      attemptTokens.map((attemptToken) =>
        claimCardGenerationLease(
          { ...key, attemptToken },
          context(fixture.participant.id)
        )
      )
    )
    expect(
      reclaims.filter((reclaim) => reclaim.status === 'fulfilled')
    ).toHaveLength(1)
    expect(
      await abortCardGenerationLease(
        initial.id,
        staleAttemptToken,
        context(fixture.participant.id)
      )
    ).toBe(false)
    expect(
      await completeCardGenerationLease(
        initial.id,
        staleAttemptToken,
        context(fixture.participant.id)
      )
    ).toBe(false)

    const current = await prisma.cardGenerationLease.findUniqueOrThrow({
      where: { id: initial.id },
    })
    expect(current.attemptToken).not.toBe(staleAttemptToken)
    await persistCompletedGenerationAttempt(current.attemptToken)
    expect(
      await completeCardGenerationLease(
        current.id,
        current.attemptToken,
        context(fixture.participant.id)
      )
    ).toBe(true)
    await expect(
      claimCardGenerationLease(
        { ...key, attemptToken: await createAttempt() },
        context(fixture.participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'CARD_GENERATION_ALREADY_COMPLETED' },
    })
  })

  it('releases an aborted lease for retry', async () => {
    const fixture = await createFixture()
    const { createAttempt, ...key } = await createLeasePlan(fixture)
    const attemptToken = await createAttempt()
    const lease = await claimCardGenerationLease(
      { ...key, attemptToken },
      context(fixture.participant.id)
    )
    expect(
      await abortCardGenerationLease(
        lease.id,
        attemptToken,
        context(fixture.participant.id)
      )
    ).toBe(true)
    expect(
      await completeCardGenerationLease(
        lease.id,
        attemptToken,
        context(fixture.participant.id)
      )
    ).toBe(false)

    const retry = await claimCardGenerationLease(
      { ...key, attemptToken: await createAttempt() },
      context(fixture.participant.id)
    )
    expect(retry.id).toBe(lease.id)
  })

  it('does not complete an expired lease', async () => {
    const fixture = await createFixture()
    const { createAttempt, ...key } = await createLeasePlan(fixture)
    const lease = await claimCardGenerationLease(
      {
        ...key,
        attemptToken: await createAttempt(),
      },
      context(fixture.participant.id)
    )
    await prisma.cardGenerationLease.update({
      where: { id: lease.id },
      data: { leaseExpiresAt: new Date(Date.now() - 1_000) },
    })

    expect(
      await completeCardGenerationLease(
        lease.id,
        lease.attemptToken,
        context(fixture.participant.id)
      )
    ).toBe(false)
  })

  it('does not abort an expired lease', async () => {
    const fixture = await createFixture()
    const { createAttempt, ...key } = await createLeasePlan(fixture)
    const lease = await claimCardGenerationLease(
      {
        ...key,
        attemptToken: await createAttempt(),
      },
      context(fixture.participant.id)
    )
    await prisma.cardGenerationLease.update({
      where: { id: lease.id },
      data: { leaseExpiresAt: new Date(Date.now() - 1_000) },
    })

    expect(
      await abortCardGenerationLease(
        lease.id,
        lease.attemptToken,
        context(fixture.participant.id)
      )
    ).toBe(false)
  })

  it('progresses SM-2 and guards revisions by version', async () => {
    const fixture = await createFixture()
    const { course, participant } = fixture
    const [element] = await createPersonalElements(
      { courseId: course.id, candidates: [candidate()] },
      context(participant.id)
    )
    expect(element).toBeDefined()

    const first = await respondToPersonalElement(
      {
        id: element!.id,
        response: FlashcardCorrectness.CORRECT,
        expectedVersion: 1,
      },
      context(participant.id)
    )
    expect(first.interval).toBe(2)
    expect(first.correctCountStreak).toBe(1)
    const second = await respondToPersonalElement(
      {
        id: element!.id,
        response: FlashcardCorrectness.CORRECT,
        expectedVersion: 1,
      },
      context(participant.id)
    )
    expect(second.interval).toBe(6)
    const third = await respondToPersonalElement(
      {
        id: element!.id,
        response: FlashcardCorrectness.CORRECT,
        expectedVersion: 1,
      },
      context(participant.id)
    )
    expect(third.interval).toBeGreaterThan(6)
    const reset = await respondToPersonalElement(
      {
        id: element!.id,
        response: FlashcardCorrectness.INCORRECT,
        expectedVersion: 1,
      },
      context(participant.id)
    )
    expect(reset.interval).toBe(1)
    expect(reset.correctCountStreak).toBe(0)

    const revised = await updatePersonalElement(
      {
        id: element!.id,
        expectedVersion: 1,
        content: 'What is the value of the next-best alternative? ',
      },
      context(participant.id)
    )
    expect(revised.version).toBe(2)
    expect(revised.content).toBe(
      'What is the value of the next-best alternative?'
    )
    const revisedSources = [
      {
        sourceId: 'updated-source',
        kind: 'DOCUMENT' as const,
        title: 'Updated notes',
        chunkIds: ['updated-chunk'],
        locators: [{ type: 'PAGE_RANGE' as const, pageFrom: 7, pageTo: 9 }],
      },
    ]
    const revisionLinkage = await createPersistedRevisionAttempt(
      fixture,
      revised,
      { sources: revisedSources }
    )
    const revisedWithSources = await applyPersonalElementRevision(
      revisionLinkage,
      context(participant.id)
    )
    expect(revisedWithSources.version).toBe(3)
    expect(revisedWithSources.sources).toEqual(revisedSources)
    await expect(
      updatePersonalElement(
        { id: element!.id, expectedVersion: 1, content: 'stale' },
        context(participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENT_VERSION_CONFLICT' },
    })
  })

  it('resets learning state for semantic revisions but not title edits', async () => {
    const { course, participant } = await createFixture()
    const [element] = await createPersonalElements(
      { courseId: course.id, candidates: [candidate()] },
      context(participant.id)
    )
    await respondToPersonalElement(
      {
        id: element!.id,
        response: FlashcardCorrectness.CORRECT,
        expectedVersion: 1,
      },
      context(participant.id)
    )

    const revised = await updatePersonalElement(
      {
        id: element!.id,
        expectedVersion: 1,
        content: 'What is the value of the next-best alternative?',
      },
      context(participant.id)
    )
    expect(revised.version).toBe(2)
    expectNewLearningState(revised)

    const answered = await respondToPersonalElement(
      {
        id: element!.id,
        response: FlashcardCorrectness.CORRECT,
        expectedVersion: 2,
      },
      context(participant.id)
    )
    const renamed = await updatePersonalElement(
      { id: element!.id, expectedVersion: 2, name: 'Alternative cost' },
      context(participant.id)
    )
    expect(renamed.version).toBe(2)
    expect(renamed.name).toBe('Alternative cost')
    expect(renamed.interval).toBe(answered.interval)
    expect(renamed.correctCountStreak).toBe(answered.correctCountStreak)
    expect(renamed.correctCount).toBe(answered.correctCount)
    expect(renamed.nextDueAt).toEqual(answered.nextDueAt)
  })

  it('treats explicit null fields as not provided on update', async () => {
    const { course, participant } = await createFixture()
    const [element] = await createPersonalElements(
      { courseId: course.id, candidates: [candidate()] },
      context(participant.id)
    )

    const renamed = await updatePersonalElement(
      {
        id: element!.id,
        expectedVersion: 1,
        content: null,
        explanation: null,
        name: 'Renamed card',
      },
      context(participant.id)
    )
    expect(renamed.version).toBe(1)
    expect(renamed.name).toBe('Renamed card')
    expect(renamed.sources).toEqual(element!.sources)
  })

  it('resets learning state when explanation or sources change', async () => {
    const fixture = await createFixture()
    const { course, participant } = fixture
    const input = candidate()
    const [element] = await createPersonalElements(
      { courseId: course.id, candidates: [input] },
      context(participant.id)
    )
    await respondToPersonalElement(
      {
        id: element!.id,
        response: FlashcardCorrectness.PARTIAL,
        expectedVersion: 1,
      },
      context(participant.id)
    )

    const explanationRevision = await updatePersonalElement(
      {
        id: element!.id,
        expectedVersion: 1,
        explanation: 'The best alternative that was not chosen.',
      },
      context(participant.id)
    )
    expect(explanationRevision.version).toBe(2)
    expectNewLearningState(explanationRevision)

    await respondToPersonalElement(
      {
        id: element!.id,
        response: FlashcardCorrectness.PARTIAL,
        expectedVersion: 2,
      },
      context(participant.id)
    )
    const updatedChunkId = randomUUID()
    const updatedSources = [
      {
        sourceId: 'course-material',
        kind: 'DOCUMENT' as const,
        title: 'Updated economics notes',
        chunkIds: [updatedChunkId],
        locators: [{ type: 'PAGE_RANGE' as const, pageFrom: 7, pageTo: 9 }],
      },
    ]
    const revisionLinkage = await createPersistedRevisionAttempt(
      fixture,
      explanationRevision,
      { sources: updatedSources }
    )
    const revised = await applyPersonalElementRevision(
      revisionLinkage,
      context(participant.id)
    )

    expect(revised.version).toBe(3)
    expect(revised.sources).toHaveLength(1)
    expect(revised.sources?.[0]).toMatchObject({
      sourceId: 'course-material',
      title: 'Updated economics notes',
    })
    expect(revised.sources?.[0]?.chunkIds).not.toEqual(
      input.sources[0]?.chunkIds
    )
    expectNewLearningState(revised)

    const unchanged = await applyPersonalElementRevision(
      revisionLinkage,
      context(participant.id)
    )
    expect(unchanged.version).toBe(3)
    expect(unchanged.interval).toBe(revised.interval)
    expect(unchanged.partialCorrectCount).toBe(revised.partialCorrectCount)
    expect(unchanged.lastResponseCorrectness).toBe(
      revised.lastResponseCorrectness
    )
  })

  it('rejects a response that races with a revision without changing state', async () => {
    const { course, participant } = await createFixture()
    const [element] = await createPersonalElements(
      { courseId: course.id, candidates: [candidate()] },
      context(participant.id)
    )

    let releaseUpdate!: () => void
    let signalUpdateStarted!: () => void
    let updateStarted = false
    const updateBarrier = new Promise<void>((resolve) => {
      releaseUpdate = resolve
    })
    const updateCallStarted = new Promise<void>((resolve) => {
      signalUpdateStarted = resolve
    })
    const concurrentPrisma = prisma.$extends({
      query: {
        personalElement: {
          async updateMany({ args, query }) {
            if (!updateStarted) {
              updateStarted = true
              signalUpdateStarted()
              await updateBarrier
            }
            return query(args)
          },
        },
      },
    }) as unknown as PrismaClient

    const response = respondToPersonalElement(
      {
        id: element!.id,
        response: FlashcardCorrectness.CORRECT,
        expectedVersion: 1,
      },
      { prisma: concurrentPrisma, participantId: participant.id }
    )
    // The response transaction has read version 1 and is paused immediately
    // before its conditional scheduling write.
    await updateCallStarted
    const revised = await updatePersonalElement(
      { id: element!.id, expectedVersion: 1, content: 'Revised prompt' },
      context(participant.id)
    )
    releaseUpdate()

    await expect(response).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENT_VERSION_CONFLICT' },
    })

    const persisted = await prisma.personalElement.findUnique({
      where: { id: element!.id },
    })
    expect(persisted?.version).toBe(revised.version)
    expect(persisted?.correctCount).toBe(0)
    expect(persisted?.correctCountStreak).toBe(0)
    expect(persisted?.nextDueAt).toBeNull()
    expect(persisted?.lastAnsweredAt).toBeNull()
    expect(persisted?.lastResponseCorrectness).toBeNull()
  })

  it('serializes concurrent saves at the course cap', async () => {
    const { course, participant } = await createFixture()
    const batches = Array.from({ length: 16 }, () =>
      Array.from({ length: 32 }, () => candidate())
    )
    const results = await Promise.allSettled(
      batches.map((candidates) =>
        createPersonalElements(
          { courseId: course.id, candidates },
          context(participant.id)
        )
      )
    )
    const count = await prisma.personalElement.count({
      where: { courseId: course.id, participantId: participant.id },
    })

    expect(count).toBeLessThanOrEqual(500)
    expect(results.some((result) => result.status === 'rejected')).toBe(true)
  })

  it('lists due cards first and deletes only an owned card', async () => {
    const { course, participant } = await createFixture()
    const [first] = await createPersonalElements(
      { courseId: course.id, candidates: [candidate()] },
      context(participant.id)
    )
    const [second] = await createPersonalElements(
      { courseId: course.id, candidates: [candidate({ name: 'Sunk cost' })] },
      context(participant.id)
    )
    await prisma.personalElement.update({
      where: { id: second!.id },
      data: { nextDueAt: new Date(Date.now() - 1000) },
    })
    const listed = await listPersonalElements(
      { courseId: course.id },
      context(participant.id)
    )
    expect(listed[0]?.id).toBe(first!.id)
    expect(listed[1]?.id).toBe(second!.id)
    await deletePersonalElement({ id: first!.id }, context(participant.id))
    expect(
      await prisma.personalElement.findUnique({ where: { id: first!.id } })
    ).toBeNull()
  })

  it('loads saved state only for the requested candidate IDs', async () => {
    const { course, participant } = await createFixture()
    const [requested, unrelated] = await createPersonalElements(
      {
        courseId: course.id,
        candidates: [
          candidate({ name: 'Requested card' }),
          candidate({ name: 'Unrelated card' }),
        ],
      },
      context(participant.id)
    )

    await expect(
      listSavedPersonalElementCandidateIds(
        {
          courseId: course.id,
          candidateIds: [requested!.candidateId, randomUUID()],
        },
        context(participant.id)
      )
    ).resolves.toEqual([requested!.candidateId])
    expect(unrelated!.candidateId).not.toBe(requested!.candidateId)
  })

  it('rejects a save whose title duplicates a saved card', async () => {
    const { course, participant } = await createFixture()
    await createPersonalElements(
      {
        courseId: course.id,
        candidates: [candidate({ name: 'Opportunity cost' })],
      },
      context(participant.id)
    )

    await expect(
      createPersonalElements(
        {
          courseId: course.id,
          candidates: [candidate({ name: 'Opportunity cost' })],
        },
        context(participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_DUPLICATE_TITLE' },
    })
    expect(
      await prisma.personalElement.count({
        where: { participantId: participant.id, courseId: course.id },
      })
    ).toBe(1)
  })

  it('rejects a batch atomically when one title duplicates a saved card', async () => {
    const { course, participant } = await createFixture()
    await createPersonalElements(
      {
        courseId: course.id,
        candidates: [candidate({ name: 'Opportunity cost' })],
      },
      context(participant.id)
    )

    await expect(
      createPersonalElements(
        {
          courseId: course.id,
          candidates: [
            candidate({ name: 'Sunk cost' }),
            candidate({ name: 'Opportunity cost' }),
          ],
        },
        context(participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_DUPLICATE_TITLE' },
    })
    expect(
      await prisma.personalElement.count({
        where: { participantId: participant.id, courseId: course.id },
      })
    ).toBe(1)
  })

  it('allows same-title candidates within one batch', async () => {
    const { course, participant } = await createFixture()
    const elements = await createPersonalElements(
      {
        courseId: course.id,
        candidates: [candidate(), candidate()],
      },
      context(participant.id)
    )
    expect(elements).toHaveLength(2)
  })

  it('screens a new candidate against an existing card re-saved in the same batch', async () => {
    const { course, participant } = await createFixture()
    const [saved] = await createPersonalElements(
      {
        courseId: course.id,
        candidates: [candidate({ name: 'Opportunity cost' })],
      },
      context(participant.id)
    )

    await expect(
      createPersonalElements(
        {
          courseId: course.id,
          candidates: [
            candidate({
              candidateId: saved!.candidateId!,
              name: 'Opportunity cost',
            }),
            candidate({ name: 'Opportunity cost' }),
          ],
        },
        context(participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_DUPLICATE_TITLE' },
    })
    expect(
      await prisma.personalElement.count({
        where: { participantId: participant.id, courseId: course.id },
      })
    ).toBe(1)
  })

  it('rejects exactly one of two concurrent saves with the same title', async () => {
    const { course, participant } = await createFixture()
    const results = await Promise.allSettled([
      createPersonalElements(
        { courseId: course.id, candidates: [candidate()] },
        context(participant.id)
      ),
      createPersonalElements(
        { courseId: course.id, candidates: [candidate()] },
        context(participant.id)
      ),
    ])

    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1)
    const rejected = results.find((result) => result.status === 'rejected')
    expect(rejected).toBeDefined()
    if (rejected && rejected.status === 'rejected') {
      expect(rejected.reason).toMatchObject({
        extensions: { code: 'PERSONAL_ELEMENTS_DUPLICATE_TITLE' },
      })
    }
    expect(
      await prisma.personalElement.count({
        where: { participantId: participant.id, courseId: course.id },
      })
    ).toBe(1)
  })

  it('persists a discard idempotently', async () => {
    const fixture = await createFixture()
    const attempt = await createGeneratedCandidateAttempt(fixture, {
      persisted: true,
    })
    await discardPersonalElementCandidate(
      attempt.linkage,
      context(fixture.participant.id)
    )
    await discardPersonalElementCandidate(
      attempt.linkage,
      context(fixture.participant.id)
    )
    expect(
      await prisma.personalElementDiscard.count({
        where: {
          participantId: fixture.participant.id,
          courseId: fixture.course.id,
          candidateId: attempt.generated.candidateId,
        },
      })
    ).toBe(1)
  })

  it('rejects discard before a generated candidate is persisted', async () => {
    const fixture = await createFixture()
    const attempt = await createGeneratedCandidateAttempt(fixture)

    await expect(
      discardPersonalElementCandidate(
        attempt.linkage,
        context(fixture.participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_CANDIDATE_NOT_FOUND' },
    })
    expect(
      await prisma.personalElementDiscard.count({
        where: { participantId: fixture.participant.id },
      })
    ).toBe(0)
  })

  it('denies revision of a card owned by another participant', async () => {
    const { course, participant } = await createFixture()
    const [element] = await createPersonalElements(
      { courseId: course.id, candidates: [candidate()] },
      context(participant.id)
    )

    await expect(
      updatePersonalElement(
        { id: element!.id, expectedVersion: 1, name: 'Renamed' },
        context(randomUUID())
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENT_NOT_FOUND' },
    })
  })

  it('prepares a card plan with course language and the complete title list', async () => {
    const { course, participant } = await createFixture()
    await createPersonalElements(
      {
        courseId: course.id,
        candidates: [candidate({ name: 'Opportunity cost' })],
      },
      context(participant.id)
    )

    const plan = await prepareCardPlan(
      {
        courseId: course.id,
        topic: 'Economics',
        cards: [
          {
            type: 'FLASHCARD',
            title: 'Sunk cost',
            intent: 'Define sunk cost',
            query: 'sunk cost definition',
          },
        ],
      },
      context(participant.id)
    )

    expect(plan.courseLanguage).toBe('en')
    expect(plan.planId).toMatch(/^[0-9a-f-]{36}$/)
    expect(plan.existingTitles).toEqual(['Opportunity cost'])
    expect(plan.cards).toHaveLength(1)
    expect(plan.cards[0]).toMatchObject({
      type: 'FLASHCARD',
      title: 'Sunk cost',
      intent: 'Define sunk cost',
      query: 'sunk cost definition',
    })
    expect(plan.discardedDuplicates).toEqual([])
  })

  it('loads only the narrow backend-owned generation context', async () => {
    const { course, participant } = await createFixture()
    await createPersonalElements(
      {
        courseId: course.id,
        candidates: [candidate({ name: 'Opportunity cost' })],
      },
      context(participant.id)
    )

    await expect(
      getPersonalElementGenerationContext(course.id, context(participant.id))
    ).resolves.toEqual({
      courseLanguage: 'en',
      existingTitles: ['Opportunity cost'],
    })
  })

  it('screens duplicate titles within the proposal and against saved cards', async () => {
    const { course, participant } = await createFixture()
    await createPersonalElements(
      {
        courseId: course.id,
        candidates: [candidate({ name: 'Opportunity cost' })],
      },
      context(participant.id)
    )

    const plan = await prepareCardPlan(
      {
        courseId: course.id,
        topic: 'Economics',
        cards: [
          {
            type: 'FLASHCARD',
            title: 'Opportunity cost',
            intent: 'Define opportunity cost',
            query: 'opportunity cost definition',
          },
          {
            type: 'FLASHCARD',
            title: 'Sunk cost',
            intent: 'Define sunk cost',
            query: 'sunk cost definition',
          },
          {
            type: 'FLASHCARD',
            title: 'Sunk cost',
            intent: 'Explain the sunk cost fallacy',
            query: 'sunk cost fallacy',
          },
        ],
      },
      context(participant.id)
    )

    expect(plan.cards.map((card) => card.title)).toEqual(['Sunk cost'])
    expect(plan.discardedDuplicates).toHaveLength(2)
    expect(plan.discardedDuplicates[0]).toMatchObject({
      title: 'Opportunity cost',
      matchedTitle: 'Opportunity cost',
    })
    expect(plan.discardedDuplicates[1]).toMatchObject({
      title: 'Sunk cost',
      matchedTitle: 'Sunk cost',
    })
  })

  it('assigns stable server-issued candidate identities', async () => {
    const { course, participant } = await createFixture()
    const plan = await prepareCardPlan(
      {
        courseId: course.id,
        topic: 'Economics',
        cards: [
          {
            type: 'FLASHCARD',
            title: 'Sunk cost',
            intent: 'Define sunk cost',
            query: 'sunk cost definition',
          },
          {
            type: 'FLASHCARD',
            title: 'Marginal cost',
            intent: 'Define marginal cost',
            query: 'marginal cost definition',
          },
        ],
      },
      context(participant.id)
    )

    expect(plan.cards).toHaveLength(2)
    const [first, second] = plan.cards
    expect(first?.candidateId).toMatch(/^[0-9a-f-]{36}:card-1$/)
    expect(second?.candidateId).toMatch(/^[0-9a-f-]{36}:card-2$/)
    expect(first?.candidateId).not.toBe(second?.candidateId)
  })

  it('denies card plan preparation to non-participating participants', async () => {
    const { course } = await createFixture()

    await expect(
      prepareCardPlan(
        {
          courseId: course.id,
          topic: 'Economics',
          cards: [
            {
              type: 'FLASHCARD',
              title: 'Sunk cost',
              intent: 'Define sunk cost',
              query: 'sunk cost definition',
            },
          ],
        },
        context(randomUUID())
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_NOT_PARTICIPATING' },
    })
  })

  it('validates a structurally sound candidate with owned sources', async () => {
    const fixture = await createFixture()
    const { generated } = await createGeneratedCandidateAttempt(fixture)
    const result = await validateCardCandidate(
      {
        courseId: fixture.course.id,
        candidateId: generated.candidateId,
        title: generated.name,
        front: generated.content,
        back: generated.explanation,
        sources: generated.sources,
        sourceMessageId: generated.sourceMessageId,
        sourceToolCallId: generated.sourceToolCallId,
      },
      context(fixture.participant.id)
    )
    expect(result).toBe(true)
  })

  it('saves a persisted generated card from linkage only', async () => {
    const fixture = await createFixture()
    const attempt = await createGeneratedCandidateAttempt(fixture, {
      persisted: true,
    })

    const saved = await savePersonalElementCandidate(
      attempt.linkage,
      context(fixture.participant.id)
    )
    expect(saved).toMatchObject({
      candidateId: attempt.generated.candidateId,
      name: attempt.generated.name,
      content: attempt.generated.content,
      explanation: attempt.generated.explanation,
      sourceMessageId: attempt.linkage.messageId,
      sourceToolCallId: attempt.linkage.toolCallId,
    })
  })

  it('rejects candidate decisions after the chatbot is paused', async () => {
    const fixture = await createFixture()
    const attempt = await createGeneratedCandidateAttempt(fixture, {
      persisted: true,
    })
    await prisma.chatbot.update({
      where: { id: fixture.chatbot.id },
      data: { status: ChatbotStatus.PAUSED },
    })

    await expect(
      savePersonalElementCandidate(
        attempt.linkage,
        context(fixture.participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_CANDIDATE_NOT_FOUND' },
    })
    await expect(
      discardPersonalElementCandidate(
        attempt.linkage,
        context(fixture.participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_CANDIDATE_NOT_FOUND' },
    })
    expect(
      await prisma.personalElement.count({
        where: { participantId: fixture.participant.id },
      })
    ).toBe(0)
    expect(
      await prisma.personalElementDiscard.count({
        where: { participantId: fixture.participant.id },
      })
    ).toBe(0)
  })

  it('rejects forged generated-card linkage before saving', async () => {
    const fixture = await createFixture()
    const attempt = await createGeneratedCandidateAttempt(fixture, {
      persisted: true,
    })

    await expect(
      savePersonalElementCandidate(
        { ...attempt.linkage, candidateId: randomUUID() },
        context(fixture.participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_CANDIDATE_LINKAGE_INVALID' },
    })
    expect(
      await prisma.personalElement.count({
        where: {
          participantId: fixture.participant.id,
          courseId: fixture.course.id,
        },
      })
    ).toBe(0)
  })

  it('rejects a candidate whose source message is not owned by the participant', async () => {
    const { course, participant } = await createFixture()
    await expect(
      validateCardCandidate(
        {
          courseId: course.id,
          candidateId: randomUUID(),
          title: 'Opportunity cost',
          front: 'What is opportunity cost?',
          back: 'The value of the best alternative forgone.',
          sources: [
            {
              sourceId: 'course-material',
              chunkId: randomUUID(),
              title: 'Economics notes',
            },
          ],
          sourceMessageId: randomUUID(),
          sourceToolCallId: 'tool-' + randomUUID(),
        },
        context(participant.id)
      )
    ).rejects.toMatchObject({
      extensions: {
        code: 'PERSONAL_ELEMENTS_CANDIDATE_LINKAGE_INVALID',
      },
    })
  })

  it('rejects a candidate whose title duplicates a saved card', async () => {
    const fixture = await createFixture()
    const { course, participant } = fixture
    await createPersonalElements(
      {
        courseId: course.id,
        candidates: [candidate({ name: 'Opportunity cost' })],
      },
      context(participant.id)
    )
    const { generated } = await createGeneratedCandidateAttempt(fixture)

    await expect(
      validateCardCandidate(
        {
          courseId: course.id,
          candidateId: generated.candidateId,
          title: generated.name,
          front: generated.content,
          back: generated.explanation,
          sources: generated.sources,
          sourceMessageId: generated.sourceMessageId,
          sourceToolCallId: generated.sourceToolCallId,
        },
        context(participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_DUPLICATE_TITLE' },
    })
  })

  it('rejects candidates with excessive or duplicate sources', async () => {
    const { course, participant, planMessage } = await createFixture()
    const base = {
      courseId: course.id,
      candidateId: randomUUID(),
      title: 'Opportunity cost',
      front: 'What is opportunity cost?',
      back: 'The value of the best alternative forgone.',
      sources: [
        {
          sourceId: 'course-material',
          chunkId: randomUUID(),
          title: 'Economics notes',
        },
      ],
      sourceMessageId: planMessage.id,
      sourceToolCallId: 'tool-' + randomUUID(),
    }

    await expect(
      validateCardCandidate(
        {
          ...base,
          sources: Array.from({ length: 33 }, (_, index) => ({
            sourceId: 'source-' + index,
            chunkId: randomUUID(),
            title: 'Economics notes',
          })),
        },
        context(participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_INVALID_INPUT' },
    })

    const chunkId = randomUUID()
    await expect(
      validateCardCandidate(
        {
          ...base,
          sources: [
            { sourceId: 'a', chunkId, title: 'Notes' },
            { sourceId: 'b', chunkId, title: 'Notes' },
          ],
        },
        context(participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_INVALID_INPUT' },
    })
  })

  it('rejects candidates with raw-text metadata or oversized backs', async () => {
    const { course, participant, planMessage } = await createFixture()
    const base = {
      courseId: course.id,
      candidateId: randomUUID(),
      title: 'Opportunity cost',
      front: 'What is opportunity cost?',
      back: 'The value of the best alternative forgone.',
      sources: [
        {
          sourceId: 'course-material',
          chunkId: randomUUID(),
          title: 'Economics notes',
        },
      ],
      sourceMessageId: planMessage.id,
      sourceToolCallId: 'tool-' + randomUUID(),
    }

    await expect(
      validateCardCandidate(
        {
          ...base,
          sources: [
            {
              sourceId: 'course-material',
              chunkId: randomUUID(),
              title: 'Economics notes',
              metadata: { text: 'raw chunk content' },
            },
          ],
        },
        context(participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_INVALID_INPUT' },
    })

    await expect(
      validateCardCandidate(
        {
          ...base,
          back: 'x'.repeat(8_193),
        },
        context(participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_INVALID_INPUT' },
    })
  })

  it('rejects candidates with aggregate source metadata over 64 KiB', async () => {
    const { course, participant, planMessage } = await createFixture()

    await expect(
      validateCardCandidate(
        {
          courseId: course.id,
          candidateId: randomUUID(),
          title: 'Opportunity cost',
          front: 'What is opportunity cost?',
          back: 'The value of the best alternative forgone.',
          sources: [
            {
              sourceId: 'course-material',
              chunkId: randomUUID(),
              title: 'Economics notes',
              metadata: { note: 'x'.repeat(70_000) },
            },
          ],
          sourceMessageId: planMessage.id,
          sourceToolCallId: 'tool-' + randomUUID(),
        },
        context(participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_INVALID_INPUT' },
    })
  })

  it('rejects a candidate with a non-FLASHCARD type in the plan', async () => {
    const { course } = await createFixture()

    await expect(
      prepareCardPlan(
        {
          courseId: course.id,
          topic: 'Economics',
          cards: [
            {
              type: 'MC',
              title: 'Sunk cost',
              intent: 'Define sunk cost',
              query: 'sunk cost definition',
            },
          ],
        },
        context(randomUUID())
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_INVALID_INPUT' },
    })
  })

  it('rejects a plan with more than five cards', async () => {
    const { course } = await createFixture()

    await expect(
      prepareCardPlan(
        {
          courseId: course.id,
          topic: 'Economics',
          cards: Array.from({ length: 6 }, (_, index) => ({
            type: 'FLASHCARD',
            title: 'Card ' + index,
            intent: 'Define card ' + index,
            query: 'card ' + index + ' definition',
          })),
        },
        context(randomUUID())
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_INVALID_INPUT' },
    })
  })
})
