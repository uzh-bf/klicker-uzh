import { generateKeyPairSync } from 'node:crypto'
import type { EventEmitter } from 'node:events'
import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  KBResourceStatus,
  KBResourceType,
  type Prisma,
  type PrismaClient,
  Prisma as PrismaRuntime,
  ResponseExampleStatus,
  ResponseExampleStyle,
} from '@klicker-uzh/prisma/client'
import {
  signResponseExampleReceipt,
  type VerifyResponseExampleReceiptInput,
} from '@klicker-uzh/util/response-example-receipt'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  approveResponseExample,
  captureResponseExample,
  computeResponseExampleSetDigest,
  editAndApproveResponseExample,
  getChatbotResponseExamples,
  RESPONSE_EXAMPLE_CAPTURE_STALE,
  RESPONSE_EXAMPLE_DUPLICATE,
  RESPONSE_EXAMPLE_MODE_UNAVAILABLE,
  RESPONSE_EXAMPLE_RECEIPT_INVALID,
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
    select: { systemPrompts: true, standardModeConfig: true },
  },
} satisfies Prisma.ResponseExampleSetInclude

describe('response-example foundation', () => {
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser
  let receiptPrivateKeyPem: string
  let receiptSettings: Omit<VerifyResponseExampleReceiptInput, 'token'>

  beforeAll(async () => {
    const {
      prisma: newPrisma,
      hatchet: newHatchet,
      emitter: newEmitter,
    } = await initializePrisma()
    prisma = newPrisma
    hatchet = newHatchet
    emitter = newEmitter
    const keyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    receiptPrivateKeyPem = keyPair.privateKey
      .export({ format: 'pem', type: 'pkcs8' })
      .toString()
    receiptSettings = {
      publicKeyPem: keyPair.publicKey
        .export({ format: 'pem', type: 'spki' })
        .toString(),
      keyId: 'response-example-capture-test-key',
      issuer: 'https://chat.klicker.test',
      audience: 'klicker-response-example-test',
    }
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
    const kb = await prisma.kB.create({
      data: {
        name: 'Response example test knowledge base',
        ownerId: userOneCtx.user.sub,
      },
    })
    await prisma.kBChatbot.create({
      data: { kbId: kb.id, chatbotId: chatbot.id, isEnabled: true },
    })
    const currentResource = await prisma.kBResource.create({
      data: {
        kbId: kb.id,
        type: KBResourceType.URL,
        title: 'Current response-example source',
        sourceUrl: 'https://example.invalid/current',
        status: KBResourceStatus.READY,
        activeResourceVersion: 1,
        activeContentSha256: 'hash-synthetic-1',
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
                  sourceId: currentResource.id,
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

    return { chatbot, kb, currentResource, set: refreshedSet }
  }

  async function buildCaptureInput({
    answer = 'Use the current course source to justify the result [1].',
    chatMode = 'tutor',
    question = 'Why does the result follow?',
  }: {
    answer?: string
    chatMode?: string
    question?: string
  } = {}) {
    const seeded = await seedResponseExampleSet()
    const contentHash = 'b'.repeat(64)
    await prisma.kBResource.update({
      where: { id: seeded.currentResource.id },
      data: { activeContentSha256: contentHash },
    })
    const signed = await signResponseExampleReceipt({
      ...receiptSettings,
      privateKeyPem: receiptPrivateKeyPem,
      ownerId: userOneCtx.user.sub,
      chatbotId: seeded.chatbot.id,
      kbId: seeded.kb.id,
      chatMode,
      question,
      answer,
      evidenceReferences: [
        {
          citationIndex: 1,
          sourceId: seeded.currentResource.id,
          chunkId: 'chunk-capture-1',
          contentHash,
          citationAnchor: 'page=4',
        },
      ],
    })
    return {
      ...seeded,
      args: {
        chatbotId: seeded.chatbot.id,
        receipt: signed.token,
        question,
        answer,
      },
    }
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
    expect(ownerSet?.chatModes).toEqual(['explainer', 'quizzer', 'tutor'])
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
      sourceId: expect.any(String),
      chunkId: 'chunk-synthetic-1',
      contentHash: 'hash-synthetic-1',
      citationAnchor: 'page 1',
      evidenceEligible: true,
    })
    expect(otherUserSet).toBeNull()
  })

  it.each([
    ['tutor', ResponseExampleStyle.GUIDED_QUESTIONS],
    ['explainer', ResponseExampleStyle.STEP_BY_STEP_EXPLANATION],
    ['summary', ResponseExampleStyle.CONCISE_ANSWER],
  ] as const)('captures a grounded %s answer as a reviewable candidate', async (chatMode, expectedStyle) => {
    const capture = await buildCaptureInput({ chatMode })
    if (chatMode === 'summary') {
      await prisma.chatbot.update({
        where: { id: capture.chatbot.id },
        data: {
          systemPrompts: {
            tutor: { prompt: 'Tutor prompt' },
            explainer: { prompt: 'Explainer prompt' },
            summary: { prompt: 'Summary prompt' },
          },
        },
      })
    }
    const beforeDigest = capture.set.digest

    const result = await captureResponseExample(
      capture.args,
      userOneCtx,
      receiptSettings
    )

    expect(result).toEqual({ exampleId: expect.any(String), created: true })
    const stored = await prisma.responseExample.findUniqueOrThrow({
      where: { id: result!.exampleId },
      include: { evidenceReferences: true },
    })
    expect(stored).toMatchObject({
      chatMode,
      studentMessage: capture.args.question,
      referenceAnswer: capture.args.answer,
      responseStyle: expectedStyle,
      status: ResponseExampleStatus.CANDIDATE,
      reviewedById: null,
      reviewedAt: null,
      evidenceReferences: [
        expect.objectContaining({
          sourceId: capture.currentResource.id,
          chunkId: 'chunk-capture-1',
          contentHash: 'b'.repeat(64),
          citationIndex: 1,
          citationAnchor: 'page=4',
          evidenceEligible: true,
        }),
      ],
    })
    const refreshedSet = await prisma.responseExampleSet.findUniqueOrThrow({
      where: { id: capture.set.id },
    })
    expect(refreshedSet.digest).not.toBe(beforeDigest)
  })

  it('captures and approves an enabled standard mode without legacy prompts', async () => {
    const capture = await buildCaptureInput({ chatMode: 'explainer' })
    await prisma.chatbot.update({
      where: { id: capture.chatbot.id },
      data: {
        systemPrompts: PrismaRuntime.DbNull,
        standardModeConfig: {
          tutorEnabled: false,
          explainerEnabled: true,
          quizzerEnabled: false,
          courseName: null,
          subjectDomain: null,
          languageOfInstruction: null,
          scopeNote: null,
        },
      },
    })

    const result = await captureResponseExample(
      capture.args,
      userOneCtx,
      receiptSettings
    )
    expect(result).toMatchObject({ created: true })
    const approved = await approveResponseExample(
      { id: result!.exampleId },
      userOneCtx
    )
    expect(approved?.chatModes).toEqual(['explainer'])
    expect(
      approved?.examples.find(({ id }) => id === result!.exampleId)
    ).toMatchObject({ status: ResponseExampleStatus.APPROVED })
  })

  it('rejects capture when a standard mode is disabled after receipt issuance', async () => {
    const capture = await buildCaptureInput({ chatMode: 'explainer' })
    await prisma.chatbot.update({
      where: { id: capture.chatbot.id },
      data: {
        standardModeConfig: {
          tutorEnabled: true,
          explainerEnabled: false,
          quizzerEnabled: false,
          courseName: null,
          subjectDomain: null,
          languageOfInstruction: null,
          scopeNote: null,
        },
      },
    })

    await expect(
      captureResponseExample(capture.args, userOneCtx, receiptSettings)
    ).rejects.toMatchObject({
      extensions: { code: RESPONSE_EXAMPLE_CAPTURE_STALE },
    })
  })

  it('rejects receipt binding mismatches and stale evidence', async () => {
    const mismatch = await buildCaptureInput()
    await expect(
      captureResponseExample(
        { ...mismatch.args, answer: `${mismatch.args.answer} changed` },
        userOneCtx,
        receiptSettings
      )
    ).rejects.toMatchObject({
      extensions: { code: RESPONSE_EXAMPLE_RECEIPT_INVALID },
    })
    await expect(
      captureResponseExample(mismatch.args, userTwoCtx, receiptSettings)
    ).rejects.toMatchObject({
      extensions: { code: RESPONSE_EXAMPLE_RECEIPT_INVALID },
    })

    await prisma.kBResource.update({
      where: { id: mismatch.currentResource.id },
      data: { activeContentSha256: 'c'.repeat(64) },
    })
    await expect(
      captureResponseExample(mismatch.args, userOneCtx, receiptSettings)
    ).rejects.toMatchObject({
      extensions: { code: RESPONSE_EXAMPLE_CAPTURE_STALE },
    })
  })

  it('returns one unchanged row for concurrent receipt replay', async () => {
    const capture = await buildCaptureInput()

    const results = await Promise.all([
      captureResponseExample(capture.args, userOneCtx, receiptSettings),
      captureResponseExample(capture.args, userOneCtx, receiptSettings),
    ])

    expect(results.map((result) => result?.created).sort()).toEqual([
      false,
      true,
    ])
    expect(new Set(results.map((result) => result?.exampleId)).size).toBe(1)
    await expect(
      prisma.responseExample.count({
        where: {
          setId: capture.set.id,
          chatMode: 'tutor',
          studentMessage: capture.args.question,
        },
      })
    ).resolves.toBe(1)
  })

  it('never changes an existing approved example on duplicate capture', async () => {
    const capture = await buildCaptureInput()
    const existing = await prisma.responseExample.create({
      data: {
        setId: capture.set.id,
        chatMode: 'tutor',
        studentMessage: capture.args.question,
        referenceAnswer: 'Lecturer-approved answer [1].',
        responseStyle: ResponseExampleStyle.WORKED_EXAMPLE,
        status: ResponseExampleStatus.APPROVED,
        reviewedById: userOneCtx.user.sub,
        reviewedAt: new Date('2026-09-03T12:00:00.000Z'),
        evidenceReferences: {
          create: {
            citationIndex: 1,
            sourceId: capture.currentResource.id,
            chunkId: 'chunk-approved-1',
            contentHash: 'b'.repeat(64),
            citationAnchor: 'page=4',
            evidenceEligible: true,
          },
        },
      },
    })

    await expect(
      captureResponseExample(capture.args, userOneCtx, receiptSettings)
    ).resolves.toEqual({ exampleId: existing.id, created: false })
    await expect(
      prisma.responseExample.findUniqueOrThrow({ where: { id: existing.id } })
    ).resolves.toMatchObject({
      referenceAnswer: 'Lecturer-approved answer [1].',
      responseStyle: ResponseExampleStyle.WORKED_EXAMPLE,
      status: ResponseExampleStatus.APPROVED,
      reviewedById: userOneCtx.user.sub,
    })
  })

  it('rolls back candidate creation when digest refresh fails', async () => {
    const capture = await buildCaptureInput()
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION fail_capture_digest_update()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'forced capture digest failure';
      END;
      $$ LANGUAGE plpgsql
    `)
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER fail_capture_digest_update
      BEFORE UPDATE ON "public"."ResponseExampleSet"
      FOR EACH ROW EXECUTE FUNCTION fail_capture_digest_update()
    `)
    try {
      await expect(
        captureResponseExample(capture.args, userOneCtx, receiptSettings)
      ).rejects.toThrow('forced capture digest failure')
    } finally {
      await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS fail_capture_digest_update
        ON "public"."ResponseExampleSet"
      `)
      await prisma.$executeRawUnsafe(
        'DROP FUNCTION IF EXISTS fail_capture_digest_update()'
      )
    }

    await expect(
      prisma.responseExample.count({
        where: {
          setId: capture.set.id,
          chatMode: 'tutor',
          studentMessage: capture.args.question,
        },
      })
    ).resolves.toBe(0)
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
    const nonOwnerDigest = (
      await getChatbotResponseExamples({ chatbotId: chatbot.id }, userOneCtx)
    )?.digest
    expect(
      await editAndApproveResponseExample(
        {
          id: candidate.id,
          chatMode: candidate.chatMode,
          studentMessage: 'A non-owner edit must remain blocked.',
          referenceAnswer: 'This answer must not be saved [1].',
          responseStyle: candidate.responseStyle,
          expectedUpdatedAt: candidate.updatedAt,
        },
        userTwoCtx
      )
    ).toBeNull()
    await expect(
      prisma.responseExample.findUniqueOrThrow({ where: { id: candidate.id } })
    ).resolves.toMatchObject({
      studentMessage: candidate.studentMessage,
      referenceAnswer: candidate.referenceAnswer,
      status: ResponseExampleStatus.CANDIDATE,
      reviewedById: candidate.reviewedById,
      reviewedAt: candidate.reviewedAt,
    })
    expect(
      (await getChatbotResponseExamples({ chatbotId: chatbot.id }, userOneCtx))
        ?.digest
    ).toBe(nonOwnerDigest)

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
      data: {
        standardModeConfig: {
          tutorEnabled: false,
          explainerEnabled: true,
          quizzerEnabled: false,
          courseName: null,
          subjectDomain: null,
          languageOfInstruction: null,
          scopeNote: null,
        },
      },
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

  it('reconciles changed evidence once under concurrent reads', async () => {
    const { chatbot, currentResource, set } = await seedResponseExampleSet()
    const candidate = set.examples.find(
      (example) => example.status === ResponseExampleStatus.CANDIDATE
    )!
    const approved = await approveResponseExample(
      { id: candidate.id },
      userOneCtx
    )
    const approvedDigest = approved?.digest

    await prisma.kBResource.update({
      where: { id: currentResource.id },
      data: { activeContentSha256: 'changed-content-hash' },
    })

    const [firstRead, secondRead] = await Promise.all([
      getChatbotResponseExamples({ chatbotId: chatbot.id }, userOneCtx),
      getChatbotResponseExamples({ chatbotId: chatbot.id }, userOneCtx),
    ])
    const reconciled = firstRead?.examples.find(
      (example) => example.id === candidate.id
    )

    expect(reconciled).toMatchObject({
      status: ResponseExampleStatus.NEEDS_REVIEW,
      reviewedById: null,
      reviewedAt: null,
      evidenceReferences: [
        expect.objectContaining({ evidenceEligible: false }),
      ],
    })
    expect(firstRead?.digest).toBe(secondRead?.digest)
    expect(firstRead?.updatedAt).toEqual(secondRead?.updatedAt)
    expect(firstRead?.digest).not.toBe(approvedDigest)

    const stableRead = await getChatbotResponseExamples(
      { chatbotId: chatbot.id },
      userOneCtx
    )
    expect(stableRead?.digest).toBe(firstRead?.digest)
    expect(stableRead?.updatedAt).toEqual(firstRead?.updatedAt)
  })

  it('keeps restored or rebound evidence behind lecturer re-approval', async () => {
    const { chatbot, currentResource, kb, set } = await seedResponseExampleSet()
    const candidate = set.examples.find(
      (example) => example.status === ResponseExampleStatus.CANDIDATE
    )!
    await approveResponseExample({ id: candidate.id }, userOneCtx)

    await prisma.kBResource.update({
      where: { id: currentResource.id },
      data: { activeContentSha256: 'changed-content-hash' },
    })
    await getChatbotResponseExamples({ chatbotId: chatbot.id }, userOneCtx)
    await prisma.kBResource.update({
      where: { id: currentResource.id },
      data: { activeContentSha256: 'hash-synthetic-1' },
    })

    const restored = await getChatbotResponseExamples(
      { chatbotId: chatbot.id },
      userOneCtx
    )
    expect(
      restored?.examples.find((example) => example.id === candidate.id)
    ).toMatchObject({
      status: ResponseExampleStatus.NEEDS_REVIEW,
      evidenceReferences: [expect.objectContaining({ evidenceEligible: true })],
    })

    await prisma.kBChatbot.update({
      where: { kbId_chatbotId: { kbId: kb.id, chatbotId: chatbot.id } },
      data: { isEnabled: false },
    })
    const replacementKb = await prisma.kB.create({
      data: {
        name: 'Replacement response example knowledge base',
        ownerId: userOneCtx.user.sub,
      },
    })
    await prisma.kBChatbot.create({
      data: {
        kbId: replacementKb.id,
        chatbotId: chatbot.id,
        isEnabled: true,
      },
    })

    const rebound = await getChatbotResponseExamples(
      { chatbotId: chatbot.id },
      userOneCtx
    )
    expect(
      rebound?.examples.find((example) => example.id === candidate.id)
    ).toMatchObject({
      status: ResponseExampleStatus.NEEDS_REVIEW,
      evidenceReferences: [
        expect.objectContaining({ evidenceEligible: false }),
      ],
    })
  })

  it('fails approval closed when no knowledge base is enabled', async () => {
    const { chatbot, kb, set } = await seedResponseExampleSet()
    const candidate = set.examples.find(
      (example) => example.status === ResponseExampleStatus.CANDIDATE
    )!
    await prisma.kBChatbot.update({
      where: { kbId_chatbotId: { kbId: kb.id, chatbotId: chatbot.id } },
      data: { isEnabled: false },
    })

    await expect(
      approveResponseExample({ id: candidate.id }, userOneCtx)
    ).rejects.toMatchObject({
      extensions: { code: RESPONSE_EXAMPLE_SOURCES_REQUIRED },
    })
  })

  it('rolls back eligibility and digest together, then retries cleanly', async () => {
    const { chatbot, currentResource, set } = await seedResponseExampleSet()
    const candidate = set.examples.find(
      (example) => example.status === ResponseExampleStatus.CANDIDATE
    )!
    const approved = await approveResponseExample(
      { id: candidate.id },
      userOneCtx
    )
    await prisma.kBResource.update({
      where: { id: currentResource.id },
      data: { activeContentSha256: 'changed-content-hash' },
    })

    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION fail_response_example_digest_update()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'forced response-example digest failure';
      END;
      $$ LANGUAGE plpgsql
    `)
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER fail_response_example_digest_update
      BEFORE UPDATE ON "public"."ResponseExampleSet"
      FOR EACH ROW EXECUTE FUNCTION fail_response_example_digest_update()
    `)
    try {
      await expect(
        getChatbotResponseExamples({ chatbotId: chatbot.id }, userOneCtx)
      ).rejects.toThrow('forced response-example digest failure')
    } finally {
      await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS fail_response_example_digest_update
        ON "public"."ResponseExampleSet"
      `)
      await prisma.$executeRawUnsafe(
        'DROP FUNCTION IF EXISTS fail_response_example_digest_update()'
      )
    }

    await expect(
      prisma.responseExample.findUniqueOrThrow({ where: { id: candidate.id } })
    ).resolves.toMatchObject({
      status: ResponseExampleStatus.APPROVED,
      reviewedById: userOneCtx.user.sub,
    })
    expect(
      await prisma.responseExampleSet.findUniqueOrThrow({
        where: { id: set.id },
      })
    ).toMatchObject({ digest: approved?.digest })

    const retried = await getChatbotResponseExamples(
      { chatbotId: chatbot.id },
      userOneCtx
    )
    expect(
      retried?.examples.find((example) => example.id === candidate.id)
    ).toMatchObject({
      status: ResponseExampleStatus.NEEDS_REVIEW,
      evidenceReferences: [
        expect.objectContaining({ evidenceEligible: false }),
      ],
    })
    expect(retried?.digest).not.toBe(approved?.digest)
  })

  it('withdraws an approved example when its source is deleted', async () => {
    const { chatbot, currentResource, set } = await seedResponseExampleSet()
    const candidate = set.examples.find(
      (example) => example.status === ResponseExampleStatus.CANDIDATE
    )!
    await approveResponseExample({ id: candidate.id }, userOneCtx)

    await prisma.kBResource.update({
      where: { id: currentResource.id },
      data: { deletedAt: new Date() },
    })

    const reconciled = await getChatbotResponseExamples(
      { chatbotId: chatbot.id },
      userOneCtx
    )
    expect(
      reconciled?.examples.find((example) => example.id === candidate.id)
    ).toMatchObject({
      status: ResponseExampleStatus.NEEDS_REVIEW,
      reviewedById: null,
      reviewedAt: null,
      evidenceReferences: [
        expect.objectContaining({ evidenceEligible: false }),
      ],
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
