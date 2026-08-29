import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { describe, expect, test, vi } from 'vitest'

const getAggregatedMCPToolsMock = vi.hoisted(() => vi.fn())

vi.mock('../src/services/mcpClients.js', () => ({
  getAggregatedMCPTools: getAggregatedMCPToolsMock,
}))

import {
  classifyExpectedToolInventory,
  createReceiptStore,
  initialReceipt,
  probeFixedRoute,
  runProof,
  runDirectChatCanaryTransaction,
  safeResult,
  suppressOutput,
  updatedReceipt,
} from '../scripts/prd-direct-chat-canary'

const ids = {
  ownerId: '00000000-0000-4000-8000-000000000001',
  courseId: '00000000-0000-4000-8000-000000000002',
  participantId: '00000000-0000-4000-8000-000000000003',
  participationId: null,
  chatbotId: '00000000-0000-4000-8000-000000000004',
  legacyServerId: '00000000-0000-4000-8000-000000000005',
  legacyServerName: 'direct-chat-canary-legacy-run-fixture',
  legacyConfigId: '00000000-0000-4000-8000-000000000006',
  candidateServerId: '00000000-0000-4000-8000-000000000007',
  candidateConfigId: '00000000-0000-4000-8000-000000000008',
} as const

const provenance = {
  klickerSourceSha: 'source-sha',
  chatImageDigest: 'chat-image',
  docQueryImageDigest: 'doc-query-image',
  argoRevision: 'argo-revision',
  networkPolicySourceCommit: 'network-policy',
} as const

const passedProof = {
  status: 'passed',
  toolCount: 34,
  pairCount: 17,
  teachingToolsPresent: false,
  retrieval: 'passed',
  wrongBearer: 'passed',
  missingBearer: 'passed',
  wrongTenant: 'passed',
  eduaiRoute: 'passed',
} as const
const failedProof = {
  ...passedProof,
  status: 'failed',
  retrieval: 'failed',
} as const

test('counts the hashed long chunk-topic name as a chunk twin', () => {
  const expertNames = [
    'banking_expert',
    'bf1_expert',
    'cf1_expert',
    'mat141_expert',
    'mat182_expert',
    'python_and_r_expert',
    'fs26_intro_r_expert',
    'bio144_expert',
    'df_ap_expert',
    'df_bf2_expert',
    'df_cf2_expert',
    'df_fineco_expert',
    'df_qf_expert',
    'mat183_expert',
    'vorkurs_expert',
    'informatik_und_wirtschaft_video_expert',
    'radiosurfvet_expert',
  ]
  const longExpertName = 'informatik_und_wirtschaft_video_expert'
  const names = [
    ...expertNames.map((name) => `Klicker-compat_${name}`),
    ...expertNames
      .filter((name) => name !== longExpertName)
      .map((name) => `Klicker-compat_${name}_chunk_topics`),
    'Klicker-compat_informatik_und_wirtschaft_video_expert_c_246cf369',
  ]

  expect(classifyExpectedToolInventory(names)).toEqual({
    toolCount: 34,
    pairCount: 17,
    missingToolCount: 0,
    unexpectedToolCount: 0,
  })

  const sameSizeWrongNames = [...names]
  sameSizeWrongNames[0] = 'Klicker-compat_unexpected_expert'
  expect(classifyExpectedToolInventory(sameSizeWrongNames)).toEqual({
    toolCount: 34,
    pairCount: 17,
    missingToolCount: 1,
    unexpectedToolCount: 1,
  })
})

