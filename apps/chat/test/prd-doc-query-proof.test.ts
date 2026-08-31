import { stat, unlink, writeFile } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, test } from 'vitest'
import {
  createMcpTransport,
  minimalChildEnvironment,
  runProofMatrix,
  superviseProof,
  validateManifest,
  validateWorkerEnvironment,
} from '../scripts/prd-doc-query-proof.mjs'
import type {
  RunProofMatrix,
  SuperviseProof,
} from './doc-query-proof-test-support'
import {
  createProofChildWriter,
  createProofManifest,
  createProofReceiptSources,
  createTemporaryDirectoryRegistry,
  defineProofManifestSuite,
  defineProofMatrixSuite,
  defineProofSupervisorSuite,
  proofDummyEnvironment,
  rejected,
} from './doc-query-proof-test-support'

const manifest = () =>
  createProofManifest({
    environment: 'prd',
    collection: 'klicker_course_materials_v1',
    extraChatbotCases: 7,
  })
const receiptSources = createProofReceiptSources({
  environment: 'prd',
  collection: 'klicker_course_materials_v1',
  passedCounts:
    '{kbExpected:15,kbPassed:15,chatbotsInScope:22,representativeChatbotsExpected:15,representativeChatbotsPassed:15,excludedExpected:2,positivePassed:15,isolationPassed:15,rejectionsPassed:7,directCallsAttempted:37}',
  failedCounts:
    '{kbExpected:15,kbPassed:0,chatbotsInScope:22,representativeChatbotsExpected:15,representativeChatbotsPassed:0,excludedExpected:2,positivePassed:0,isolationPassed:0,rejectionsPassed:0,directCallsAttempted:0}',
})
const proofRegistry = createTemporaryDirectoryRegistry()
const writeDummy = createProofChildWriter(proofRegistry)
afterEach(() => proofRegistry.cleanup())

async function prepareDuplicateLock(lockPath: string) {
  const database = new DatabaseSync(`${lockPath}.guard.sqlite`, { timeout: 0 })
  database.exec('BEGIN EXCLUSIVE')
  return async () => {
    try {
      database.exec('ROLLBACK')
    } finally {
      database.close()
    }
  }
}

defineProofManifestSuite(
  'PRD',
  { validateManifest },
  { manifest, expectedChatbotCount: 22 }
)

