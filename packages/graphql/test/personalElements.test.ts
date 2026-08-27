import { randomUUID } from 'node:crypto'
import { prisma } from '@klicker-uzh/prisma'
import {
  ElementType,
  type PersonalElement,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import { FlashcardCorrectness } from '@klicker-uzh/types'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  abortCardGenerationLease,
  claimCardGenerationLease,
  completeCardGenerationLease,
  createPersonalElements,
  deletePersonalElement,
  discardPersonalElementCandidate,
  listPersonalElements,
  respondToPersonalElement,
  updatePersonalElement,
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
        chunkId: randomUUID(),
        title: 'Economics notes',
        url: 'https://example.org/economics',
        page: 4,
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

  it('rejects the provenance-only generated-card explanation', async () => {
    const { course, participant } = await createFixture()

    await expect(
      createPersonalElements(
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
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_INVALID_INPUT' },
    })

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

  it('rejects the provenance-only explanation during card updates', async () => {
    const { course, participant } = await createFixture()
    const [element] = await createPersonalElements(
      { courseId: course.id, candidates: [candidate()] },
      context(participant.id)
    )

    await expect(
      updatePersonalElement(
        {
          id: element!.id,
          expectedVersion: element!.version,
          explanation:
            'Die Flashcard verwendet ausschließlich die Informationen aus dem bereitgestellten Chunk.',
        },
        context(participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_INVALID_INPUT' },
    })

    await expect(
      updatePersonalElement(
        {
          id: element!.id,
          expectedVersion: element!.version,
          explanation: 'This card uses only the supplied evidence.',
        },
        context(participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PERSONAL_ELEMENTS_INVALID_INPUT' },
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
    const { course, participant } = await createFixture()
    const savedInput = candidate()
    const discardedInput = candidate({
      candidateId: savedInput.candidateId,
      sourceMessageId: randomUUID(),
      sourceToolCallId: `retry-tool-${randomUUID()}`,
    })

    const results = await Promise.allSettled([
      createPersonalElements(
        { courseId: course.id, candidates: [savedInput] },
        context(participant.id)
      ),
      discardPersonalElementCandidate(
        {
          courseId: course.id,
          candidateId: discardedInput.candidateId,
        },
        context(participant.id)
      ),
    ])

    const saved = await prisma.personalElement.count({
      where: {
        participantId: participant.id,
        courseId: course.id,
        candidateId: savedInput.candidateId,
      },
    })
    const discarded = await prisma.personalElementDiscard.count({
      where: {
        participantId: participant.id,
        courseId: course.id,
        candidateId: savedInput.candidateId,
      },
    })

    expect(saved + discarded).toBe(1)
    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1)
  })

  it('treats the plan candidate ID as stable across generation attempts', async () => {
    const { course, participant } = await createFixture()
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

    const discardedAttempt = candidate({
      candidateId: randomUUID(),
      sourceMessageId: randomUUID(),
      sourceToolCallId: `discard-tool-${randomUUID()}`,
    })
    await discardPersonalElementCandidate(
      {
        courseId: course.id,
        candidateId: discardedAttempt.candidateId,
      },
      context(participant.id)
    )
    await expect(
      createPersonalElements(
        {
          courseId: course.id,
          candidates: [
            candidate({
              candidateId: discardedAttempt.candidateId,
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
    const { participant, planMessage } = await createFixture()
    const key = {
      planMessageId: planMessage.id,
      planToolCallId: `plan-${randomUUID()}`,
    }
    const claims = await Promise.allSettled([
      claimCardGenerationLease(
        { ...key, attemptToken: `attempt-${randomUUID()}` },
        context(participant.id)
      ),
      claimCardGenerationLease(
        { ...key, attemptToken: `attempt-${randomUUID()}` },
        context(participant.id)
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
        where: { participantId: participant.id },
      })
    ).toBe(1)
  })

  it('reclaims an expired lease once and protects the new owner', async () => {
    const { participant, planMessage } = await createFixture()
    const key = {
      planMessageId: planMessage.id,
      planToolCallId: `plan-${randomUUID()}`,
    }
    const staleAttemptToken = `attempt-${randomUUID()}`
    const initial = await claimCardGenerationLease(
      { ...key, attemptToken: staleAttemptToken },
      context(participant.id)
    )
    await prisma.cardGenerationLease.update({
      where: { id: initial.id },
      data: { leaseExpiresAt: new Date(Date.now() - 1_000) },
    })

    const attemptTokens = [`attempt-${randomUUID()}`, `attempt-${randomUUID()}`]
    const reclaims = await Promise.allSettled(
      attemptTokens.map((attemptToken) =>
        claimCardGenerationLease(
          { ...key, attemptToken },
          context(participant.id)
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
        context(participant.id)
      )
    ).toBe(false)
    expect(
      await completeCardGenerationLease(
        initial.id,
        staleAttemptToken,
        context(participant.id)
      )
    ).toBe(false)

    const current = await prisma.cardGenerationLease.findUniqueOrThrow({
      where: { id: initial.id },
    })
    expect(current.attemptToken).not.toBe(staleAttemptToken)
    expect(
      await completeCardGenerationLease(
        current.id,
        current.attemptToken,
        context(participant.id)
      )
    ).toBe(true)
    await expect(
      claimCardGenerationLease(
        { ...key, attemptToken: `attempt-${randomUUID()}` },
        context(participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'CARD_GENERATION_ALREADY_COMPLETED' },
    })
  })

  it('releases an aborted lease for retry', async () => {
    const { participant, planMessage } = await createFixture()
    const key = {
      planMessageId: planMessage.id,
      planToolCallId: `plan-${randomUUID()}`,
    }
    const attemptToken = `attempt-${randomUUID()}`
    const lease = await claimCardGenerationLease(
      { ...key, attemptToken },
      context(participant.id)
    )
    expect(
      await abortCardGenerationLease(
        lease.id,
        attemptToken,
        context(participant.id)
      )
    ).toBe(true)
    expect(
      await completeCardGenerationLease(
        lease.id,
        attemptToken,
        context(participant.id)
      )
    ).toBe(false)

    const retry = await claimCardGenerationLease(
      { ...key, attemptToken: `attempt-${randomUUID()}` },
      context(participant.id)
    )
    expect(retry.id).toBe(lease.id)
  })

  it('does not complete an expired lease', async () => {
    const { participant, planMessage } = await createFixture()
    const lease = await claimCardGenerationLease(
      {
        planMessageId: planMessage.id,
        planToolCallId: `plan-${randomUUID()}`,
        attemptToken: `attempt-${randomUUID()}`,
      },
      context(participant.id)
    )
    await prisma.cardGenerationLease.update({
      where: { id: lease.id },
      data: { leaseExpiresAt: new Date(Date.now() - 1_000) },
    })

    expect(
      await completeCardGenerationLease(
        lease.id,
        lease.attemptToken,
        context(participant.id)
      )
    ).toBe(false)
  })

  it('progresses SM-2 and guards revisions by version', async () => {
    const { course, participant } = await createFixture()
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
        chunkId: 'updated-chunk',
        title: 'Updated notes',
      },
    ]
    const revisedWithSources = await updatePersonalElement(
      {
        id: element!.id,
        expectedVersion: 2,
        sources: revisedSources,
      },
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

  it('resets learning state when explanation or sources change', async () => {
    const { course, participant } = await createFixture()
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
    const revised = await updatePersonalElement(
      {
        id: element!.id,
        expectedVersion: 2,
        sources: [
          {
            sourceId: 'course-material',
            chunkId: updatedChunkId,
            title: 'Updated economics notes',
          },
        ],
      },
      context(participant.id)
    )

    expect(revised.version).toBe(3)
    expect(revised.sources).toHaveLength(1)
    expect(revised.sources?.[0]).toMatchObject({
      sourceId: 'course-material',
      title: 'Updated economics notes',
    })
    expect(revised.sources?.[0]?.chunkId).not.toBe(input.sources[0]?.chunkId)
    expectNewLearningState(revised)

    const sameSources = [
      {
        title: 'Updated economics notes',
        chunkId: updatedChunkId,
        sourceId: 'course-material',
      },
    ]
    const unchanged = await updatePersonalElement(
      { id: element!.id, expectedVersion: 3, sources: sameSources },
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
      { courseId: course.id, candidates: [candidate()] },
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
})