test('uses and closes every aggregated MCP tools handle during proof', async () => {
  const expertNames = [
    'banking_expert',
    'bf1_expert',
    'cf1_expert',
    'mat141_expert',
    'mat182_expert',
    'python_and_r_expert',
    'fs26_intro_r_expert',
    'bio144_expert',
    'df_ap_expert',
    'df_bf2_expert',
    'df_cf2_expert',
    'df_fineco_expert',
    'df_qf_expert',
    'mat183_expert',
    'vorkurs_expert',
    'informatik_und_wirtschaft_video_expert',
    'radiosurfvet_expert',
  ]
  const names = [
    ...expertNames.map((name) => `Klicker-compat_${name}`),
    ...expertNames
      .filter((name) => name !== 'informatik_und_wirtschaft_video_expert')
      .map((name) => `Klicker-compat_${name}_chunk_topics`),
    'Klicker-compat_informatik_und_wirtschaft_video_expert_c_246cf369',
  ]
  const tools = Object.fromEntries(
    names.map((name) => [
      name,
      {
        execute: vi.fn(async () => ({
          content: [{ type: 'text', text: 'synthetic proof result' }],
        })),
      },
    ])
  )
  const close = Array.from({ length: 4 }, () => vi.fn(async () => {}))
  getAggregatedMCPToolsMock
    .mockResolvedValueOnce({ tools, close: close[0] })
    .mockResolvedValueOnce({ tools: {}, close: close[1] })
    .mockResolvedValueOnce({ tools: {}, close: close[2] })
    .mockResolvedValueOnce({ tools: {}, close: close[3] })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 404 }))
  )
  vi.stubEnv('APP_SECRET', 'synthetic-app-secret-for-test')

  try {
    await expect(
      runProof(
        'http://127.0.0.1:1417/mcp/klicker',
        {
          id: 'candidate-server',
          name: 'Klicker-compat',
          authType: 'bearer',
          authSecret: 'synthetic',
          isActive: true,
        },
        'chatbot-id',
        'synthetic'
      )
    ).resolves.toMatchObject({
      status: 'passed',
      toolCount: 34,
      pairCount: 17,
      retrieval: 'passed',
      wrongBearer: 'passed',
      missingBearer: 'passed',
      wrongTenant: 'passed',
      eduaiRoute: 'passed',
    })
    expect(getAggregatedMCPToolsMock).toHaveBeenCalledTimes(4)
    close.forEach((closeClient) => expect(closeClient).toHaveBeenCalledOnce())
  } finally {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  }
})

type FakeRow = Record<string, any>

function matchesWhere(row: FakeRow, where: Record<string, any>): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key]
    if (expected instanceof Date) {
      return actual instanceof Date && actual.getTime() === expected.getTime()
    }
    if (expected && typeof expected === 'object' && 'startsWith' in expected) {
      return (
        typeof actual === 'string' &&
        actual.startsWith(String(expected.startsWith))
      )
    }
    return actual === expected
  })
}

