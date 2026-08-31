import { chmod, mkdtemp, open, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { exportPKCS8, generateKeyPair } from 'jose'
import { afterEach, describe, expect, test } from 'vitest'

export type MockToolResult = {
  isError?: boolean
  content: Array<{ type: 'text'; text: string }>
}

export type ProofInvokeArgs = {
  question: string
  override?: string
}

export type ProofInvoke = (args: ProofInvokeArgs) => Promise<MockToolResult>

export type ProofReceipt = {
  result: string
  failureClass: string | null
  failedCaseId: string | null
  failedRejectionClass: string | null
  exitCode: number | null
  counts: Record<string, unknown>
  [key: string]: unknown
}

export type ValidatedProofManifest = {
  cases: Array<{ kbId: string; chatbotIds: string[] }>
  excludedChatbotIds: unknown[]
  [key: string]: unknown
}

export type ValidateProofManifest = (
  manifest: unknown
) => ValidatedProofManifest

export type RunProofMatrix = (options: {
  manifest: unknown
  environment: Record<string, string> | NodeJS.ProcessEnv
  invoke: ProofInvoke
}) => Promise<ProofReceipt>

export type SuperviseProof = (options: {
  sourceEnvironment: NodeJS.ProcessEnv
  childPath: string
  childArgs: string[]
  lockPath: string
  deadlineMs?: number
  acquireLockForProof?: unknown
}) => Promise<ProofReceipt>

export function rejected(
  message = 'unauthorized: invalid token'
): MockToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] }
}

export function emptyRejection(): MockToolResult {
  return { isError: true, content: [] }
}

export function proofUuid(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
}

function getChatbotCount(index: number, extraChatbotCases: number): number {
  if (index > 0 && index <= extraChatbotCases) return 2
  return 1
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right)
}

export function createTemporaryDirectoryRegistry() {
  const directories: string[] = []
  return {
    register(directory: string) {
      directories.push(directory)
    },
    cleanup() {
      return Promise.all(
        directories
          .splice(0)
          .map((directory) => rm(directory, { recursive: true, force: true }))
      )
    },
  }
}

type TemporaryDirectoryRegistry = {
  register: (directory: string) => void
}

async function createPrivateDirectory(
  registry: TemporaryDirectoryRegistry,
  prefix: string
): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  await chmod(directory, 0o700)
  registry.register(directory)
  return directory
}

const defaultProofEnvironmentRegistry = createTemporaryDirectoryRegistry()
afterEach(() => defaultProofEnvironmentRegistry.cleanup())

