import { EventEmitter } from 'node:events'
import { stat, unlink, writeFile } from 'node:fs/promises'
import { afterEach, describe, expect, test } from 'vitest'
import {
  computeManifestFingerprint,
  createMcpTransport,
  minimalChildEnvironment,
  runProofMatrix,
  superviseProof,
  validateManifest,
  validateWorkerEnvironment,
} from '../scripts/stg-doc-query-proof.mjs'
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

const activationManifestFingerprint = 'a'.repeat(64)
const manifest = () => {
  const base = createProofManifest({
    environment: 'stg',
    collection: 'klicker_course_materials_v1',
    extraChatbotCases: 6,
    version: 2,
    activationManifestFingerprint,
  })
  return {
    ...base,
    manifestFingerprint: computeManifestFingerprint(base),
  }
}
const proofManifestFingerprint = (manifest() as { manifestFingerprint: string })
  .manifestFingerprint
const validateTestManifest = (input: unknown) =>
  validateManifest(input, proofManifestFingerprint)
async function proofDummyEnvironmentWithPin(): Promise<Record<string, string>> {
  return {
    ...(await proofDummyEnvironment()),
    DOC_QUERY_PROOF_MANIFEST_FINGERPRINT: proofManifestFingerprint,
  }
}
const receiptSources = createProofReceiptSources({
  environment: 'stg',
  collection: 'klicker_course_materials_v1',
  passedCounts:
    '{kbExpected:15,kbPassed:15,chatbotsInScope:21,representativeChatbotsExpected:15,representativeChatbotsPassed:15,excludedExpected:2,positivePassed:15,isolationPassed:15,directCallsAttempted:30}',
  failedCounts:
    '{kbExpected:15,kbPassed:0,chatbotsInScope:21,representativeChatbotsExpected:15,representativeChatbotsPassed:0,excludedExpected:2,positivePassed:0,isolationPassed:0,directCallsAttempted:0}',
})
const proofRegistry = createTemporaryDirectoryRegistry()
const writeDummy = createProofChildWriter(proofRegistry)
afterEach(() => proofRegistry.cleanup())

async function proofProcessEnvironment(): Promise<NodeJS.ProcessEnv> {
  return { ...(await proofDummyEnvironmentWithPin()), NODE_ENV: 'test' }
}

defineProofManifestSuite(
  'STG',
  { validateManifest: validateTestManifest },
  {
    manifest,
    expectedChatbotCount: 21,
    expectFingerprintBinding: true,
  }
)

describe('STG Doc Query proof manifest integrity', () => {
  test('refuses a manifest whose fingerprint does not match the trusted pin', () => {
    const trustedPin = proofManifestFingerprint.replace(
      /^./,
      proofManifestFingerprint.startsWith('0') ? '1' : '0'
    )
    expect(() => validateManifest(manifest(), trustedPin)).toThrow(
      'manifest_refused'
    )
  })
})

