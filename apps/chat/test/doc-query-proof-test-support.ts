import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { exportPKCS8, generateKeyPair } from 'jose'

export function rejected(message = 'unauthorized: invalid token') {
  return { isError: true, content: [{ type: 'text', text: message }] }
}

export function proofUuid(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
}

function getChatbotCount(index: number, extraChatbotCases: number): number {
  if (index > 0 && index <= extraChatbotCases) return 2
  return 1
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

export function createProofManifest({
  environment,
  collection,
  extraChatbotCases,
}: {
  environment: string
  collection: string
  extraChatbotCases: number
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
  return {
    version: 1,
    environment,
    collection,
    singletonCanaryCaseId: 'corpus_1',
    cases,
    excludedChatbotIds: [proofUuid(900), proofUuid(901)],
  }
}

export async function proofDummyEnvironment(): Promise<Record<string, string>> {
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
    const directory = await mkdtemp(
      join(tmpdir(), 'klicker-doc-query-proof-test-')
    )
    registry.register(directory)
    const path = join(directory, 'child.mjs')
    await writeFile(path, source, { mode: 0o700 })
    return { path, lockPath: join(directory, 'proof.lock') }
  }
}
