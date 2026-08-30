import { mkdtemp, open, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { exportPKCS8, generateKeyPair } from 'jose'
import { afterEach, describe, expect, test } from 'vitest'
import {
  createMcpTransport,
  minimalChildEnvironment,
  runProofMatrix,
  superviseProof,
  validateManifest,
  validateWorkerEnvironment,
} from '../scripts/prd-doc-query-proof.mjs'

const temporaryDirectories: string[] = []

type MockToolResult = {
  isError?: boolean
  content: Array<{ type: 'text'; text: string }>
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true }))
  )
})

function uuid(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
}

function manifest() {
  let chatbotIndex = 100
  const cases = Array.from({ length: 15 }, (_, index) => ({
    id: `corpus_${index + 1}`,
    kbId: uuid(index + 1),
    chatbotIds: Array.from(
      { length: index === 0 ? 1 : index <= 7 ? 2 : 1 },
      () => uuid(chatbotIndex++)
    ),
    positive: {
      question: `positive fixture ${index + 1}`,
      expectAny: [`positive-marker-${index + 1}`],
      minSources: 1,
    },
    foreign: {
      question: `foreign fixture ${index + 1}`,
      forbidReferences: [`foreign-reference-${index + 1}`],
    },
  }))
  return {
    version: 1,
    environment: 'prd',
    collection: 'klicker_course_materials_v1',
    singletonCanaryCaseId: 'corpus_1',
    cases,
    excludedChatbotIds: [uuid(900), uuid(901)],
  }
}

async function dummyEnvironment() {
  const { privateKey } = await generateKeyPair('ES256')
  return {
    DOC_QUERY_JWT_TOKEN_KLICKER: 'dummy-transport-token',
    DOC_QUERY_SCOPE_PRIVATE_KEY: await exportPKCS8(privateKey),
    DOC_QUERY_SCOPE_KID: 'dummy-key',
    DOC_QUERY_SCOPE_ISSUER: 'https://chat.klicker.test',
    DOC_QUERY_SCOPE_AUDIENCE: 'klicker-doc-query-test',
    DOC_QUERY_PROOF_MANIFEST_PATH: '/private/tmp/dummy-manifest.json',
  }
}

function passedReceiptSource(
  extra = '',
  preservation = '{databaseWrites:0,configurationChanges:0,bindingChanges:0,clusterChanges:0,productionActions:0,retries:0}'
) {
  return `
${extra}
process.send({
  receiptVersion: 1,
  environment: 'prd',
  collection: 'klicker_course_materials_v1',
  phase: 'complete',
  result: 'passed',
  failureClass: 'none',
  failedCaseId: null,
  failedRejectionClass: null,
  counts: {kbExpected:15,kbPassed:15,chatbotsExpected:22,chatbotsPassed:22,excludedExpected:2,positivePassed:22,isolationPassed:22,rejectionsPassed:7},
  rejections: {missing:'passed',expired:'passed',forged:'passed',wrong_issuer:'passed',wrong_audience:'passed',unknown_key:'passed',trusted_filter_override:'passed'},
  preservation: ${preservation}
}, () => process.exit(0))
`
}

function failedReceiptSource() {
  return `
process.send({
  receiptVersion: 1,
  environment: 'prd',
  collection: 'klicker_course_materials_v1',
  phase: 'canary',
  result: 'failed',
  failureClass: 'canary_positive_failed',
  failedCaseId: 'corpus_1',
  failedRejectionClass: null,
  counts: {kbExpected:15,kbPassed:0,chatbotsExpected:22,chatbotsPassed:0,excludedExpected:2,positivePassed:0,isolationPassed:0,rejectionsPassed:0},
  rejections: {missing:'not_run',expired:'not_run',forged:'not_run',wrong_issuer:'not_run',wrong_audience:'not_run',unknown_key:'not_run',trusted_filter_override:'not_run'},
  secret: 'dummy-private-key'
}, () => process.exit(1))
`
}

async function writeDummy(source: string) {
  const directory = await mkdtemp(
    join(tmpdir(), 'klicker-doc-query-proof-test-')
  )
  temporaryDirectories.push(directory)
  const path = join(directory, 'child.mjs')
  await writeFile(path, source, { mode: 0o700 })
  return { path, lockPath: join(directory, 'proof.lock') }
}