describe('STG Doc Query proof transport', () => {
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

    const mintScopeToken = async () => 'scope'
    createMcpTransport(
      mintScopeToken,
      RecordingTransport as unknown as Parameters<typeof createMcpTransport>[1]
    )

    expect(capturedOptions).toMatchObject({
      requestInit: { redirect: 'error' },
      reconnectionOptions: { maxRetries: 0 },
    })
    expect(capturedUrl?.toString()).toBe(
      'http://mcp-doc-query.stg-doc-query.svc.cluster.local:1417/mcp/klicker/kb'
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
      let minted = 0
      createMcpTransport(
        async () => String(++minted),
        RecordingTransport as unknown as Parameters<
          typeof createMcpTransport
        >[1]
      )
      const target =
        'http://mcp-doc-query.stg-doc-query.svc.cluster.local:1417/mcp/klicker/kb'
      for (const sequence of [1, 2]) {
        await capturedOptions.fetch?.(target, {
          method: 'GET',
          headers: { Authorization: 'unused' },
        })
        expect(capturedInit?.redirect).toBe('error')
        const headers = new Headers(capturedInit?.headers)
        expect(headers.has('authorization')).toBe(false)
        expect(headers.get('X-Doc-Query-Scope-Token')).toBe(
          `Bearer ${sequence}`
        )
      }
      await expect(
        capturedOptions.fetch?.('https://example.test/mcp')
      ).rejects.toThrow()
      expect(minted).toBe(2)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

describe('STG Doc Query proof matrix', () => {
  test('classifies signer setup failures without serializing their value', async () => {
    const validated = validateTestManifest(manifest())
    const environment = await proofDummyEnvironmentWithPin()
    environment.DOC_QUERY_SCOPE_PRIVATE_KEY = 'dummy-sensitive-setup-value'
    const receipt = await runProofMatrix({
      manifest: validated,
      environment,
      invoke: async () => rejected(),
    })
    expect(receipt).toMatchObject({
      result: 'failed',
      failureClass: 'credential_missing',
      diagnosticClass: 'signer_setup',
    })
    expect(JSON.stringify(receipt)).not.toContain('dummy-sensitive-setup-value')
  })

  test.each([
    ['scope_signing', 'dummy-sensitive-signing-value'],
    ['mcp_invocation', 'dummy-sensitive-mcp-value'],
  ])('classifies %s failures without serializing error details', async (expectedDiagnostic, sensitiveValue) => {
    const validated = validateTestManifest(manifest())
    const environment = await proofDummyEnvironmentWithPin()
    const receipt = await runProofMatrix({
      manifest: validated,
      environment,
      createSigner: async () => async () => {
        if (expectedDiagnostic === 'scope_signing') {
          throw new Error(sensitiveValue)
        }
        return 'synthetic-scope-token'
      },
      invoke: async ({ mintScopeToken }) => {
        await mintScopeToken()
        throw new Error(sensitiveValue)
      },
    })
    expect(receipt).toMatchObject({
      result: 'failed',
      failureClass: 'protocol_failed',
      diagnosticClass: expectedDiagnostic,
    })
    expect(JSON.stringify(receipt)).not.toContain(sensitiveValue)
  })
})

defineProofMatrixSuite(
  'STG',
  {
    validateManifest: validateTestManifest,
    runProofMatrix: runProofMatrix as unknown as RunProofMatrix,
  },
  {
    manifest,
    environment: proofDummyEnvironmentWithPin,
    rejection: rejected,
    expectedDirectCalls: 30,
    expectedCounts: {
      kbPassed: 15,
      chatbotsInScope: 21,
      representativeChatbotsExpected: 15,
      representativeChatbotsPassed: 15,
      positivePassed: 15,
      isolationPassed: 15,
      directCallsAttempted: 30,
    },
  }
)

defineProofSupervisorSuite(
  'STG',
  {
    minimalChildEnvironment,
    validateWorkerEnvironment,
    superviseProof: superviseProof as unknown as SuperviseProof,
  },
  {
    dummyEnvironment: proofDummyEnvironmentWithPin,
    writeDummy,
    passedReceiptSource: receiptSources.passedReceiptSource,
    failedReceiptSource: receiptSources.failedReceiptSource,
    expectProofManifestFingerprint: true,
  }
)

describe('STG Doc Query proof supervisor', () => {
  test('does not preserve a failed receipt when the child exit is unknown', async () => {
    const dummy = await writeDummy(receiptSources.failedReceiptSource())
    const child = new EventEmitter() as EventEmitter & { pid: number }
    child.pid = 12345
    const failedReceipt = {
      receiptVersion: 2,
      environment: 'stg',
      collection: 'klicker_course_materials_v1',
      phase: 'canary',
      result: 'failed',
      failureClass: 'canary_positive_failed',
      diagnosticClass: 'none',
      failedCaseId: 'corpus_1',
      counts: {
        kbExpected: 15,
        kbPassed: 0,
        chatbotsInScope: 21,
        representativeChatbotsExpected: 15,
        representativeChatbotsPassed: 0,
        excludedExpected: 2,
        positivePassed: 0,
        isolationPassed: 0,
        directCallsAttempted: 0,
      },
      preservation: {
        databaseWrites: 0,
        configurationChanges: 0,
        bindingChanges: 0,
        clusterChanges: 0,
        productionActions: 0,
        retries: 0,
      },
    }

    const receipt = await superviseProof({
      sourceEnvironment: await proofProcessEnvironment(),
      childPath: dummy.path,
      childArgs: [],
      lockPath: dummy.lockPath,
      acquireLockForProof: async () => ({ close: async () => undefined }),
      spawnForProof: (() => {
        queueMicrotask(() => {
          child.emit('message', failedReceipt)
          child.emit('error', new Error('synthetic child error'))
        })
        return child
      }) as unknown as typeof import('node:child_process').spawn,
    })

    expect(receipt).toMatchObject({
      result: 'failed',
      failureClass: 'child_failed',
      diagnosticClass: 'worker_protocol',
      exitCode: null,
      signal: null,
    })
  })

  test('returns a fixed receipt when advisory lock setup fails', async () => {
    const dummy = await writeDummy(receiptSources.passedReceiptSource())
    const receipt = await superviseProof({
      sourceEnvironment: await proofProcessEnvironment(),
      childPath: dummy.path,
      childArgs: [],
      lockPath: dummy.lockPath,
      acquireLockForProof: async () => {
        throw new Error('synthetic lock setup failure')
      },
    })

    expect(receipt).toMatchObject({
      result: 'failed',
      failureClass: 'child_failed',
      exitCode: null,
      signal: null,
    })
  })

  test('refuses a concurrent proof while the advisory lock is held', async () => {
    const dummy = await writeDummy(
      receiptSources.passedReceiptSource(
        'await new Promise((resolve) => setTimeout(resolve, 200))'
      )
    )
    const first = superviseProof({
      sourceEnvironment: await proofProcessEnvironment(),
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
      sourceEnvironment: await proofProcessEnvironment(),
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
      sourceEnvironment: await proofProcessEnvironment(),
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
      sourceEnvironment: await proofProcessEnvironment(),
      childPath: `${dummy.path}.missing`,
      childArgs: [],
      lockPath: dummy.lockPath,
      acquireLockForProof: async () => ({
        close: async () => {
          closed = true
        },
      }),
    })

    expect(receipt.failureClass).toBe('child_failed')
    expect(closed).toBe(true)
  })
})
