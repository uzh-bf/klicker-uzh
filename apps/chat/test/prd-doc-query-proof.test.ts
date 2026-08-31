import { mkdtemp, open, stat, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
import {
  createProofChildWriter,
  createProofManifest,
  createProofReceiptSources,
  createTemporaryDirectoryRegistry,
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

async function proofProcessEnvironment(): Promise<NodeJS.ProcessEnv> {
  return { ...(await proofDummyEnvironment()), NODE_ENV: 'test' }
}

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

describe('PRD Doc Query proof manifest', () => {
  test('accepts exactly 15 KBs, the configured chatbot targets, and two exclusions', () => {
    const validated = validateManifest(manifest())
    expect(validated.cases).toHaveLength(15)
    expect(
      validated.cases.flatMap(
        (entry: { chatbotIds: string[] }) => entry.chatbotIds
      )
    ).toHaveLength(22)
    expect(validated.cases[0].chatbotIds).toHaveLength(1)
    expect(validated.excludedChatbotIds).toHaveLength(2)
  })

  test('refuses duplicate target chatbots before any proof call', () => {
    const duplicate = manifest() as {
      cases: Array<{ kbId: string; chatbotIds: string[] }>
    }
    duplicate.cases[1].chatbotIds[0] =
      duplicate.cases[0].chatbotIds[0].toUpperCase()
    expect(() => validateManifest(duplicate)).toThrow('manifest_refused')
  })

  test('canonicalizes UUIDs before every cardinality check', () => {
    const duplicateKb = manifest() as {
      cases: Array<{ kbId: string; chatbotIds: string[] }>
      excludedChatbotIds: string[]
    }
    duplicateKb.cases[1].kbId = duplicateKb.cases[0].kbId.toUpperCase()
    expect(() => validateManifest(duplicateKb)).toThrow('manifest_refused')

    const overlappingExclusion = manifest() as typeof duplicateKb
    overlappingExclusion.excludedChatbotIds[0] =
      overlappingExclusion.cases[0].chatbotIds[0].toUpperCase()
    expect(() => validateManifest(overlappingExclusion)).toThrow(
      'manifest_refused'
    )
  })

  test('requires source-reference isolation markers', () => {
    const legacy = manifest() as {
      cases: Array<{
        foreign: {
          question: string
          forbidReferences?: string[]
          forbidAny?: string[]
        }
      }>
    }
    const foreign = legacy.cases[0].foreign
    foreign.forbidAny = foreign.forbidReferences
    delete foreign.forbidReferences
    expect(() => validateManifest(legacy)).toThrow('manifest_refused')

    const mixed = manifest() as typeof legacy
    const mixedForeign = mixed.cases[0].foreign as {
      question: string
      forbidReferences: string[]
      forbidAny?: string[]
    }
    mixedForeign.forbidAny = mixedForeign.forbidReferences
    expect(() => validateManifest(mixed)).toThrow('manifest_refused')
  })
})

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

  test('runs the singleton canary, seven rejections, then the serial matrix', async () => {
    const validated = validateManifest(manifest())
    const environment = await proofDummyEnvironment()
    let call = 0
    const invoke = async ({
      question,
      override,
    }: {
      question: string
      override?: string
    }) => {
      call += 1
      if ((call >= 3 && call <= 8) || override) {
        return override ? rejected('invalid arguments') : rejected()
      }
      const positive = question.startsWith('positive')
      const marker = question.replace(
        positive ? 'positive fixture ' : 'foreign fixture ',
        positive ? 'positive-marker-' : 'foreign-reference-'
      )
      return {
        isError: false,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              mode: 'documents',
              summary: { sources_returned: 1, chunks_returned: 1 },
              sources: [
                positive
                  ? {
                      reference: 'safe-positive-reference',
                      chunks: [{ content: marker }],
                    }
                  : {
                      reference: 'safe-foreign-reference',
                      chunks: [{ content: marker }],
                    },
              ],
            }),
          },
        ],
      }
    }

    const receipt = await runProofMatrix({
      manifest: validated,
      environment,
      invoke,
    })

    expect(call).toBe(37)
    expect(receipt.result).toBe('passed')
    expect(receipt.counts).toMatchObject({
      kbPassed: 15,
      chatbotsInScope: 22,
      representativeChatbotsExpected: 15,
      representativeChatbotsPassed: 15,
      positivePassed: 15,
      isolationPassed: 15,
      rejectionsPassed: 7,
      directCallsAttempted: 37,
    })
  })

  test('fails when a foreign source reference is returned', async () => {
    const validated = validateManifest(manifest())
    const environment = await proofDummyEnvironment()
    let calls = 0
    const receipt = await runProofMatrix({
      manifest: validated,
      environment,
      invoke: async ({ question }: { question: string }) => {
        calls += 1
        const positive = question.startsWith('positive')
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                mode: 'documents',
                summary: { sources_returned: 1, chunks_returned: 1 },
                sources: [
                  {
                    reference: positive
                      ? 'safe-positive-reference'
                      : 'foreign-reference-1',
                    chunks: [
                      {
                        content: positive
                          ? question.replace(
                              'positive fixture ',
                              'positive-marker-'
                            )
                          : 'overlapping subject terminology',
                      },
                    ],
                  },
                ],
              }),
            },
          ],
        }
      },
    })
    expect(receipt.failureClass).toBe('canary_isolation_failed')
    expect(calls).toBe(2)
  })

  test('stops on the first invariant failure without retrying', async () => {
    const validated = validateManifest(manifest())
    const environment = await proofDummyEnvironment()
    let calls = 0
    const receipt = await runProofMatrix({
      manifest: validated,
      environment,
      invoke: async () => {
        calls += 1
        return rejected('backend unavailable')
      },
    })
    expect(receipt.failureClass).toBe('canary_positive_failed')
    expect(calls).toBe(1)
  })

  test('sends both protected fields in the trusted-filter rejection case', async () => {
    const validated = validateManifest(manifest())
    const environment = await proofDummyEnvironment()
    const overrides: string[] = []
    let call = 0
    const receipt = await runProofMatrix({
      manifest: validated,
      environment,
      invoke: async ({ question, override }) => {
        call += 1
        if (override) overrides.push(override)
        if (override) return rejected('invalid arguments')
        if (call >= 3 && call <= 8) return rejected()
        const positive = question.startsWith('positive')
        const marker = question.replace(
          positive ? 'positive fixture ' : 'foreign fixture ',
          positive ? 'positive-marker-' : 'safe-marker-'
        )
        return {
          isError: false,
          content: [
            {
              type: 'text' as const,
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
    expect(receipt.result).toBe('passed')
    expect(overrides).toEqual([validated.cases[1].kbId])
  })
})

describe('PRD Doc Query proof supervisor', () => {
  test('passes only the allowlisted environment', async () => {
    const environment = await proofDummyEnvironment()
    const childEnvironment = minimalChildEnvironment(
      { ...environment, LEAK_ME: 'must-not-pass' },
      123
    )
    expect(childEnvironment).not.toHaveProperty('LEAK_ME')
    expect(childEnvironment).not.toHaveProperty('PATH')
    expect(Object.keys(childEnvironment).sort()).toEqual(
      [
        'DOC_QUERY_JWT_TOKEN_KLICKER',
        'DOC_QUERY_SCOPE_AUDIENCE',
        'DOC_QUERY_SCOPE_ISSUER',
        'DOC_QUERY_SCOPE_KID',
        'DOC_QUERY_SCOPE_PRIVATE_KEY',
        'DOC_QUERY_PROOF_PARENT_PID',
        'DOC_QUERY_PROOF_MANIFEST_PATH',
      ].sort()
    )
  })

  test('rejects unexpected worker environment names while allowing the platform marker', async () => {
    const environment = await proofDummyEnvironment()
    expect(() =>
      validateWorkerEnvironment({
        ...environment,
        DOC_QUERY_PROOF_PARENT_PID: '123',
        __CF_USER_TEXT_ENCODING: '0x1F5:0x0:0x0',
      })
    ).not.toThrow()
    expect(() =>
      validateWorkerEnvironment({
        ...environment,
        DOC_QUERY_PROOF_PARENT_PID: '123',
        LEAK_ME: 'must-not-pass',
      })
    ).toThrow('protocol_failed')
  })

  test('suppresses noisy child output and returns only a fixed receipt', async () => {
    const dummy = await writeDummy(
      receiptSources.passedReceiptSource(
        "process.stdout.write('dummy-transport-token'); process.stderr.write('dummy-private-key')"
      )
    )
    const receipt = await superviseProof({
      sourceEnvironment: await proofProcessEnvironment(),
      childPath: dummy.path,
      childArgs: [],
      lockPath: dummy.lockPath,
      deadlineMs: 2_000,
    })
    expect(receipt.result).toBe('passed')
    expect(JSON.stringify(receipt)).not.toContain('dummy-transport-token')
    expect(JSON.stringify(receipt)).not.toContain('dummy-private-key')
  })

  test.each([
    [
      'an incomplete receipt',
      () =>
        receiptSources
          .passedReceiptSource()
          .replace("phase: 'complete'", "phase: 'matrix'"),
      'protocol_failed',
    ],
    [
      'missing preservation evidence',
      () => receiptSources.passedReceiptSource('', 'undefined'),
      'protocol_failed',
    ],
    [
      'non-zero preservation evidence',
      () =>
        receiptSources.passedReceiptSource(
          '',
          '{databaseWrites:1,configurationChanges:0,bindingChanges:0,clusterChanges:0,productionActions:0,retries:0}'
        ),
      'protocol_failed',
    ],
    [
      'an exit-mismatched receipt',
      () =>
        receiptSources
          .passedReceiptSource()
          .replace('process.exit(0)', 'process.exit(1)'),
      'child_failed',
    ],
    ['a missing receipt', () => 'process.exit(0)', 'child_failed'],
  ] as Array<[string, () => string, string]>)(
    'rejects %s',
    async (_name, source, expectedFailure) => {
      const dummy = await writeDummy(source())
      const receipt = await superviseProof({
        sourceEnvironment: await proofProcessEnvironment(),
        childPath: dummy.path,
        childArgs: [],
        lockPath: dummy.lockPath,
        deadlineMs: 2_000,
      })
      expect(receipt.result).toBe('failed')
      expect(receipt.failureClass).toBe(expectedFailure)
    }
  )

  test('preserves a protocol failure when a failed child claims writes', async () => {
    const dummy = await writeDummy(
      receiptSources.failedReceiptSource(
        '{databaseWrites:1,configurationChanges:0,bindingChanges:0,clusterChanges:0,productionActions:0,retries:0}'
      )
    )
    const receipt = await superviseProof({
      sourceEnvironment: await proofProcessEnvironment(),
      childPath: dummy.path,
      childArgs: [],
      lockPath: dummy.lockPath,
      deadlineMs: 2_000,
    })
    expect(receipt).toMatchObject({
      result: 'failed',
      failureClass: 'protocol_failed',
      exitCode: 1,
      preservation: {
        databaseWrites: 0,
        configurationChanges: 0,
        bindingChanges: 0,
        clusterChanges: 0,
        productionActions: 0,
        retries: 0,
      },
    })
    expect(JSON.stringify(receipt)).not.toContain('dummy-private-key')
  })

  test('passes no unrelated environment or file descriptor to the child', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'klicker-doc-query-fd-test-')
    )
    proofRegistry.register(directory)
    const unrelated = await open(join(directory, 'unrelated'), 'w')
    const allowedEnvironmentNames = [
      'DOC_QUERY_JWT_TOKEN_KLICKER',
      'DOC_QUERY_SCOPE_AUDIENCE',
      'DOC_QUERY_SCOPE_ISSUER',
      'DOC_QUERY_SCOPE_KID',
      'DOC_QUERY_SCOPE_PRIVATE_KEY',
      'DOC_QUERY_PROOF_PARENT_PID',
      'DOC_QUERY_PROOF_MANIFEST_PATH',
      '__CF_USER_TEXT_ENCODING',
    ]
    const source = [
      "import { fstatSync, readFileSync } from 'node:fs'",
      'const allowed = new Set(' +
        JSON.stringify(allowedEnvironmentNames) +
        ')',
      'if (Object.keys(process.env).some((name) => !allowed.has(name))) process.exit(8)',
      'if (readFileSync(0).length !== 0) process.exit(9)',
      'try {',
      `  fstatSync(${unrelated.fd})`,
      '  process.exit(10)',
      '} catch (error) {',
      "  if (error?.code !== 'EBADF') process.exit(11)",
      '}',
      receiptSources.passedReceiptSource(),
      '',
    ].join('\n')
    const dummy = await writeDummy(source)
    const receipt = await superviseProof({
      sourceEnvironment: {
        ...(await proofDummyEnvironment()),
        NODE_ENV: 'test',
        LEAK_ME: 'must-not-pass',
      },
      childPath: dummy.path,
      childArgs: [],
      lockPath: dummy.lockPath,
      deadlineMs: 2_000,
    })
    await unrelated.close()
    expect(receipt.result).toBe('passed')
  })

  test('preserves a values-free failure receipt from a failed child', async () => {
    const dummy = await writeDummy(receiptSources.failedReceiptSource())
    const receipt = await superviseProof({
      sourceEnvironment: await proofProcessEnvironment(),
      childPath: dummy.path,
      childArgs: [],
      lockPath: dummy.lockPath,
      deadlineMs: 2_000,
    })
    expect(receipt).toMatchObject({
      result: 'failed',
      failureClass: 'canary_positive_failed',
      failedCaseId: 'corpus_1',
      exitCode: 1,
    })
    expect(JSON.stringify(receipt)).not.toContain('dummy-private-key')
  })

  test.each([
    ['exit', 'process.exit(7)', 'child_failed'],
    ['signal', "process.kill(process.pid, 'SIGTERM')", 'child_signaled'],
    ['timeout', 'setInterval(() => {}, 1000)', 'timeout'],
  ])('classifies %s without retrying', async (_name, source, expected) => {
    const dummy = await writeDummy(source)
    const receipt = await superviseProof({
      sourceEnvironment: await proofProcessEnvironment(),
      childPath: dummy.path,
      childArgs: [],
      lockPath: dummy.lockPath,
      deadlineMs: expected === 'timeout' ? 50 : 2_000,
    })
    expect(receipt.failureClass).toBe(expected)
  })

  test('refuses a duplicate invocation before spawning', async () => {
    const dummy = await writeDummy(receiptSources.passedReceiptSource())
    const release = await prepareDuplicateLock(dummy.lockPath)
    try {
      const receipt = await superviseProof({
        sourceEnvironment: await proofProcessEnvironment(),
        childPath: dummy.path,
        childArgs: [],
        lockPath: dummy.lockPath,
      })
      expect(receipt.failureClass).toBe('duplicate_refused')
      expect(receipt.exitCode).toBeNull()
    } finally {
      await release()
    }
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