describe('PRD Doc Query proof transport', () => {
  test('disables Streamable HTTP reconnection attempts', () => {
    let capturedUrl: URL | undefined
    let capturedOptions: {
      requestInit?: { headers?: Record<string, string>; redirect?: string }
      fetch?: typeof fetch
      reconnectionOptions?: { maxRetries?: number }
    } = {}
    class RecordingTransport {
      constructor(url: URL, options: typeof capturedOptions) {
        capturedUrl = url
        capturedOptions = options
      }
    }

    const headers = { authorization: 'Bearer dummy-transport-token' }
    createMcpTransport(
      headers,
      RecordingTransport as unknown as Parameters<typeof createMcpTransport>[1]
    )

    expect(capturedOptions).toMatchObject({
      requestInit: { headers, redirect: 'error' },
      reconnectionOptions: { maxRetries: 0 },
    })
    expect(capturedUrl?.toString()).toBe(
      'http://mcp-doc-query.prd-doc-query.svc.cluster.local:1417/mcp/klicker'
    )
    expect(capturedOptions.fetch).toBeTypeOf('function')
  })

  test('applies redirect refusal to the transport GET request', async () => {
    const originalFetch = globalThis.fetch
    let capturedInit: RequestInit | undefined
    globalThis.fetch = (async (
      _input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      capturedInit = init
      return new Response(null, { status: 405 })
    }) as typeof fetch
    try {
      let capturedOptions: { fetch?: typeof fetch } = {}
      class RecordingTransport {
        constructor(_url: URL, options: typeof capturedOptions) {
          capturedOptions = options
        }
      }
      createMcpTransport(
        { authorization: 'Bearer dummy-transport-token' },
        RecordingTransport as unknown as Parameters<
          typeof createMcpTransport
        >[1]
      )
      await capturedOptions.fetch?.('https://example.test/mcp', {
        method: 'GET',
      })
      expect(capturedInit).toMatchObject({
        method: 'GET',
        redirect: 'error',
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

describe('PRD Doc Query proof matrix', () => {
  test('does not accept an unrelated tool error as an auth rejection', async () => {
    const validated = validateManifest(manifest())
    const environment = await proofDummyEnvironment()
    let call = 0
    const receipt = await runProofMatrix({
      manifest: validated,
      environment,
      invoke: async ({ question }: { question: string }) => {
        call += 1
        if (call === 3) return rejected('backend unavailable')
        const positive = question.startsWith('positive')
        const marker = question.replace(
          positive ? 'positive fixture ' : 'foreign fixture ',
          positive ? 'positive-marker-' : 'safe-marker-'
        )
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                mode: 'documents',
                summary: { sources_returned: 1, chunks_returned: 1 },
                sources: [{ reference: marker, chunks: [] }],
              }),
            },
          ],
        }
      },
    })
    expect(receipt.failureClass).toBe('rejection_failed')
    expect(receipt.failedRejectionClass).toBe('missing')
    expect(call).toBe(3)
  })
})

defineProofMatrixSuite(
  'PRD',
  {
    validateManifest,
    runProofMatrix: runProofMatrix as unknown as RunProofMatrix,
  },
  {
    manifest,
    environment: proofDummyEnvironment,
    rejection: rejected,
    rejectionWithArguments: () => rejected('invalid arguments'),
    expectedDirectCalls: 37,
    expectedCounts: {
      kbPassed: 15,
      chatbotsInScope: 22,
      representativeChatbotsExpected: 15,
      representativeChatbotsPassed: 15,
      positivePassed: 15,
      isolationPassed: 15,
      rejectionsPassed: 7,
      directCallsAttempted: 37,
    },
  }
)

defineProofSupervisorSuite(
  'PRD',
  {
    minimalChildEnvironment,
    validateWorkerEnvironment,
    superviseProof: superviseProof as unknown as SuperviseProof,
  },
  {
    dummyEnvironment: proofDummyEnvironment,
    writeDummy,
    prepareDuplicateLock,
    passedReceiptSource: receiptSources.passedReceiptSource,
    failedReceiptSource: receiptSources.failedReceiptSource,
  }
)

describe('PRD Doc Query proof supervisor', () => {
  test('refuses a concurrent proof while the advisory lock is held', async () => {
    const dummy = await writeDummy(
      receiptSources.passedReceiptSource(
        'await new Promise((resolve) => setTimeout(resolve, 200))'
      )
    )
    const first = superviseProof({
      sourceEnvironment:
        (await proofDummyEnvironment()) as unknown as NodeJS.ProcessEnv,
      childPath: dummy.path,
      childArgs: [],
      lockPath: dummy.lockPath,
      deadlineMs: 2_000,
    })
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        await stat(`${dummy.lockPath}.guard.sqlite`)
        break
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
    }

    const second = await superviseProof({
      sourceEnvironment:
        (await proofDummyEnvironment()) as unknown as NodeJS.ProcessEnv,
      childPath: dummy.path,
      childArgs: [],
      lockPath: dummy.lockPath,
      deadlineMs: 2_000,
    })

    expect(second.failureClass).toBe('duplicate_refused')
    expect((await first).result).toBe('passed')
  })

  test('does not remove a replacement proof lock during cleanup', async () => {
    const dummy = await writeDummy(
      receiptSources.passedReceiptSource(
        'await new Promise((resolve) => setTimeout(resolve, 200))'
      )
    )
    const proof = superviseProof({
      sourceEnvironment:
        (await proofDummyEnvironment()) as unknown as NodeJS.ProcessEnv,
      childPath: dummy.path,
      childArgs: [],
      lockPath: dummy.lockPath,
      deadlineMs: 2_000,
    })
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        await stat(dummy.lockPath)
        break
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
    }
    await unlink(dummy.lockPath)
    await writeFile(dummy.lockPath, 'replacement', { flag: 'wx', mode: 0o600 })
    const replacement = await stat(dummy.lockPath)

    expect((await proof).result).toBe('passed')
    expect((await stat(dummy.lockPath)).ino).toBe(replacement.ino)
  })

  test('closes the advisory proof lock when child setup fails', async () => {
    const dummy = await writeDummy(receiptSources.passedReceiptSource())
    let closed = false
    const receipt = await superviseProof({
      sourceEnvironment:
        (await proofDummyEnvironment()) as unknown as NodeJS.ProcessEnv,
      childPath: `${dummy.path}.missing`,
      childArgs: [],
      lockPath: dummy.lockPath,
      acquireLockForProof: async () =>
        ({
          close: async () => {
            closed = true
          },
        }) as unknown as { close: () => Promise<void> },
    })

    expect(receipt.failureClass).toBe('child_failed')
    expect(closed).toBe(true)
  })
})
