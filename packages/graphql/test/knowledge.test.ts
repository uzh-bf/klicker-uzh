import {
  KBGraphInclusionMode,
  KBResourceKind,
} from '@klicker-uzh/prisma/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteKB,
  getKB,
  linkKBChatbot,
  updateKB,
} from '../src/services/knowledge.js'
import {
  isResourceIncludedInGraph,
  validateKBMetadata,
  validateKBRefreshPolicy,
  validateKBResourceMetadata,
  validateKBResourceSource,
} from '../src/services/knowledgeMetadata.js'
import {
  dispatchKBWebhook,
  resolveIncomingKBWebhookIds,
  signKBWebhookPayload,
  verifyKBWebhookSignature,
} from '../src/services/knowledgeWebhooks.js'

describe('KB service helpers', () => {
  it('validates Klicker-owned KB and resource metadata profiles', () => {
    expect(
      validateKBMetadata('AI_BUDDY', {
        studyLevel: 'BOTH',
        scope: 'UZH_WIDE',
        audience: ['STUDENTS'],
        retrievalTags: ['semester-1'],
      })
    ).toEqual({
      studyLevel: 'BOTH',
      scope: 'UZH_WIDE',
      audience: ['STUDENTS'],
      retrievalTags: ['semester-1'],
    })

    expect(() =>
      validateKBResourceMetadata('COURSE_KB', { studyLevel: 'DIPLOMA' })
    ).toThrow('Invalid KB resource metadata')
  })

  it('validates fixed resource kind source fields', () => {
    expect(
      validateKBResourceSource({
        kind: KBResourceKind.WEBSITE,
        websiteUrl: 'https://www.uzh.ch/cmsssl/en.html',
        websiteStrategy: 'SCRAPE_SUBSITES',
      })
    ).toMatchObject({
      websiteUrl: 'https://www.uzh.ch/cmsssl/en.html',
      websiteStrategy: 'SCRAPE_SUBSITES',
    })

    expect(
      validateKBResourceSource({
        kind: KBResourceKind.SNIPPET,
        snippetText: 'A short source text.',
      })
    ).toMatchObject({
      snippetText: 'A short source text.',
    })

    expect(() =>
      validateKBResourceSource({
        kind: KBResourceKind.KLICKER_OBJECT,
        elementId: 1,
        practiceQuizId: '00000000-0000-0000-0000-000000000000',
      })
    ).toThrow('Exactly one Klicker object reference is required')
  })

  it('validates refresh policies and graph inclusion', () => {
    expect(
      validateKBRefreshPolicy({
        refreshIntervalMinutes: 60,
      })
    ).toEqual({
      refreshIntervalMinutes: 60,
    })

    expect(() =>
      validateKBRefreshPolicy({ refreshIntervalMinutes: 0 })
    ).toThrow('refreshIntervalMinutes must be greater than 0')

    expect(
      isResourceIncludedInGraph(
        {
          graphEnabled: true,
          graphResourceKinds: [KBResourceKind.DOCUMENT],
        },
        {
          kind: KBResourceKind.DOCUMENT,
          graphInclusion: KBGraphInclusionMode.INHERIT,
        }
      )
    ).toBe(true)

    expect(
      isResourceIncludedInGraph(
        {
          graphEnabled: true,
          graphResourceKinds: [KBResourceKind.DOCUMENT],
        },
        {
          kind: KBResourceKind.WEBSITE,
          graphInclusion: KBGraphInclusionMode.EXCLUDE,
        }
      )
    ).toBe(false)
  })

  it('signs and verifies webhook payloads', () => {
    const body = JSON.stringify({ resourceId: 'res-1' })
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = signKBWebhookPayload({
      secret: 'secret',
      timestamp,
      rawBody: body,
    })

    expect(
      verifyKBWebhookSignature({
        secret: 'secret',
        timestamp,
        rawBody: body,
        signature,
        toleranceSeconds: 60,
      })
    ).toBe(true)

    expect(
      verifyKBWebhookSignature({
        secret: 'secret',
        timestamp,
        rawBody: body,
        signature: `${signature}0`,
        toleranceSeconds: 60,
      })
    ).toBe(false)
  })

  it('resolves incoming webhook ids from scoped payload objects', () => {
    expect(
      resolveIncomingKBWebhookIds({
        eventId: 'event-1',
        eventType: 'kb.metrics_updated',
        occurredAt: new Date().toISOString(),
        kb: { id: 'kb-1' },
      })
    ).toEqual({
      kbId: 'kb-1',
      resourceId: null,
      ingestionRunId: null,
    })

    expect(
      resolveIncomingKBWebhookIds({
        eventId: 'event-2',
        eventType: 'resource.processing_succeeded',
        occurredAt: new Date().toISOString(),
        kb: { id: 'kb-1' },
        resource: { id: 'resource-1' },
        ingestionRun: { id: 'run-1' },
      })
    ).toEqual({
      kbId: 'kb-1',
      resourceId: 'resource-1',
      ingestionRunId: 'run-1',
    })
  })
})

