import { randomUUID } from 'node:crypto'
import { prisma, requireDisposableDatabase } from '@klicker-uzh/prisma'
import { verifyResponseExampleBaselineJob } from '@klicker-uzh/util/auth'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  getResponseExampleBaseline,
  handleRunResponseExampleBaseline,
  startResponseExampleBaseline,
} from '../src/services/responseExampleBaseline.js'
import { refreshResponseExampleSetDigest } from '../src/services/responseExamples.js'

const ownerId = randomUUID()
const enqueue = vi.fn(async () => undefined)
const ctx = {
  prisma,
  user: { sub: ownerId, role: 'USER', scope: 'ACCOUNT_OWNER' },
  tasks: { runResponseExampleBaseline: { runNoWait: enqueue } },
} as unknown as ContextWithUser
let chatbotId: string
let resourceId: string
let exampleId: string
beforeAll(async () => {
  await requireDisposableDatabase(prisma)
  vi.stubEnv(
    'CHAT_BASELINE_INTERNAL_URL',
    'http://chat.internal.invalid/api/internal/response-example-baseline'
  )
  vi.stubEnv(
    'RESPONSE_EXAMPLE_BASELINE_JOB_SECRET',
    'synthetic-only-key-for-local-baseline-contract-tests'
  )
  await prisma.user.create({
    data: {
      id: ownerId,
      email: `${ownerId}@example.invalid`,
      shortname: 'synthetic-baseline',
      aiFeaturesEnabled: true,
    },
  })
  const course = await prisma.course.create({
    data: {
      name: 'Synthetic',
      displayName: 'Synthetic',
      ownerId,
      authType: 'SSO',
      startDate: new Date(),
      endDate: new Date(),
      groupDeadlineDate: new Date(),
    },
  })
  const chatbot = await prisma.chatbot.create({
    data: {
      name: 'Synthetic',
      courseId: course.id,
      ownerId,
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
  chatbotId = chatbot.id
  const kb = await prisma.kB.create({ data: { name: 'Synthetic', ownerId } })
  await prisma.kBChatbot.create({
    data: { kbId: kb.id, chatbotId, isEnabled: true },
  })
  const resource = await prisma.kBResource.create({
    data: {
      kbId: kb.id,
      type: 'URL',
      title: 'Synthetic',
      sourceUrl: 'https://example.invalid/test',
      status: 'READY',
      activeResourceVersion: 1,
      activeContentSha256: 'a'.repeat(64),
    },
  })
  resourceId = resource.id
  const set = await prisma.responseExampleSet.create({
    data: {
      chatbotId,
      examples: {
        create: [
          {
            chatMode: 'tutor',
            studentMessage: 'Synthetic question',
            referenceAnswer: 'Synthetic ideal [1]',
            responseStyle: 'CONCISE_ANSWER',
            status: 'APPROVED',
            evidenceReferences: {
              create: {
                sourceId: resourceId,
                chunkId: 'test-chunk',
                contentHash: 'a'.repeat(64),
                citationIndex: 1,
                citationAnchor: 'page 1',
                evidenceEligible: true,
              },
            },
          },
          {
            chatMode: 'tutor',
            studentMessage: 'Unreviewed question',
            referenceAnswer: 'Unreviewed answer',
            responseStyle: 'CONCISE_ANSWER',
            status: 'CANDIDATE',
          },
        ],
      },
    },
    include: { examples: true },
  })
  exampleId = set.examples.find((example) => example.status === 'APPROVED')!.id
  await refreshResponseExampleSetDigest(prisma, set.id)
})
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: ownerId } })
  vi.unstubAllEnvs()
})

