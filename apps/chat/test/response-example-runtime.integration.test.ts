import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import {
  KBResourceStatus,
  KBResourceType,
  ResponseExampleStatus,
  ResponseExampleStyle,
} from '@klicker-uzh/prisma/client'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { loadResponseExampleRuntimeSkill } from '../src/lib/server/responseExampleRuntime'

const describePostgres =
  process.env.CHAT_RESPONSE_EXAMPLE_INTEGRATION === '1'
    ? describe
    : describe.skip
const OWNER_ID = randomUUID()
const COURSE_ID = randomUUID()
const CHATBOT_ID = randomUUID()
const KB_ID = randomUUID()
const SET_ID = randomUUID()
const FIXED_UPDATED_AT = new Date('2026-08-28T12:00:00.000Z')
const TEST_KEY = `response-runtime-${OWNER_ID.slice(0, 8)}`

let prisma: PrismaClient

async function cleanup() {
  await prisma.user.deleteMany({ where: { id: OWNER_ID } })
}

describePostgres('response-example PostgreSQL runtime', () => {
  beforeAll(async () => {
    ;({ prisma } = await import('@klicker-uzh/prisma'))
    await prisma.$connect()
    await cleanup()
    await prisma.user.create({
      data: {
        id: OWNER_ID,
        email: `${TEST_KEY}@example.invalid`,
        shortname: TEST_KEY,
      },
    })
    await prisma.course.create({
      data: {
        id: COURSE_ID,
        name: TEST_KEY,
        displayName: 'Synthetic response runtime course',
        authType: 'SSO',
        startDate: FIXED_UPDATED_AT,
        endDate: new Date('2027-08-28T12:00:00.000Z'),
        groupDeadlineDate: new Date('2027-02-28T12:00:00.000Z'),
        ownerId: OWNER_ID,
      },
    })
    await prisma.chatbot.create({
      data: {
        id: CHATBOT_ID,
        name: 'Synthetic response runtime chatbot',
        ownerId: OWNER_ID,
        courseId: COURSE_ID,
        systemPrompts: {
          tutor: { prompt: 'Tutor prompt' },
          explainer: { prompt: 'Explainer prompt' },
        },
      },
    })
    await prisma.kB.create({
      data: { id: KB_ID, name: 'Synthetic runtime KB', ownerId: OWNER_ID },
    })
    await prisma.kBChatbot.create({
      data: { kbId: KB_ID, chatbotId: CHATBOT_ID, isEnabled: true },
    })
    await prisma.responseExampleSet.create({
      data: { id: SET_ID, chatbotId: CHATBOT_ID },
    })
  }, 60_000)

  afterAll(async () => {
    if (!prisma) return
    await cleanup()
    await prisma.$disconnect()
  }, 60_000)

  async function createApprovedExample(args: {
    kbId?: string
    setId?: string
    chatMode?: string
    studentMessage: string
    referenceAnswer: string
    updatedAt?: Date
  }) {
    const contentHash = `hash-${randomUUID()}`
    const resource = await prisma.kBResource.create({
      data: {
        kbId: args.kbId ?? KB_ID,
        type: KBResourceType.URL,
        title: `Runtime source ${args.studentMessage}`,
        sourceUrl: 'https://example.invalid/runtime',
        status: KBResourceStatus.READY,
        activeResourceVersion: 1,
        activeContentSha256: contentHash,
      },
    })
    return await prisma.responseExample.create({
      data: {
        setId: args.setId ?? SET_ID,
        chatMode: args.chatMode ?? 'tutor',
        studentMessage: args.studentMessage,
        referenceAnswer: args.referenceAnswer,
        responseStyle: ResponseExampleStyle.GUIDED_QUESTIONS,
        status: ResponseExampleStatus.APPROVED,
        updatedAt: args.updatedAt ?? FIXED_UPDATED_AT,
        evidenceReferences: {
          create: {
            citationIndex: 1,
            sourceId: resource.id,
            chunkId: `chunk-${randomUUID()}`,
            contentHash,
            citationAnchor: `anchor-${args.studentMessage}`,
            evidenceEligible: true,
          },
        },
      },
    })
  }

  test('ranks only the exact chatbot and mode with stable bounded results', async () => {
    const questionMatch = await createApprovedExample({
      studentMessage: 'portfolio diversification',
      referenceAnswer: 'Use the lecturer-approved structure [1].',
      updatedAt: new Date('2026-08-28T11:00:00.000Z'),
    })
    const answerMatch = await createApprovedExample({
      studentMessage: 'unrelated current question',
      referenceAnswer: 'Explain portfolio diversification carefully [1].',
      updatedAt: new Date('2026-08-28T13:00:00.000Z'),
    })
    await createApprovedExample({
      chatMode: 'explainer',
      studentMessage: 'portfolio diversification excluded mode',
      referenceAnswer: 'This must stay outside tutor mode [1].',
    })

    const foreignChatbotId = randomUUID()
    const foreignKbId = randomUUID()
    const foreignSetId = randomUUID()
    await prisma.chatbot.create({
      data: {
        id: foreignChatbotId,
        name: 'Foreign runtime chatbot',
        courseId: COURSE_ID,
        ownerId: OWNER_ID,
        systemPrompts: { tutor: { prompt: 'Tutor prompt' } },
      },
    })
    await prisma.kB.create({
      data: {
        id: foreignKbId,
        name: 'Foreign runtime KB',
        ownerId: OWNER_ID,
      },
    })
    await prisma.kBChatbot.create({
      data: {
        kbId: foreignKbId,
        chatbotId: foreignChatbotId,
        isEnabled: true,
      },
    })
    await prisma.responseExampleSet.create({
      data: { id: foreignSetId, chatbotId: foreignChatbotId },
    })
    await createApprovedExample({
      studentMessage: 'portfolio diversification foreign chatbot',
      referenceAnswer: 'This must stay outside the current chatbot [1].',
      setId: foreignSetId,
      kbId: foreignKbId,
    })

    const skill = await loadResponseExampleRuntimeSkill({
      prisma,
      chatbotId: CHATBOT_ID,
      chatMode: 'tutor',
      role: 'included',
    })
    const ranked = await skill.search('portfolio diversification')

    expect(ranked.degraded).toBe(false)
    expect(ranked.examples.map(({ id }) => id)).toEqual([
      questionMatch.id,
      answerMatch.id,
    ])
    expect(JSON.stringify(ranked.examples)).not.toContain(foreignChatbotId)
    expect(ranked.examples[0]).toMatchObject({
      referenceAnswer:
        'Use the lecturer-approved structure [example-source-1].',
      sourceAnchors: [
        expect.objectContaining({
          citationIndex: 1,
          citationAnchor: 'anchor-portfolio diversification',
        }),
      ],
    })
    expect(ranked.examples[0]).not.toHaveProperty('evidenceReferences')

    const tied = await Promise.all(
      ['tie-a', 'tie-b', 'tie-c', 'tie-d'].map((suffix) =>
        createApprovedExample({
          studentMessage: `stable ranking marker ${suffix}`,
          referenceAnswer: 'Same bounded answer [1].',
        })
      )
    )
    const tiedResult = await skill.search('stable ranking marker')
    expect(tiedResult.examples.map(({ id }) => id)).toEqual(
      tied
        .map(({ id }) => id)
        .sort()
        .slice(0, 3)
    )

    const changedEvidence =
      await prisma.responseExampleEvidenceReference.findFirstOrThrow({
        where: { responseExampleId: questionMatch.id },
        select: { sourceId: true },
      })
    await prisma.kBResource.update({
      where: { id: changedEvidence.sourceId },
      data: { activeContentSha256: `changed-${randomUUID()}` },
    })

    const afterHashChange = await loadResponseExampleRuntimeSkill({
      prisma,
      chatbotId: CHATBOT_ID,
      chatMode: 'tutor',
      role: 'included',
    })
    const afterHashChangeResult = await afterHashChange.search(
      'portfolio diversification'
    )
    expect(afterHashChangeResult.examples.map(({ id }) => id)).toEqual([
      answerMatch.id,
    ])
    await expect(
      prisma.responseExample.findUniqueOrThrow({
        where: { id: questionMatch.id },
        select: { status: true },
      })
    ).resolves.toEqual({ status: ResponseExampleStatus.NEEDS_REVIEW })

    await prisma.kBChatbot.update({
      where: {
        kbId_chatbotId: { kbId: KB_ID, chatbotId: CHATBOT_ID },
      },
      data: { isEnabled: false },
    })

    const unboundSkill = await loadResponseExampleRuntimeSkill({
      prisma,
      chatbotId: CHATBOT_ID,
      chatMode: 'tutor',
      role: 'included',
    })
    expect(unboundSkill.summary).toContain(
      'No lecturer-approved response examples'
    )
    await expect(
      unboundSkill.search('portfolio diversification')
    ).resolves.toEqual({ degraded: false, examples: [] })
  })
})