function buildOwnerCtx(prismaMock: Record<string, unknown>) {
  return {
    user: { sub: 'user-1' },
    prisma: prismaMock,
  } as unknown as Parameters<typeof getKB>[1]
}

describe('KB owner-only authorization', () => {
  it('refuses to read a KB owned by a different user', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const ctx = buildOwnerCtx({ kB: { findFirst } })

    await expect(getKB({ id: 'kb-other' }, ctx)).rejects.toThrow(
      'Knowledge base not found'
    )
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'kb-other',
          ownerId: 'user-1',
        }),
      })
    )
  })

  it('refuses to update a KB owned by a different user before mutating state', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const update = vi.fn()
    const ctx = buildOwnerCtx({ kB: { findFirst, update } })

    await expect(
      updateKB({ id: 'kb-other', input: { name: 'hijack' } }, ctx)
    ).rejects.toThrow('Knowledge base not found')
    expect(update).not.toHaveBeenCalled()
  })

  it('refuses to delete a KB owned by a different user before deleting', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const deleteMock = vi.fn()
    const ctx = buildOwnerCtx({ kB: { findFirst, delete: deleteMock } })

    await expect(deleteKB({ id: 'kb-other' }, ctx)).rejects.toThrow(
      'Knowledge base not found'
    )
    expect(deleteMock).not.toHaveBeenCalled()
  })
})

describe('KB chatbot linking', () => {
  function buildLinkCtx({
    chatbotFound = true,
  }: { chatbotFound?: boolean } = {}) {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 })
    const upsert = vi.fn().mockResolvedValue({})
    const transactionCalls: unknown[][] = []
    const $transaction = vi.fn(async (ops: unknown[]) => {
      transactionCalls.push(ops)
      return ops
    })

    const ctx = buildOwnerCtx({
      kB: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: 'kb-1', metadataProfile: 'COURSE_KB' }),
      },
      chatbot: {
        findFirst: vi
          .fn()
          .mockResolvedValue(chatbotFound ? { id: 'cb-1' } : null),
      },
      kBChatbot: { updateMany, upsert },
      $transaction,
    })

    return { ctx, updateMany, upsert, $transaction, transactionCalls }
  }

  it('disables other enabled KB links when enabling a new link', async () => {
    const { ctx, updateMany, $transaction } = buildLinkCtx()

    await linkKBChatbot({ kbId: 'kb-1', chatbotId: 'cb-1' }, ctx)

    expect($transaction).toHaveBeenCalledTimes(1)
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        chatbotId: 'cb-1',
        isEnabled: true,
        kbId: { not: 'kb-1' },
      },
      data: { isEnabled: false },
    })
  })

  it('skips the disable step when explicitly creating a disabled link', async () => {
    const { ctx, updateMany } = buildLinkCtx()

    await linkKBChatbot(
      { kbId: 'kb-1', chatbotId: 'cb-1', isEnabled: false },
      ctx
    )

    expect(updateMany).not.toHaveBeenCalled()
  })

  it('refuses to link a chatbot owned by another user', async () => {
    const { ctx, updateMany, upsert } = buildLinkCtx({ chatbotFound: false })

    await expect(
      linkKBChatbot({ kbId: 'kb-1', chatbotId: 'cb-other' }, ctx)
    ).rejects.toThrow('Chatbot not found')
    expect(updateMany).not.toHaveBeenCalled()
    expect(upsert).not.toHaveBeenCalled()
  })
})

describe('dispatchKBWebhook', () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    vi.restoreAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('returns a non-ok result when the destination is not configured', async () => {
    delete process.env.KB_INGESTION_WEBHOOK_URL
    delete process.env.KB_INGESTION_WEBHOOK_SECRET
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const result = await dispatchKBWebhook({
      destination: 'INGESTION',
      eventType: 'resource.created',
      payload: {},
    })

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/not configured/i)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('signs and posts the configured destination URL on success', async () => {
    process.env.KB_INGESTION_WEBHOOK_URL = 'https://ingest.example/hook'
    process.env.KB_INGESTION_WEBHOOK_SECRET = 'shh'

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }))

    const result = await dispatchKBWebhook({
      destination: 'INGESTION',
      eventType: 'resource.created',
      payload: { kb: { id: 'kb-1' } },
    })

    expect(result.ok).toBe(true)
    expect(result.statusCode).toBe(200)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(url).toBe('https://ingest.example/hook')
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers['X-Klicker-Event-Type']).toBe('resource.created')
    expect(headers['X-Klicker-Signature']).toMatch(/^[0-9a-f]{64}$/)
    expect(headers['X-Klicker-Event-Id']).toEqual(result.eventId)
  })

  it('reports HTTP errors without throwing', async () => {
    process.env.KB_GRAPH_WEBHOOK_URL = 'https://graph.example/hook'
    process.env.KB_GRAPH_WEBHOOK_SECRET = 'shh'

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('boom', { status: 502 })
    )

    const result = await dispatchKBWebhook({
      destination: 'GRAPH',
      eventType: 'catalog.resource.updated',
      payload: {},
    })

    expect(result.ok).toBe(false)
    expect(result.statusCode).toBe(502)
    expect(result.error).toMatch(/502/)
  })
})