describe('PRD Doc Query proof manifest', () => {
  test('accepts exactly 15 KBs, 22 target chatbots, and two exclusions', () => {
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
    const duplicate = manifest()
    duplicate.cases[1].chatbotIds[0] =
      duplicate.cases[0].chatbotIds[0].toUpperCase()
    expect(() => validateManifest(duplicate)).toThrow('manifest_refused')
  })

  test('canonicalizes UUIDs before every cardinality check', () => {
    const duplicateKb = manifest()
    duplicateKb.cases[1].kbId = duplicateKb.cases[0].kbId.toUpperCase()
    expect(() => validateManifest(duplicateKb)).toThrow('manifest_refused')

    const overlappingExclusion = manifest()
    overlappingExclusion.excludedChatbotIds[0] =
      overlappingExclusion.cases[0].chatbotIds[0].toUpperCase()
    expect(() => validateManifest(overlappingExclusion)).toThrow(
      'manifest_refused'
    )
  })

  test('requires source-reference isolation markers', () => {
    const legacy = manifest()
    const foreign = legacy.cases[0].foreign as {
      question: string
      forbidReferences?: string[]
      forbidAny?: string[]
    }
    foreign.forbidAny = foreign.forbidReferences
    delete foreign.forbidReferences
    expect(() => validateManifest(legacy)).toThrow('manifest_refused')

    const mixed = manifest()
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
    let capturedOptions: {
      requestInit?: { headers?: Record<string, string>; redirect?: string }
      reconnectionOptions?: { maxRetries?: number }
    } = {}
    class RecordingTransport {
      constructor(_url: URL, options: typeof capturedOptions) {
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
  })
})

describe('PRD Doc Query proof matrix', () => {
  test('runs the singleton canary, seven rejections, then the serial matrix', async () => {
    const validated = validateManifest(manifest())
    const environment = await dummyEnvironment()
    let call = 0
    const invoke = async ({
      question,
      override,
    }: {
      question: string
      override?: string
    }): Promise<MockToolResult> => {
      call += 1
      if ((call >= 3 && call <= 8) || override) {
        return { isError: true, content: [] }
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
            type: 'text',
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

    expect(call).toBe(51)
    expect(receipt.result).toBe('passed')
    expect(receipt.counts).toMatchObject({
      kbPassed: 15,
      chatbotsPassed: 22,
      positivePassed: 22,
      isolationPassed: 22,
      rejectionsPassed: 7,
    })
  })

  test('fails when a foreign source reference is returned', async () => {
    const validated = validateManifest(manifest())
    const environment = await dummyEnvironment()
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
              type: 'text',
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
    const environment = await dummyEnvironment()
    let calls = 0
    const receipt = await runProofMatrix({
      manifest: validated,
      environment,
      invoke: async () => {
        calls += 1
        return { isError: true, content: [] }
      },
    })
    expect(receipt.failureClass).toBe('canary_positive_failed')
    expect(calls).toBe(1)
  })

  test('sends both protected fields in the trusted-filter rejection case', async () => {
    const validated = validateManifest(manifest())
    const environment = await dummyEnvironment()
    const overrides: string[] = []
    let call = 0
    const receipt = await runProofMatrix({
      manifest: validated,
      environment,
      invoke: async ({
        question,
        override,
      }: {
        question: string
        override?: string
      }) => {
        call += 1
        if (override) overrides.push(override)
        if ((call >= 3 && call <= 8) || override) {
          return { isError: true, content: [] }
        }
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
    expect(receipt.result).toBe('passed')
    expect(overrides).toEqual([validated.cases[1].kbId])
  })
})

describe('PRD Doc Query proof supervisor', () => {
  test('passes only the allowlisted environment', async () => {
    const environment = await dummyEnvironment()
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
    const environment = await dummyEnvironment()
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
      passedReceiptSource(
        "process.stdout.write('dummy-transport-token'); process.stderr.write('dummy-private-key')"
      )
    )
    const receipt = await superviseProof({
      sourceEnvironment:
        (await dummyEnvironment()) as unknown as NodeJS.ProcessEnv,
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
      passedReceiptSource().replace("phase: 'complete'", "phase: 'matrix'"),
      'protocol_failed',
    ],
    [
      'missing preservation evidence',
      passedReceiptSource('', 'undefined'),
      'protocol_failed',
    ],
    [
      'non-zero preservation evidence',
      passedReceiptSource(
        '',
        '{databaseWrites:1,configurationChanges:0,bindingChanges:0,clusterChanges:0,productionActions:0,retries:0}'
      ),
      'protocol_failed',
    ],
    [
      'an exit-mismatched receipt',
      passedReceiptSource().replace('process.exit(0)', 'process.exit(1)'),
      'child_failed',
    ],
    ['a missing receipt', 'process.exit(0)', 'child_failed'],
  ])('rejects %s', async (_name, source, expectedFailure) => {
    const dummy = await writeDummy(source)
    const receipt = await superviseProof({
      sourceEnvironment:
        (await dummyEnvironment()) as unknown as NodeJS.ProcessEnv,
      childPath: dummy.path,
      childArgs: [],
      lockPath: dummy.lockPath,
      deadlineMs: 2_000,
    })
    expect(receipt.result).toBe('failed')
    expect(receipt.failureClass).toBe(expectedFailure)
  })

  test('passes no unrelated environment or file descriptor to the child', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'klicker-doc-query-fd-test-')
    )
    temporaryDirectories.push(directory)
    const unrelated = await open(join(directory, 'unrelated'), 'w')
    const dummy = await writeDummy(
      `
import { fstatSync, readFileSync } from 'node:fs'
const allowed = new Set(${JSON.stringify([
        'DOC_QUERY_JWT_TOKEN_KLICKER',
        'DOC_QUERY_SCOPE_AUDIENCE',
        'DOC_QUERY_SCOPE_ISSUER',
        'DOC_QUERY_SCOPE_KID',
        'DOC_QUERY_SCOPE_PRIVATE_KEY',
        'DOC_QUERY_PROOF_PARENT_PID',
        'DOC_QUERY_PROOF_MANIFEST_PATH',
        '__CF_USER_TEXT_ENCODING',
      ])})
if (Object.keys(process.env).some((name) => !allowed.has(name))) process.exit(8)
if (readFileSync(0).length !== 0) process.exit(9)
try {
  fstatSync(${unrelated.fd})
  process.exit(10)
} catch (error) {
  if (error?.code !== 'EBADF') process.exit(11)
}
${passedReceiptSource()}
`
    )
    const receipt = await superviseProof({
      sourceEnvironment: {
        ...(await dummyEnvironment()),
        LEAK_ME: 'must-not-pass',
      } as unknown as NodeJS.ProcessEnv,
      childPath: dummy.path,
      childArgs: [],
      lockPath: dummy.lockPath,
      deadlineMs: 2_000,
    })
    await unrelated.close()
    expect(receipt.result).toBe('passed')
  })

  test('preserves a values-free failure receipt from a failed child', async () => {
    const dummy = await writeDummy(failedReceiptSource())
    const receipt = await superviseProof({
      sourceEnvironment:
        (await dummyEnvironment()) as unknown as NodeJS.ProcessEnv,
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
      sourceEnvironment:
        (await dummyEnvironment()) as unknown as NodeJS.ProcessEnv,
      childPath: dummy.path,
      childArgs: [],
      lockPath: dummy.lockPath,
      deadlineMs: expected === 'timeout' ? 50 : 2_000,
    })
    expect(receipt.failureClass).toBe(expected)
  })

  test('refuses a duplicate invocation before spawning', async () => {
    const dummy = await writeDummy(passedReceiptSource())
    await writeFile(dummy.lockPath, '')
    const receipt = await superviseProof({
      sourceEnvironment:
        (await dummyEnvironment()) as unknown as NodeJS.ProcessEnv,
      childPath: dummy.path,
      childArgs: [],
      lockPath: dummy.lockPath,
    })
    expect(receipt.failureClass).toBe('duplicate_refused')
    expect(receipt.exitCode).toBeNull()
  })
})