function fakeDirectChatCanaryClient(
  options: { ordinaryServer?: FakeRow } = {}
) {
  let sequence = 0
  let participationId = 0
  let ordinarySelected = false
  let ordinaryChanged = false
  const nextDate = () => new Date(Date.UTC(2026, 7, 22, 0, 0, sequence++))
  const maps = {
    servers: new Map<string, FakeRow>(),
    configs: new Map<string, FakeRow>(),
    users: new Map<string, FakeRow>(),
    courses: new Map<string, FakeRow>(),
    participants: new Map<string, FakeRow>(),
    participations: new Map<number, FakeRow>(),
    chatbots: new Map<string, FakeRow>(),
  }
  const serverCreates: FakeRow[] = []
  if (options.ordinaryServer) {
    maps.servers.set(options.ordinaryServer.id, options.ordinaryServer)
  }
  const ordinaryId = options.ordinaryServer?.id

  function model(map: Map<string | number, FakeRow>) {
    return {
      create: vi.fn(async ({ data }: { data: FakeRow }) => {
        const id = data.id ?? ++participationId
        const row = {
          ...data,
          id,
          createdAt: nextDate(),
          updatedAt: nextDate(),
        }
        map.set(id, row)
        return row
      }),
      findUnique: vi.fn(async ({ where }: { where: Record<string, any> }) => {
        const row = [...map.values()].find((entry) =>
          matchesWhere(entry, where)
        )
        if (row?.id === ordinaryId) ordinarySelected = true
        return row ?? null
      }),
      findMany: vi.fn(
        async ({
          where,
          select,
        }: {
          where: Record<string, any>
          select?: FakeRow
        }) =>
          [...map.values()]
            .filter((entry) => matchesWhere(entry, where))
            .map((entry) =>
              select
                ? Object.fromEntries(
                    Object.keys(select).map((key) => [key, entry[key]])
                  )
                : entry
            )
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: Record<string, any>
          data: FakeRow
        }) => {
          let count = 0
          for (const row of map.values()) {
            if (!matchesWhere(row, where)) continue
            if (row.id === ordinaryId) ordinaryChanged = true
            Object.assign(row, data, { updatedAt: nextDate() })
            count++
          }
          return { count }
        }
      ),
      deleteMany: vi.fn(async ({ where }: { where: Record<string, any> }) => {
        let count = 0
        for (const [id, row] of [...map.entries()]) {
          if (!matchesWhere(row, where)) continue
          if (row.id === ordinaryId) ordinaryChanged = true
          map.delete(id)
          count++
        }
        return { count }
      }),
    }
  }

  const serverModel = model(maps.servers)
  const serverCreate = serverModel.create
  serverModel.create = vi.fn(async (args: { data: FakeRow }) => {
    serverCreates.push({ ...args.data })
    return serverCreate(args)
  })
  const tx = {
    chatbotMCPServer: serverModel,
    chatbotMCPConfig: model(maps.configs),
    user: model(maps.users),
    course: model(maps.courses),
    participant: model(maps.participants),
    participation: model(maps.participations),
    chatbot: model(maps.chatbots),
    chatThread: { findMany: vi.fn(async () => []) },
    chatUsageCredits: { findMany: vi.fn(async () => []) },
  }
  const client = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => {
      const snapshots = new Map<Map<string | number, FakeRow>, FakeRow[]>()
      for (const map of Object.values(maps)) {
        snapshots.set(map, [...map.values()])
      }
      try {
        return await callback(tx)
      } catch (error) {
        for (const [map, rows] of snapshots) {
          map.clear()
          for (const row of rows) {
            const currentId = row.id
            const numericId = typeof currentId === 'number' ? currentId : null
            if (numericId !== null) {
              map.set(numericId, row)
            } else if (typeof currentId === 'string') {
              map.set(currentId, row)
            }
          }
        }
        throw error
      }
    }),
  } as unknown as PrismaClient

  return {
    client,
    maps,
    serverCreates,
    ordinaryWasSelected: () => ordinarySelected,
    ordinaryWasChanged: () => ordinaryChanged,
  }
}

async function withDirectChatCanaryEnvironment<T>(
  receiptPath: string,
  action: () => Promise<T>
): Promise<T> {
  const env = {
    CANDIDATE_URL:
      'http://mcp-doc-query.prd-doc-query.svc.cluster.local:1417/mcp/klicker',
    CANDIDATE_PROOF_URL: 'http://127.0.0.1:1417/mcp/klicker',
    RECEIPT_PATH: receiptPath,
    DOC_QUERY_JWT_TOKEN_KLICKER: 'synthetic-bearer-token',
    APP_SECRET: 'synthetic-app-secret',
    KLICKER_SOURCE_SHA: 'source-sha',
    CHAT_IMAGE_DIGEST: 'chat-image',
    DOC_QUERY_IMAGE_DIGEST: 'doc-query-image',
    ARGO_REVISION: 'argo-revision',
    NETWORK_POLICY_SOURCE_COMMIT: 'network-policy',
  }
  const previousEnv = new Map<string, string | undefined>()
  for (const [name, value] of Object.entries(env)) {
    previousEnv.set(name, process.env[name])
    process.env[name] = value
  }
  const previousExitCode = process.exitCode
  try {
    return await action()
  } finally {
    for (const [name, value] of previousEnv) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    process.exitCode = previousExitCode
  }
}