export function createProofManifest({
  environment,
  collection,
  extraChatbotCases,
  version = 1,
  activationManifestFingerprint,
}: {
  environment: string
  collection: string
  extraChatbotCases: number
  version?: number
  activationManifestFingerprint?: string
}) {
  let chatbotIndex = 100
  const cases = Array.from({ length: 15 }, (_, index) => ({
    id: `corpus_${index + 1}`,
    kbId: proofUuid(index + 1),
    chatbotIds: Array.from(
      { length: getChatbotCount(index, extraChatbotCases) },
      () => proofUuid(chatbotIndex++)
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
  const manifest = {
    version,
    environment,
    collection,
    singletonCanaryCaseId: 'corpus_1',
    cases,
    excludedChatbotIds: [proofUuid(900), proofUuid(901)],
  }
  return activationManifestFingerprint
    ? { ...manifest, activationManifestFingerprint }
    : manifest
}

export async function proofDummyEnvironment(): Promise<Record<string, string>> {
  const { privateKey } = await generateKeyPair('ES256')
  const directory = await createPrivateDirectory(
    defaultProofEnvironmentRegistry,
    'klicker-doc-query-proof-env-'
  )
  return {
    DOC_QUERY_JWT_TOKEN_KLICKER: 'dummy-transport-token',
    DOC_QUERY_SCOPE_PRIVATE_KEY: await exportPKCS8(privateKey),
    DOC_QUERY_SCOPE_KID: 'dummy-key',
    DOC_QUERY_SCOPE_ISSUER: 'https://chat.klicker.test',
    DOC_QUERY_SCOPE_AUDIENCE: 'klicker-doc-query-test',
    DOC_QUERY_PROOF_MANIFEST_PATH: join(directory, 'dummy-manifest.json'),
  }
}

export function createProofReceiptSources({
  environment,
  collection,
  passedCounts,
  failedCounts,
}: {
  environment: string
  collection: string
  passedCounts: string
  failedCounts: string
}) {
  function passedReceiptSource(
    extra = '',
    preservation = '{databaseWrites:0,configurationChanges:0,bindingChanges:0,clusterChanges:0,productionActions:0,retries:0}'
  ) {
    return [
      '',
      extra,
      'process.send({',
      '  receiptVersion: 1,',
      `  environment: '${environment}',`,
      `  collection: '${collection}',`,
      "  phase: 'complete',",
      "  result: 'passed',",
      "  failureClass: 'none',",
      '  failedCaseId: null,',
      '  failedRejectionClass: null,',
      `  counts: ${passedCounts},`,
      "  rejections: {missing:'passed',expired:'passed',forged:'passed',wrong_issuer:'passed',wrong_audience:'passed',unknown_key:'passed',trusted_filter_override:'passed'},",
      `  preservation: ${preservation}`,
      '}, () => process.exit(0))',
      '',
    ].join('\n')
  }

  function failedReceiptSource(
    preservation = '{databaseWrites:0,configurationChanges:0,bindingChanges:0,clusterChanges:0,productionActions:0,retries:0}'
  ) {
    return [
      '',
      'process.send({',
      '  receiptVersion: 1,',
      `  environment: '${environment}',`,
      `  collection: '${collection}',`,
      "  phase: 'canary',",
      "  result: 'failed',",
      "  failureClass: 'canary_positive_failed',",
      "  failedCaseId: 'corpus_1',",
      '  failedRejectionClass: null,',
      `  counts: ${failedCounts},`,
      "  rejections: {missing:'not_run',expired:'not_run',forged:'not_run',wrong_issuer:'not_run',wrong_audience:'not_run',unknown_key:'not_run',trusted_filter_override:'not_run'},",
      `  preservation: ${preservation},`,
      "  secret: 'dummy-private-key'",
      '}, () => process.exit(1))',
      '',
    ].join('\n')
  }

  return { passedReceiptSource, failedReceiptSource }
}

export function createProofChildWriter(registry: {
  register: (directory: string) => void
}) {
  return async function writeDummy(source: string) {
    const directory = await createPrivateDirectory(
      registry,
      'klicker-doc-query-proof-test-'
    )
    const path = join(directory, 'child.mjs')
    await writeFile(path, source, { mode: 0o700 })
    return { path, lockPath: join(directory, 'proof.lock') }
  }
}

export function defineProofManifestSuite(
  label: string,
  behaviors: { validateManifest: ValidateProofManifest },
  config: {
    manifest: () => unknown
    expectedChatbotCount: number
    expectFingerprintBinding?: boolean
  }
) {
  describe(`${label} Doc Query proof manifest`, () => {
    test('accepts exactly 15 KBs, the configured chatbot targets, and two exclusions', () => {
      const validated = behaviors.validateManifest(config.manifest())
      expect(validated.cases).toHaveLength(15)
      expect(validated.cases.flatMap((entry) => entry.chatbotIds)).toHaveLength(
        config.expectedChatbotCount
      )
      expect(validated.cases[0].chatbotIds).toHaveLength(1)
      expect(validated.excludedChatbotIds).toHaveLength(2)
    })

    if (config.expectFingerprintBinding) {
      test('refuses a same-cardinality substitution with a different cohort fingerprint', () => {
        const substituted = config.manifest() as {
          cases: Array<{ kbId: string }>
        }
        substituted.cases[0].kbId = proofUuid(999)
        expect(() => behaviors.validateManifest(substituted)).toThrow(
          'manifest_refused'
        )
      })
    }

    test('refuses duplicate target chatbots before any proof call', () => {
      const duplicate = config.manifest() as {
        cases: Array<{ kbId: string; chatbotIds: string[] }>
      }
      duplicate.cases[1].chatbotIds[0] =
        duplicate.cases[0].chatbotIds[0].toUpperCase()
      expect(() => behaviors.validateManifest(duplicate)).toThrow(
        'manifest_refused'
      )
    })

    test('canonicalizes UUIDs before every cardinality check', () => {
      const duplicateKb = config.manifest() as {
        cases: Array<{ kbId: string; chatbotIds: string[] }>
        excludedChatbotIds: string[]
      }
      duplicateKb.cases[1].kbId = duplicateKb.cases[0].kbId.toUpperCase()
      expect(() => behaviors.validateManifest(duplicateKb)).toThrow(
        'manifest_refused'
      )

      const overlappingExclusion = config.manifest() as typeof duplicateKb
      overlappingExclusion.excludedChatbotIds[0] =
        overlappingExclusion.cases[0].chatbotIds[0].toUpperCase()
      expect(() => behaviors.validateManifest(overlappingExclusion)).toThrow(
        'manifest_refused'
      )
    })

    test('requires source-reference isolation markers', () => {
      const legacy = config.manifest() as {
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
      expect(() => behaviors.validateManifest(legacy)).toThrow(
        'manifest_refused'
      )

      const mixed = config.manifest() as typeof legacy
      const mixedForeign = mixed.cases[0].foreign as {
        question: string
        forbidReferences: string[]
        forbidAny?: string[]
      }
      mixedForeign.forbidAny = mixedForeign.forbidReferences
      expect(() => behaviors.validateManifest(mixed)).toThrow(
        'manifest_refused'
      )
    })
  })
}

export function defineProofMatrixSuite(
  label: string,
  behaviors: {
    validateManifest: ValidateProofManifest
    runProofMatrix: RunProofMatrix
  },
  config: {
    manifest: () => unknown
    environment: () => Promise<Record<string, string>>
    rejection: (message?: string) => MockToolResult
    rejectionWithArguments: () => MockToolResult
    expectedDirectCalls: number
    expectedCounts: Record<string, number>
  }
) {
  describe(`${label} Doc Query proof matrix`, () => {
    test('runs the singleton canary, seven rejections, then the serial matrix', async () => {
      const validated = behaviors.validateManifest(config.manifest())
      const environment = await config.environment()
      let call = 0
      const invoke: ProofInvoke = async ({ question, override }) => {
        call += 1
        if ((call >= 3 && call <= 8) || override) {
          return override ? config.rejectionWithArguments() : config.rejection()
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

      const receipt = await behaviors.runProofMatrix({
        manifest: validated,
        environment,
        invoke,
      })

      expect(call).toBe(config.expectedDirectCalls)
      expect(receipt.result).toBe('passed')
      expect(receipt.counts).toMatchObject(config.expectedCounts)
    })

    test('fails when a foreign source reference is returned', async () => {
      const validated = behaviors.validateManifest(config.manifest())
      const environment = await config.environment()
      let calls = 0
      const receipt = await behaviors.runProofMatrix({
        manifest: validated,
        environment,
        invoke: async ({ question }) => {
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
      const validated = behaviors.validateManifest(config.manifest())
      const environment = await config.environment()
      let calls = 0
      const receipt = await behaviors.runProofMatrix({
        manifest: validated,
        environment,
        invoke: async () => {
          calls += 1
          return config.rejection('backend unavailable')
        },
      })
      expect(receipt.failureClass).toBe('canary_positive_failed')
      expect(calls).toBe(1)
    })

    test('sends both protected fields in the trusted-filter rejection case', async () => {
      const validated = behaviors.validateManifest(config.manifest())
      const environment = await config.environment()
      const overrides: string[] = []
      let call = 0
      const receipt = await behaviors.runProofMatrix({
        manifest: validated,
        environment,
        invoke: async ({ question, override }) => {
          call += 1
          if (override) overrides.push(override)
          if (override) {
            return config.rejectionWithArguments()
          }
          if (call >= 3 && call <= 8) {
            return config.rejection()
          }
          const positive = question.startsWith('positive')
          const marker = question.replace(
            positive ? 'positive fixture ' : 'foreign fixture ',
            positive ? 'positive-marker-' : 'safe-marker-'
          )
          return {
            isError: false,
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
}

export function defineProofSupervisorSuite(
  label: string,
  behaviors: {
    minimalChildEnvironment: (
      environment: Record<string, string>,
      parentPid: number
    ) => Record<string, string>
    validateWorkerEnvironment: (environment: Record<string, unknown>) => void
    superviseProof: SuperviseProof
  },
  config: {
    dummyEnvironment: () => Promise<Record<string, string>>
    writeDummy: (source: string) => Promise<{ path: string; lockPath: string }>
    prepareDuplicateLock?: (lockPath: string) => Promise<() => Promise<void>>
    passedReceiptSource: (extra?: string, preservation?: string) => string
    failedReceiptSource: (preservation?: string) => string
    expectProofManifestFingerprint?: boolean
  }
) {
  const suiteRegistry = createTemporaryDirectoryRegistry()
  afterEach(suiteRegistry.cleanup)

  describe(`${label} Doc Query proof supervisor`, () => {
    test('passes only the allowlisted environment', async () => {
      const environment = await config.dummyEnvironment()
      const childEnvironment = behaviors.minimalChildEnvironment(
        { ...environment, LEAK_ME: 'must-not-pass' },
        123
      )
      expect(childEnvironment).not.toHaveProperty('LEAK_ME')
      expect(childEnvironment).not.toHaveProperty('PATH')
      const expectedEnvironmentNames = [
        'DOC_QUERY_JWT_TOKEN_KLICKER',
        'DOC_QUERY_SCOPE_AUDIENCE',
        'DOC_QUERY_SCOPE_ISSUER',
        'DOC_QUERY_SCOPE_KID',
        'DOC_QUERY_SCOPE_PRIVATE_KEY',
        'DOC_QUERY_PROOF_PARENT_PID',
        'DOC_QUERY_PROOF_MANIFEST_PATH',
      ]
      if (config.expectProofManifestFingerprint) {
        expectedEnvironmentNames.push('DOC_QUERY_PROOF_MANIFEST_FINGERPRINT')
      }
      expect(Object.keys(childEnvironment).sort(compareStrings)).toEqual(
        expectedEnvironmentNames.sort(compareStrings)
      )
    })

    test('rejects unexpected worker environment names while allowing the platform marker', async () => {
      const environment = await config.dummyEnvironment()
      expect(() =>
        behaviors.validateWorkerEnvironment({
          ...environment,
          DOC_QUERY_PROOF_PARENT_PID: '123',
          __CF_USER_TEXT_ENCODING: '0x1F5:0x0:0x0',
        })
      ).not.toThrow()
      expect(() =>
        behaviors.validateWorkerEnvironment({
          ...environment,
          DOC_QUERY_PROOF_PARENT_PID: '123',
          LEAK_ME: 'must-not-pass',
        })
      ).toThrow('protocol_failed')
    })

    test('suppresses noisy child output and returns only a fixed receipt', async () => {
      const dummy = await config.writeDummy(
        config.passedReceiptSource(
          "process.stdout.write('dummy-transport-token'); process.stderr.write('dummy-private-key')"
        )
      )
      const receipt = await behaviors.superviseProof({
        sourceEnvironment:
          (await config.dummyEnvironment()) as unknown as NodeJS.ProcessEnv,
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
          config
            .passedReceiptSource()
            .replaceAll("phase: 'complete'", "phase: 'matrix'"),
        'protocol_failed',
      ],
      [
        'missing preservation evidence',
        () => config.passedReceiptSource('', 'undefined'),
        'protocol_failed',
      ],
      [
        'non-zero preservation evidence',
        () =>
          config.passedReceiptSource(
            '',
            '{databaseWrites:1,configurationChanges:0,bindingChanges:0,clusterChanges:0,productionActions:0,retries:0}'
          ),
        'protocol_failed',
      ],
      [
        'an exit-mismatched receipt',
        () =>
          config
            .passedReceiptSource()
            .replaceAll('process.exit(0)', 'process.exit(1)'),
        'child_failed',
      ],
      ['a missing receipt', () => 'process.exit(0)', 'child_failed'],
    ] as Array<
      [string, () => string, string]
    >)('rejects %s', async (_name, source, expectedFailure) => {
      const dummy = await config.writeDummy(source())
      const receipt = await behaviors.superviseProof({
        sourceEnvironment:
          (await config.dummyEnvironment()) as unknown as NodeJS.ProcessEnv,
        childPath: dummy.path,
        childArgs: [],
        lockPath: dummy.lockPath,
        deadlineMs: 2_000,
      })
      expect(receipt.result).toBe('failed')
      expect(receipt.failureClass).toBe(expectedFailure)
    })

    test('preserves a protocol failure when a failed child claims writes', async () => {
      const dummy = await config.writeDummy(
        config.failedReceiptSource(
          '{databaseWrites:1,configurationChanges:0,bindingChanges:0,clusterChanges:0,productionActions:0,retries:0}'
        )
      )
      const receipt = await behaviors.superviseProof({
        sourceEnvironment:
          (await config.dummyEnvironment()) as unknown as NodeJS.ProcessEnv,
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
      const directory = await createPrivateDirectory(
        suiteRegistry,
        'klicker-doc-query-fd-test-'
      )
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
      if (config.expectProofManifestFingerprint) {
        allowedEnvironmentNames.push('DOC_QUERY_PROOF_MANIFEST_FINGERPRINT')
      }
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
        config.passedReceiptSource(),
        '',
      ].join('\n')
      const dummy = await config.writeDummy(source)
      const receipt = await behaviors.superviseProof({
        sourceEnvironment: {
          ...(await config.dummyEnvironment()),
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
      const dummy = await config.writeDummy(config.failedReceiptSource())
      const receipt = await behaviors.superviseProof({
        sourceEnvironment:
          (await config.dummyEnvironment()) as unknown as NodeJS.ProcessEnv,
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
      const dummy = await config.writeDummy(source)
      const receipt = await behaviors.superviseProof({
        sourceEnvironment:
          (await config.dummyEnvironment()) as unknown as NodeJS.ProcessEnv,
        childPath: dummy.path,
        childArgs: [],
        lockPath: dummy.lockPath,
        deadlineMs: expected === 'timeout' ? 50 : 2_000,
      })
      expect(receipt.failureClass).toBe(expected)
    })

    test('refuses a duplicate invocation before spawning', async () => {
      const dummy = await config.writeDummy(config.passedReceiptSource())
      const release = config.prepareDuplicateLock
        ? await config.prepareDuplicateLock(dummy.lockPath)
        : await prepareDuplicateLock(dummy.lockPath)
      try {
        const receipt = await behaviors.superviseProof({
          sourceEnvironment:
            (await config.dummyEnvironment()) as unknown as NodeJS.ProcessEnv,
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
  })
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