describe('current lecturer baseline report', () => {
  it('snapshots only current approved cases, rejects unconfirmed replacement and retains one latest report', async () => {
    const started = await startResponseExampleBaseline({ chatbotId }, ctx)
    expect(started?.report?.cases.map((entry) => entry.exampleId)).toEqual([
      exampleId,
    ])
    expect(started?.eligibleCount).toBe(1)
    expect(started?.excludedCount).toBe(1)
    expect(started?.report?.stale).toBe(false)
    await expect(
      startResponseExampleBaseline({ chatbotId }, ctx)
    ).rejects.toMatchObject({
      extensions: { code: 'BASELINE_REPLACE_CONFIRMATION_REQUIRED' },
    })
    const replaced = await startResponseExampleBaseline(
      { chatbotId, replaceActive: true },
      ctx
    )
    expect(replaced?.report?.id).not.toBe(started?.report?.id)
    expect(
      await prisma.responseExampleBaselineReport.count({ where: { ownerId } })
    ).toBe(1)
    expect(
      await prisma.responseExampleBaselineCase.count({
        where: { reportId: started!.report!.id },
      })
    ).toBe(0)
    expect(enqueue).toHaveBeenCalled()
  })
  it('denies another owner and marks changed examples and execution configuration stale', async () => {
    const other = {
      ...ctx,
      user: { ...ctx.user, sub: randomUUID() },
    } as ContextWithUser
    expect(await getResponseExampleBaseline({ chatbotId }, other)).toBeNull()
    await expect(
      startResponseExampleBaseline({ chatbotId }, other)
    ).rejects.toThrow()
    await prisma.chatbot.update({
      where: { id: chatbotId },
      data: { knowledgeGraphRetrievalEnabled: true },
    })
    expect(
      (await getResponseExampleBaseline({ chatbotId }, ctx))?.report?.stale
    ).toBe(true)
    await prisma.chatbot.update({
      where: { id: chatbotId },
      data: { knowledgeGraphRetrievalEnabled: false },
    })
    const current = await getResponseExampleBaseline({ chatbotId }, ctx)
    await prisma.responseExample.update({
      where: { id: exampleId },
      data: { referenceAnswer: 'Changed ideal [1]' },
    })
    await refreshResponseExampleSetDigest(prisma, current!.report!.setId)
    expect(
      (await getResponseExampleBaseline({ chatbotId }, ctx))?.report?.stale
    ).toBe(true)
  })
  it('dispatches only signed identifiers once and cannot overwrite a replacement report', async () => {
    const started = await startResponseExampleBaseline(
      { chatbotId, replaceActive: true },
      ctx
    )
    const oldRunId = started!.report!.id
    let replacementId: string | undefined
    const transport = vi.fn(async (_url, options) => {
      const scope = JSON.parse(options.body)
      expect(Object.keys(scope).sort()).toEqual([
        'caseId',
        'chatbotId',
        'ownerId',
        'runId',
      ])
      expect(scope).toMatchObject({ ownerId, chatbotId, runId: oldRunId })
      await verifyResponseExampleBaselineJob(
        options.headers.authorization.slice('Bearer '.length),
        scope,
        process.env.RESPONSE_EXAMPLE_BASELINE_JOB_SECRET
      )
      const replaced = await startResponseExampleBaseline(
        { chatbotId, replaceActive: true },
        ctx
      )
      replacementId = replaced!.report!.id
      return new Response(
        JSON.stringify({ completed: true, continueRun: true }),
        { status: 200 }
      )
    })
    vi.stubGlobal('fetch', transport)
    try {
      await handleRunResponseExampleBaseline({ runId: oldRunId }, { prisma })
      await handleRunResponseExampleBaseline({ runId: oldRunId }, { prisma })
      expect(transport).toHaveBeenCalledTimes(1)
      const current = await getResponseExampleBaseline({ chatbotId }, ctx)
      expect(current!.report!.id).toBe(replacementId)
      expect(current!.report!.status).toBe('QUEUED')
      expect(current!.report!.cases[0]!.actualAnswer).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it('invalidates source changes, surfaces enqueue failure and expired/lost work without redispatch', async () => {
    enqueue.mockRejectedValueOnce(new Error('synthetic enqueue failure'))
    const failed = await startResponseExampleBaseline(
      { chatbotId, replaceActive: true },
      ctx
    )
    expect(failed?.report?.status).toBe('FAILED')
    expect(failed?.report?.errorCode).toBe('BASELINE_ENQUEUE_FAILED')
    enqueue.mockResolvedValue(undefined)
    const queued = await startResponseExampleBaseline({ chatbotId }, ctx)
    await prisma.responseExampleBaselineReport.update({
      where: { id: queued!.report!.id },
      data: { deadline: new Date(Date.now() - 1000) },
    })
    expect(
      (await getResponseExampleBaseline({ chatbotId }, ctx))?.report?.status
    ).toBe('INCOMPLETE')
    const before = enqueue.mock.calls.length
    expect(
      await handleRunResponseExampleBaseline(
        { runId: queued!.report!.id },
        { prisma }
      )
    ).toEqual({ success: false })
    expect(enqueue.mock.calls.length).toBe(before)
    await prisma.kBResource.update({
      where: { id: resourceId },
      data: { activeContentSha256: 'b'.repeat(64) },
    })
    const stale = await getResponseExampleBaseline({ chatbotId }, ctx)
    expect(stale?.eligibleCount).toBe(0)
    expect(stale?.report?.stale).toBe(true)
  })
})
