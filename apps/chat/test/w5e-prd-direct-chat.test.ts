import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test, vi } from 'vitest'
import {
  createReceiptStore,
  initialReceipt,
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
      proof: 'not_run',
      cleanup: 'incomplete',
      error: 'transaction_failed',
    })
  })
})
