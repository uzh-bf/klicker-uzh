import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test, vi } from 'vitest'
import {
  createReceiptStore,
  initialReceipt,
  probeFixedRoute,
  safeResult,
  suppressOutput,
  updatedReceipt,
} from '../scripts/w5e-prd-direct-chat'

const ids = {
  ownerId: '00000000-0000-4000-8000-000000000001',
  courseId: '00000000-0000-4000-8000-000000000002',
  participantId: '00000000-0000-4000-8000-000000000003',
  participationId: null,
  chatbotId: '00000000-0000-4000-8000-000000000004',
  legacyConfigId: '00000000-0000-4000-8000-000000000005',
  candidateServerId: '00000000-0000-4000-8000-000000000006',
  candidateConfigId: '00000000-0000-4000-8000-000000000007',
} as const

const provenance = {
  klickerSourceSha: 'source-sha',
  chatImageDigest: 'chat-image',
  docQueryImageDigest: 'doc-query-image',
  argoRevision: 'argo-revision',
  networkPolicySourceCommit: 'network-policy',
} as const

describe('W5e direct-Chat receipt and output boundaries', () => {
  test('journals a digest-checked values-free receipt and rejects backward state', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'w5e-receipt-'))
    const path = join(directory, 'receipt.json')
    try {
      const store = createReceiptStore(path)
      const receipt = initialReceipt('run-1', { ...ids }, { ...provenance })
      await store.write(receipt)
      await expect(store.read()).resolves.toEqual(receipt)
      await expect(readFile(path, 'utf8')).resolves.not.toContain(
        'bearer-token'
      )
      expect(() => updatedReceipt(receipt, { state: 'switched' })).toThrow(
        'RECEIPT_STATE'
      )
      expect(updatedReceipt(receipt, { state: 'prepared' }).state).toBe(
        'prepared'
      )
      expect(
        updatedReceipt(
          updatedReceipt(receipt, { state: 'prepared' }),
          { state: 'switching' }
        ).state
      ).toBe('switching')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test('rejects a stale receipt writer with a durable compare-and-set failure', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'w5e-receipt-cas-'))
    const path = join(directory, 'receipt.json')
    try {
      const first = createReceiptStore(path)
      const second = createReceiptStore(path)
      const receipt = initialReceipt('run-cas', { ...ids }, { ...provenance })
      await first.write(receipt)
      await second.read()
      const prepared = updatedReceipt(receipt, { state: 'prepared' })
      await first.write(prepared)
      await expect(second.write(prepared)).rejects.toThrow('RECEIPT_CAS_FAILED')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test('freezes recovery identity and participation cleanup ownership after prepare', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'w5e-receipt-immutable-'))
    const path = join(directory, 'receipt.json')
    try {
      const store = createReceiptStore(path)
      const receipt = initialReceipt(
        'run-immutable',
        { ...ids },
        { ...provenance }
      )
      await store.write(receipt)
      const prepared = updatedReceipt(receipt, {
        state: 'prepared',
        fixture: { ...ids, participationId: 42 },
        prior: {
          legacyConfig: null,
          legacyServer: null,
        },
      })
      await store.write(prepared)

      await expect(
        store.write(updatedReceipt(prepared, { runId: 'other-run' }))
      ).rejects.toThrow('RECEIPT_IMMUTABLE')
      await expect(
        store.write(
          updatedReceipt(prepared, {
            fixture: { ...prepared.fixture, participationId: 43 },
          })
        )
      ).rejects.toThrow('RECEIPT_IMMUTABLE')
      await expect(
        store.write(
          updatedReceipt(prepared, {
            prior: {
              legacyConfig: {
                id: ids.legacyConfigId,
                chatbotId: ids.chatbotId,
                mcpServerId: ids.candidateServerId,
                chatMode: 'tutor',
                allowedTools: [],
                priority: 0,
                isEnabled: true,
                parameters: null,
                updatedAt: '2026-08-21T00:00:00.000Z',
              },
              legacyServer: null,
            },
          })
        )
      ).rejects.toThrow('RECEIPT_IMMUTABLE')

      const bootstrapStore = createReceiptStore(join(directory, 'bootstrap.json'))
      const bootstrap = initialReceipt(
        'run-bootstrap',
        { ...ids },
        { ...provenance }
      )
      await bootstrapStore.write(bootstrap)
      await expect(
        bootstrapStore.write(
          updatedReceipt(bootstrap, {
            state: 'prepared',
            fixture: { ...ids, ownerId: '00000000-0000-4000-8000-000000000099' },
          })
        )
      ).rejects.toThrow('RECEIPT_IMMUTABLE')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test('suppresses noisy child-consumer output and returns only safe result fields', async () => {
    const log = vi.spyOn(console, 'log')
    const error = vi.spyOn(console, 'error')
    await suppressOutput(async () => {
      console.log('synthetic-bearer-token')
      console.error('synthetic-bearer-token')
    })
    expect(log).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    log.mockRestore()
    error.mockRestore()

    const receipt = initialReceipt('run-2', { ...ids }, { ...provenance })
    expect(safeResult(receipt, new Error('synthetic-bearer-token'))).toEqual({
      status: 'planned',
      phase: 'planned',
      runId: 'run-2',
      reachability: 'not_run',
      proof: 'not_run',
      cleanup: 'incomplete',
      error: 'transaction_failed',
    })
  })

  test('classifies source-matched transport outcomes without retaining request data', async () => {
    let request: Parameters<typeof fetch> | undefined
    const acceptedFetch = vi.fn(async (...args: Parameters<typeof fetch>) => {
      request = args
      return new Response(null, { status: 200 })
    })
    const accepted = await probeFixedRoute(
      'http://127.0.0.1:1417/mcp/klicker',
      'synthetic-bearer-token',
      'synthetic-chatbot-id',
      'local-forward',
      acceptedFetch
    )
    expect(accepted).toEqual({
      path: 'local-forward',
      outcome: 'accepted',
      statusClass: '2xx',
    })
    expect(request?.[1]?.headers).toEqual({
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      authorization: 'Bearer synthetic-bearer-token',
      'Chatbot-ID': 'synthetic-chatbot-id',
    })
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      method: 'initialize',
      params: { protocolVersion: '2025-11-25' },
    })
    expect(JSON.stringify(accepted)).not.toContain('synthetic-bearer-token')

    const statusCases = [
      [401, 'auth_rejected', '4xx'],
      [406, 'negotiation_rejected', '4xx'],
      [404, 'http_4xx', '4xx'],
      [503, 'http_5xx', '5xx'],
    ] as const
    for (const [status, outcome, statusClass] of statusCases) {
      const result = await probeFixedRoute(
        'http://127.0.0.1:1417/mcp/klicker',
        undefined,
        undefined,
        'local-forward',
        vi.fn(
          async (..._args: Parameters<typeof fetch>) =>
            new Response(null, { status })
        )
      )
      expect(result).toEqual({
        path: 'local-forward',
        outcome,
        statusClass,
      })
    }

    const refused = await probeFixedRoute(
      'http://127.0.0.1:1417/mcp/klicker',
      undefined,
      undefined,
      'local-forward',
      vi.fn(async (..._args: Parameters<typeof fetch>) => {
        throw Object.assign(new Error('synthetic-network-error'), {
          cause: { code: 'ECONNREFUSED' },
        })
      })
    )
    expect(refused).toEqual({
      path: 'local-forward',
      outcome: 'connection_refused',
      statusClass: 'none',
    })

    const redirect = await probeFixedRoute(
      'http://127.0.0.1:1417/mcp/klicker',
      undefined,
      undefined,
      'local-forward',
      vi.fn(async (..._args: Parameters<typeof fetch>) => {
        throw Object.assign(new Error('synthetic-fetch-failed'), {
          cause: { message: 'unexpected redirect' },
        })
      })
    )
    expect(redirect).toEqual({
      path: 'local-forward',
      outcome: 'redirect_refused',
      statusClass: 'none',
    })

    const timeoutError = Object.assign(new Error('synthetic-timeout'), {
      name: 'TimeoutError',
    })
    const timeout = await probeFixedRoute(
      'http://127.0.0.1:1417/mcp/klicker',
      undefined,
      undefined,
      'local-forward',
      vi.fn(async (..._args: Parameters<typeof fetch>) => {
        throw timeoutError
      })
    )
    expect(timeout).toEqual({
      path: 'local-forward',
      outcome: 'timeout',
      statusClass: 'none',
    })
  })
})
