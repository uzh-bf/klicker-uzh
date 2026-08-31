import { afterEach, describe, expect, test } from 'vitest'
import {
  createMcpTransport,
  minimalChildEnvironment,
  runProofMatrix,
  superviseProof,
  validateManifest,
  validateWorkerEnvironment,
} from '../scripts/stg-doc-query-proof.mjs'
import type { RunProofMatrix } from './doc-query-proof-test-support'
import {
  createProofChildWriter,
  createProofManifest,
  createProofReceiptSources,
  createTemporaryDirectoryRegistry,
  defineProofManifestSuite,
  defineProofMatrixSuite,
  defineProofSupervisorSuite,
  emptyRejection,
  proofDummyEnvironment,
} from './doc-query-proof-test-support'

const manifest = () =>
  createProofManifest({
    environment: 'stg',
    collection: 'klicker_course_materials_v1',
    extraChatbotCases: 6,
  })
const receiptSources = createProofReceiptSources({
  environment: 'stg',
  collection: 'klicker_course_materials_v1',
  passedCounts:
    '{kbExpected:15,kbPassed:15,chatbotsExpected:21,chatbotsPassed:21,excludedExpected:2,positivePassed:21,isolationPassed:21,rejectionsPassed:7}',
  failedCounts:
    '{kbExpected:15,kbPassed:0,chatbotsExpected:21,chatbotsPassed:0,excludedExpected:2,positivePassed:0,isolationPassed:0,rejectionsPassed:0}',
})
const proofRegistry = createTemporaryDirectoryRegistry()
afterEach(() => proofRegistry.cleanup())

defineProofManifestSuite(
  'STG',
  { validateManifest },
  { manifest, expectedChatbotCount: 21 }
)

describe('STG Doc Query proof transport', () => {
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

defineProofMatrixSuite(
  'STG',
  {
    validateManifest,
    runProofMatrix: runProofMatrix as unknown as RunProofMatrix,
  },
  {
    manifest,
    environment: proofDummyEnvironment,
    rejection: emptyRejection,
    rejectionWithArguments: emptyRejection,
    expectedDirectCalls: 49,
    expectedCounts: {
      kbPassed: 15,
      chatbotsPassed: 21,
      positivePassed: 21,
      isolationPassed: 21,
      rejectionsPassed: 7,
    },
  }
)

defineProofSupervisorSuite(
  'STG',
  { minimalChildEnvironment, validateWorkerEnvironment, superviseProof },
  {
    dummyEnvironment: proofDummyEnvironment,
    writeDummy: createProofChildWriter(proofRegistry),
    passedReceiptSource: receiptSources.passedReceiptSource,
    failedReceiptSource: receiptSources.failedReceiptSource,
  }
)