describe('PRD direct-Chat canary receipt and output boundaries', () => {
  test('journals a digest-checked values-free receipt and rejects backward state', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'direct-chat-canary-receipt-')
    )
    const path = join(directory, 'receipt.json')
    try {
      const store = createReceiptStore(path)
      const receipt = initialReceipt('run-1', { ...ids }, { ...provenance })
      expect(receipt).toMatchObject({
        receiptVersion: 4,
        workflow: 'prd_direct_chat_canary',
      })
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
        updatedReceipt(updatedReceipt(receipt, { state: 'prepared' }), {
          state: 'switching',
        }).state
      ).toBe('switching')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test('rejects a stale receipt writer with a durable compare-and-set failure', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'direct-chat-canary-receipt-cas-')
    )
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
    const directory = await mkdtemp(
      join(tmpdir(), 'direct-chat-canary-receipt-immutable-')
    )
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
            identity: {
              ...prepared.identity,
              legacyServerName: 'direct-chat-canary-legacy-other-run',
            },
          })
        )
      ).rejects.toThrow('RECEIPT_INVALID')
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
                mcpServerId: ids.legacyServerId,
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

      const bootstrapStore = createReceiptStore(
        join(directory, 'bootstrap.json')
      )
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
            fixture: {
              ...ids,
              ownerId: '00000000-0000-4000-8000-000000000099',
            },
          })
        )
      ).rejects.toThrow('RECEIPT_IMMUTABLE')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test('rejects historical and mismatched receipt discriminators', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'direct-chat-canary-receipt-v2-')
    )
    const path = join(directory, 'receipt.json')
    try {
      const receipt = initialReceipt(
        'run-historical',
        { ...ids },
        { ...provenance }
      )
      const versionTwo = { ...receipt, receiptVersion: 2 }
      const versionThree = JSON.parse(JSON.stringify(receipt)) as Record<
        string,
        unknown
      >
      delete versionThree.workflow
      versionThree.receiptVersion = 3
      versionThree.wItem = 'W5e'
      const missingWorkflow = JSON.parse(JSON.stringify(receipt)) as Record<
        string,
        unknown
      >
      delete missingWorkflow.workflow
      const mismatchedWorkflow = {
        ...receipt,
        workflow: 'other_workflow',
      }

      for (const invalidReceipt of [
        versionTwo,
        versionThree,
        missingWorkflow,
        mismatchedWorkflow,
      ]) {
        await writeFile(path, `${JSON.stringify(invalidReceipt)}\n`, 'utf8')
        await expect(createReceiptStore(path).read()).rejects.toThrow(
          'only receipt version 4 is executable'
        )
      }
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
      fixtureOperation: 'not_run',
      fixtureStatus: 'not_run',
      error: 'transaction_failed',
      failure: 'unknown',
    })
  })

  test('records fixture creation failure without exposing nested transaction errors', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'direct-chat-canary-fixture-failure-')
    )
    const receiptPath = join(directory, 'receipt.json')
    const env = {
      CANDIDATE_URL:
        'http://mcp-doc-query.prd-doc-query.svc.cluster.local:1417/mcp/klicker',
      CANDIDATE_PROOF_URL: 'http://127.0.0.1:1417/mcp/klicker',
      RECEIPT_PATH: receiptPath,
      DOC_QUERY_JWT_TOKEN_KLICKER: 'synthetic-bearer-token',
      APP_SECRET: 'synthetic-app-secret',
      KLICKER_SOURCE_SHA: 'source-sha',
      CHAT_IMAGE_DIGEST: 'chat-image',
      DOC_QUERY_IMAGE_DIGEST: 'doc-query-image',
      ARGO_REVISION: 'argo-revision',
      NETWORK_POLICY_SOURCE_COMMIT: 'network-policy',
    }
    const previousEnv = new Map<string, string | undefined>()
    for (const [name, value] of Object.entries(env)) {
      previousEnv.set(name, process.env[name])
      process.env[name] = value
    }
    const previousExitCode = process.exitCode
    let courseData: Record<string, unknown> | undefined
    type FakeTx = {
      chatbotMCPServer: {
        findUnique: (args: { where: { name: string } }) => Promise<unknown>
      }
      user: { create: () => Promise<{ id: string }> }
      course: {
        create: (args: { data: Record<string, unknown> }) => Promise<never>
      }
    }
    const tx: FakeTx = {
      chatbotMCPServer: {
        findUnique: vi.fn(async () => null),
      },
      user: {
        create: vi.fn(async () => ({ id: ids.ownerId })),
      },
      course: {
        create: vi.fn(async ({ data }) => {
          courseData = data
          throw new Error('synthetic nested transaction error')
        }),
      },
    }
    const transaction = vi.fn(
      async (callback: (tx: FakeTx) => Promise<unknown>) => callback(tx)
    )
    const client = { $transaction: transaction } as unknown as PrismaClient
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }))

    try {
      const result = await runDirectChatCanaryTransaction({ client, fetchImpl })
      const receipt = await createReceiptStore(receiptPath).read()

      expect(result).toMatchObject({
        status: 'planned',
        reachability: 'accepted',
        proof: 'not_run',
        cleanup: 'incomplete',
        error: 'transaction_failed',
        failure: 'fixture_create_failed',
      })
      expect(receipt).toMatchObject({
        state: 'planned',
        reachability: { outcome: 'accepted' },
        failure: { category: 'fixture_create_failed' },
      })
      expect(await readFile(receiptPath, 'utf8')).not.toContain(
        'synthetic nested transaction error'
      )
      expect(courseData).toMatchObject({ authType: 'SSO', pinCode: null })
      expect(transaction).toHaveBeenCalledTimes(1)
      expect(fetchImpl).toHaveBeenCalledTimes(1)
    } finally {
      for (const [name, value] of previousEnv) {
        if (value === undefined) delete process.env[name]
        else process.env[name] = value
      }
      process.exitCode = previousExitCode
      await rm(directory, { recursive: true, force: true })
    }
  })

  test('runs successfully when the MCP server store starts empty', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'direct-chat-canary-empty-store-')
    )
    const receiptPath = join(directory, 'receipt.json')
    const fake = fakeDirectChatCanaryClient()
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }))
    const runProofImpl = vi.fn(async () => passedProof)

    try {
      const result = await withDirectChatCanaryEnvironment(receiptPath, () =>
        runDirectChatCanaryTransaction({
          client: fake.client,
          fetchImpl,
          runProofImpl,
        })
      )
      const receipt = await createReceiptStore(receiptPath).read()
      const legacyCreate = fake.serverCreates.find((server) =>
        server.name.startsWith('direct-chat-canary-legacy-')
      )

      expect(result).toMatchObject({
        status: 'cleaned',
        proof: 'passed',
        cleanup: 'exact-zero',
        fixtureOperation: 'cleanup',
        fixtureStatus: 'passed',
        failure: null,
      })
      expect(receipt).toMatchObject({
        receiptVersion: 4,
        state: 'cleaned',
        identity: {
          legacyServerId: receipt?.fixture.legacyServerId,
          legacyServerName: receipt?.fixture.legacyServerName,
        },
        cleanup: {
          candidateAbsent: true,
          legacyAbsent: true,
          fixtureAbsent: true,
          exactZeroReadback: true,
        },
      })
      expect(legacyCreate).toMatchObject({
        id: receipt?.fixture.legacyServerId,
        name: receipt?.fixture.legacyServerName,
        url: 'http://127.0.0.1:9/mcp',
        authType: 'none',
        authSecret: null,
        passChatbotId: false,
        chatbotIdHeader: null,
        isActive: true,
      })
      expect(fake.serverCreates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Klicker-compat' }),
        ])
      )
      expect(runProofImpl).toHaveBeenCalledTimes(1)
      for (const map of Object.values(fake.maps)) expect(map.size).toBe(0)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test('cleans a switched failure without selecting or changing an ordinary server', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'direct-chat-canary-failed-proof-')
    )
    const receiptPath = join(directory, 'receipt.json')
    const ordinaryServer = {
      id: '00000000-0000-4000-8000-000000000099',
      name: 'ordinary-server',
      description: 'Unrelated ordinary server',
      url: 'http://ordinary.invalid/mcp',
      authType: 'none',
      authSecret: null,
      passChatbotId: false,
      chatbotIdHeader: null,
      parameters: {},
      isActive: true,
      createdAt: new Date('2026-08-20T00:00:00.000Z'),
      updatedAt: new Date('2026-08-20T00:00:00.000Z'),
    }
    const ordinarySnapshot = { ...ordinaryServer }
    const fake = fakeDirectChatCanaryClient({ ordinaryServer })
    const failedProof = {
      ...passedProof,
      status: 'failed',
      retrieval: 'failed',
    } as const

    try {
      const result = await withDirectChatCanaryEnvironment(receiptPath, () =>
        runDirectChatCanaryTransaction({
          client: fake.client,
          fetchImpl: vi.fn(async () => new Response(null, { status: 200 })),
          runProofImpl: vi.fn(async () => failedProof),
        })
      )
      const receipt = await createReceiptStore(receiptPath).read()

      expect(result).toMatchObject({
        status: 'proof_blocked_but_cleaned',
        proof: 'failed',
        cleanup: 'exact-zero',
        fixtureOperation: 'cleanup',
        fixtureStatus: 'passed',
        error: 'transaction_failed',
        failure: 'proof_failed',
      })
      expect(receipt?.cleanup).toMatchObject({
        exactZeroReadback: true,
      })
      expect(fake.ordinaryWasSelected()).toBe(false)
      expect(fake.ordinaryWasChanged()).toBe(false)
      expect(fake.maps.servers.get(ordinaryServer.id)).toEqual(ordinarySnapshot)
      expect(fake.maps.servers.size).toBe(1)
      expect(fake.maps.configs.size).toBe(0)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test('refuses synthetic server cleanup when unexpected references remain', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'direct-chat-canary-reference-guard-')
    )
    const receiptPath = join(directory, 'receipt.json')
    const fake = fakeDirectChatCanaryClient()
    const ordinaryChatbotId = '00000000-0000-4000-8000-000000000097'
    const ordinaryReference = {
      id: '00000000-0000-4000-8000-000000000098',
      chatbotId: ordinaryChatbotId,
      mcpServerId: null,
      chatMode: 'tutor',
    }

    try {
      const result = await withDirectChatCanaryEnvironment(receiptPath, () =>
        runDirectChatCanaryTransaction({
          client: fake.client,
          fetchImpl: vi.fn(async () => new Response(null, { status: 200 })),
          runProofImpl: vi.fn(async () => failedProof),
          receiptStoreFactory: (path) => {
            const store = createReceiptStore(path)
            return {
              read: () => store.read(),
              write: async (receipt) => {
                if (receipt.state === 'switched') {
                  fake.maps.configs.set(ordinaryReference.id, {
                    ...ordinaryReference,
                    mcpServerId: receipt.fixture.candidateServerId,
                  })
                }
                await store.write(receipt)
              },
            }
          },
        })
      )
      const receipt = await createReceiptStore(receiptPath).read()

      expect(result).toMatchObject({
        status: 'recovery_required',
        cleanup: 'incomplete',
        fixtureOperation: 'cleanup',
        fixtureStatus: 'failed',
        error: 'transaction_failed',
        failure: 'cleanup_failed',
      })
      expect(receipt).toMatchObject({
        state: 'recovery_required',
        fixtureOperation: { operation: 'cleanup', status: 'failed' },
      })
      expect(fake.maps.servers.size).toBe(2)
      expect(fake.maps.configs.size).toBe(3)
      const configIds = [...fake.maps.configs.values()]
        .map((row) => row.id)
        .sort()
      expect(configIds).toEqual(
        [
          ordinaryReference.id,
          receipt?.fixture.candidateConfigId,
          receipt?.fixture.legacyConfigId,
        ].sort()
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test('cleans the prepared fixture when its receipt write fails', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'direct-chat-canary-receipt-write-')
    )
    const receiptPath = join(directory, 'receipt.json')
    const fake = fakeDirectChatCanaryClient()
    const runProofImpl = vi.fn(async () => passedProof)

    try {
      const result = await withDirectChatCanaryEnvironment(receiptPath, () =>
        runDirectChatCanaryTransaction({
          client: fake.client,
          fetchImpl: vi.fn(async () => new Response(null, { status: 200 })),
          runProofImpl,
          receiptStoreFactory: (path) => {
            const store = createReceiptStore(path)
            return {
              read: () => store.read(),
              write: async (receipt) => {
                if (receipt.state === 'prepared') {
                  throw new Error('synthetic receipt failure')
                }
                await store.write(receipt)
              },
            }
          },
        })
      )
      const receipt = await createReceiptStore(receiptPath).read()

      expect(result).toMatchObject({
        status: 'planned',
        cleanup: 'exact-zero',
        fixtureOperation: 'cleanup',
        fixtureStatus: 'passed',
        error: 'transaction_failed',
        failure: 'fixture_create_failed',
      })
      expect(receipt).toMatchObject({
        state: 'planned',
        failure: { category: 'fixture_create_failed' },
        cleanup: {
          candidateAbsent: true,
          legacyAbsent: true,
          fixtureAbsent: true,
          exactZeroReadback: true,
        },
      })
      expect(runProofImpl).not.toHaveBeenCalled()
      for (const map of Object.values(fake.maps)) expect(map.size).toBe(0)
      expect(await readFile(receiptPath, 'utf8')).not.toContain(
        'synthetic receipt failure'
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test('refuses a missing encryption secret before network or receipt work', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'direct-chat-canary-env-failure-')
    )
    const receiptPath = join(directory, 'receipt.json')
    const env = {
      CANDIDATE_URL:
        'http://mcp-doc-query.prd-doc-query.svc.cluster.local:1417/mcp/klicker',
      CANDIDATE_PROOF_URL: 'http://127.0.0.1:1417/mcp/klicker',
      RECEIPT_PATH: receiptPath,
      DOC_QUERY_JWT_TOKEN_KLICKER: 'synthetic-bearer-token',
      KLICKER_SOURCE_SHA: 'source-sha',
      CHAT_IMAGE_DIGEST: 'chat-image',
      DOC_QUERY_IMAGE_DIGEST: 'doc-query-image',
      ARGO_REVISION: 'argo-revision',
      NETWORK_POLICY_SOURCE_COMMIT: 'network-policy',
    }
    const previousEnv = new Map<string, string | undefined>()
    for (const [name, value] of Object.entries(env)) {
      previousEnv.set(name, process.env[name])
      process.env[name] = value
    }
    const previousAppSecret = process.env.APP_SECRET
    delete process.env.APP_SECRET
    const transaction = vi.fn()
    const client = {
      $transaction: transaction,
    } as unknown as PrismaClient
    const fetchImpl = vi.fn()

    try {
      await expect(
        runDirectChatCanaryTransaction({ client, fetchImpl })
      ).rejects.toThrow('ENV_REQUIRED: APP_SECRET is required')
      expect(fetchImpl).not.toHaveBeenCalled()
      expect(transaction).not.toHaveBeenCalled()
      await expect(readFile(receiptPath, 'utf8')).rejects.toMatchObject({
        code: 'ENOENT',
      })
    } finally {
      for (const [name, value] of previousEnv) {
        if (value === undefined) delete process.env[name]
        else process.env[name] = value
      }
      if (previousAppSecret === undefined) delete process.env.APP_SECRET
      else process.env.APP_SECRET = previousAppSecret
      await rm(directory, { recursive: true, force: true })
    }
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
