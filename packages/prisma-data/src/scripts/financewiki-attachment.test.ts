import { describe, expect, it } from 'vitest'
import type {
  CohortActivationConfigRecord,
  CohortActivationConfigUpdate,
  CohortActivationServerRecord,
  JsonValue,
} from './doc-query-cohort-activation.js'
import {
  applyFinanceWikiAttachment,
  FINANCEWIKI_KB_ID,
  type FinanceWikiAttachmentReceiptExpectation,
  type FinanceWikiAttachmentReceiptFile,
  type FinanceWikiAttachmentReceiptStore,
  type FinanceWikiAttachmentStore,
  type FinanceWikiAttachmentTarget,
  type FinanceWikiAttachmentTransactionStore,
  planFinanceWikiAttachment,
  readFinanceWikiAttachment,
  recoverFinanceWikiAttachment,
  rollbackFinanceWikiAttachment,
} from './financewiki-attachment.js'

const SERVER_ID = '00000000-0000-4000-8000-000000000101'
const CHATBOT_A_ID = '00000000-0000-4000-8000-000000000102'
const CHATBOT_B_ID = '00000000-0000-4000-8000-000000000103'
const CONFIG_A_REVIEW_ID = '00000000-0000-4000-8000-000000000201'
const CONFIG_A_TUTOR_ID = '00000000-0000-4000-8000-000000000202'
const CONFIG_B_REVIEW_ID = '00000000-0000-4000-8000-000000000203'
const CONFIG_B_TUTOR_ID = '00000000-0000-4000-8000-000000000204'
const BASE_KB_ID = '00000000-0000-4000-8000-000000000301'
const OTHER_KB_ID = '00000000-0000-4000-8000-000000000302'
const INITIAL_UPDATED_AT = new Date('2026-09-04T10:00:00.000Z')

const attachmentTargets: FinanceWikiAttachmentTarget[] = [
  { chatbotId: CHATBOT_A_ID, chatMode: 'review' },
  { chatbotId: CHATBOT_A_ID, chatMode: 'tutor' },
  { chatbotId: CHATBOT_B_ID, chatMode: 'review' },
  { chatbotId: CHATBOT_B_ID, chatMode: 'tutor' },
]

function cloneJson(value: JsonValue): JsonValue {
  return value === null || typeof value !== 'object'
    ? value
    : structuredClone(value)
}

function cloneConfig(
  config: CohortActivationConfigRecord
): CohortActivationConfigRecord {
  return {
    ...config,
    allowedTools: cloneJson(config.allowedTools),
    parameters: cloneJson(config.parameters),
    updatedAt: new Date(config.updatedAt),
  }
}

function cloneServer(
  server: CohortActivationServerRecord
): CohortActivationServerRecord {
  return {
    ...server,
    parameters: cloneJson(server.parameters),
    updatedAt: new Date(server.updatedAt),
  }
}

function makeServer(): CohortActivationServerRecord {
  return {
    id: SERVER_ID,
    name: 'KB',
    description: 'Synthetic FinanceWiki attachment server',
    url: 'https://kb.synthetic.invalid/mcp',
    authType: 'bearer',
    passChatbotId: true,
    chatbotIdHeader: 'Chatbot-ID',
    parameters: {},
    hasAuthSecret: true,
    isActive: true,
    updatedAt: new Date(INITIAL_UPDATED_AT),
  }
}

function makeParameters(
  kbIds: readonly string[] = [BASE_KB_ID],
  representation: 'kb_id' | 'kb_ids' = 'kb_id'
): JsonValue {
  const common = {
    required: true,
    toolAlias: 'doc_query',
    metadata: { fixture: 'financewiki-attachment' },
  }
  return representation === 'kb_id'
    ? { ...common, kb_id: kbIds[0]! }
    : { ...common, kb_ids: [...kbIds] }
}

function makeConfig(
  id: string,
  chatbotId: string,
  chatMode: string,
  parameters: JsonValue = makeParameters()
): CohortActivationConfigRecord {
  return {
    id,
    chatbotId,
    mcpServerId: SERVER_ID,
    chatMode,
    allowedTools: ['doc_query'],
    priority: 4,
    isEnabled: true,
    parameters,
    updatedAt: new Date(INITIAL_UPDATED_AT),
  }
}

function makeConfigs(): CohortActivationConfigRecord[] {
  return [
    makeConfig(CONFIG_A_REVIEW_ID, CHATBOT_A_ID, 'review'),
    makeConfig(CONFIG_A_TUTOR_ID, CHATBOT_A_ID, 'tutor'),
    makeConfig(CONFIG_B_REVIEW_ID, CHATBOT_B_ID, 'review'),
    makeConfig(CONFIG_B_TUTOR_ID, CHATBOT_B_ID, 'tutor'),
  ]
}

function makeManifest(
  targets: readonly FinanceWikiAttachmentTarget[] = attachmentTargets
) {
  return { version: 1, targets }
}

class MemoryReceiptStore implements FinanceWikiAttachmentReceiptStore {
  private current: FinanceWikiAttachmentReceiptFile | null = null
  private readonly history: FinanceWikiAttachmentReceiptFile[] = []
  private writeCountValue = 0
  private failOnWrite: number | null = null
  private failAfterStore = false

  get writeCount(): number {
    return this.writeCountValue
  }

  get writes(): readonly FinanceWikiAttachmentReceiptFile[] {
    return this.history
  }

  async read(): Promise<FinanceWikiAttachmentReceiptFile | null> {
    return this.current ? structuredClone(this.current) : null
  }

  async write(
    receipt: FinanceWikiAttachmentReceiptFile,
    expected: FinanceWikiAttachmentReceiptExpectation
  ): Promise<void> {
    this.writeCountValue += 1
    if (expected === null) {
      if (this.current) throw new Error('receipt already exists')
    } else if (
      !this.current ||
      this.current.manifestFingerprint !== expected.manifestFingerprint ||
      this.current.payloadDigest !== expected.payloadDigest ||
      this.current.state !== expected.state
    ) {
      throw new Error('receipt changed before write')
    }

    if (this.failOnWrite === this.writeCountValue) {
      if (this.failAfterStore) {
        this.current = structuredClone(receipt)
        this.history.push(structuredClone(receipt))
      }
      throw new Error('synthetic receipt-store interruption')
    }

    this.current = structuredClone(receipt)
    this.history.push(structuredClone(receipt))
  }

  interruptOnWrite(writeNumber: number, afterStore = false): void {
    this.failOnWrite = writeNumber
    this.failAfterStore = afterStore
  }

  clearInterruption(): void {
    this.failOnWrite = null
    this.failAfterStore = false
  }
}

function makeHarness(
  initialConfigs = makeConfigs(),
  initialServer: CohortActivationServerRecord | null = makeServer()
): {
  store: FinanceWikiAttachmentStore
  receiptStore: MemoryReceiptStore
  configs: () => CohortActivationConfigRecord[]
  replaceConfig: (config: CohortActivationConfigRecord) => void
  updateCalls: () => number
  failNextUpdateFor: (configId: string) => void
} {
  let server = initialServer ? cloneServer(initialServer) : null
  let configs = new Map(
    initialConfigs.map((config) => [config.id, cloneConfig(config)])
  )
  let updateCalls = 0
  let failedConfigId: string | null = null

  const makeTransaction = (
    workingServer: CohortActivationServerRecord | null,
    workingConfigs: Map<string, CohortActivationConfigRecord>
  ): FinanceWikiAttachmentTransactionStore => ({
    async findServerByName(name) {
      return workingServer?.name === name ? cloneServer(workingServer) : null
    },
    async findServerById(id) {
      return workingServer?.id === id ? cloneServer(workingServer) : null
    },
    async findConfigById(id) {
      const config = workingConfigs.get(id)
      return config ? cloneConfig(config) : null
    },
    async findConfigsByServerId(mcpServerId) {
      return [...workingConfigs.values()]
        .filter((config) => config.mcpServerId === mcpServerId)
        .map(cloneConfig)
    },
    async updateConfig(
      id,
      expectedUpdatedAt,
      data: CohortActivationConfigUpdate
    ) {
      const current = workingConfigs.get(id)
      if (
        !current ||
        current.updatedAt.getTime() !== expectedUpdatedAt.getTime() ||
        id === failedConfigId
      ) {
        return null
      }
      const updated: CohortActivationConfigRecord = {
        ...current,
        ...data,
        allowedTools: cloneJson(data.allowedTools),
        parameters: cloneJson(data.parameters),
        updatedAt: new Date(current.updatedAt.getTime() + 1),
      }
      workingConfigs.set(id, updated)
      updateCalls += 1
      return cloneConfig(updated)
    },
  })

  const store: FinanceWikiAttachmentStore = {
    async transaction(callback) {
      const workingServer = server ? cloneServer(server) : null
      const workingConfigs = new Map(
        [...configs].map(([id, config]) => [id, cloneConfig(config)])
      )
      const result = await callback(
        makeTransaction(workingServer, workingConfigs)
      )
      server = workingServer
      configs = workingConfigs
      return result
    },
  }

  const receiptStore = new MemoryReceiptStore()
  return {
    store,
    receiptStore,
    configs: () => [...configs.values()].map(cloneConfig),
    replaceConfig: (config) => configs.set(config.id, cloneConfig(config)),
    updateCalls: () => updateCalls,
    failNextUpdateFor: (configId) => {
      failedConfigId = configId
    },
  }
}

function parametersJson(config: CohortActivationConfigRecord): string {
  return JSON.stringify(config.parameters)
}

describe('FinanceWiki attachment operator', () => {
  it('plans every enabled target mode without writing', async () => {
    const harness = makeHarness()

    const plan = await planFinanceWikiAttachment(
      harness.store,
      makeManifest(),
      harness.receiptStore
    )

    expect(plan).toMatchObject({
      status: 'ready',
      serverId: SERVER_ID,
      targetCount: 4,
      modeCount: 2,
      alreadyAttached: 0,
      wouldAttach: 4,
      receiptState: null,
    })
    expect(plan.manifestFingerprint).toMatch(/^[0-9a-f]{64}$/)
    expect(harness.receiptStore.writeCount).toBe(0)
    expect(harness.updateCalls()).toBe(0)
  })

  it('applies all modes, records exact priors, and becomes a no-op', async () => {
    const harness = makeHarness()
    const before = new Map(
      harness.configs().map((config) => [config.id, parametersJson(config)])
    )

    const applied = await applyFinanceWikiAttachment(
      harness.store,
      makeManifest(),
      harness.receiptStore
    )

    expect(applied.status).toBe('applied')
    if (applied.status !== 'applied') throw new Error('apply did not attach')
    expect(applied.receipt.entries).toHaveLength(4)
    for (const entry of applied.receipt.entries) {
      expect(JSON.stringify(entry.prior.parameters)).toBe(
        before.get(entry.configId)
      )
      const attached = entry.attached.parameters as {
        kb_id?: JsonValue
        kb_ids?: JsonValue
      }
      expect(attached.kb_id).toBeUndefined()
      expect(attached.kb_ids).toEqual([BASE_KB_ID, FINANCEWIKI_KB_ID].sort())
    }
    expect(
      harness
        .configs()
        .every((config) =>
          JSON.stringify(config.parameters).includes(FINANCEWIKI_KB_ID)
        )
    ).toBe(true)

    const writesBeforeNoOp = harness.receiptStore.writeCount
    const updatesBeforeNoOp = harness.updateCalls()
    const noOp = await applyFinanceWikiAttachment(
      harness.store,
      makeManifest(),
      harness.receiptStore
    )
    const plan = await planFinanceWikiAttachment(
      harness.store,
      makeManifest(),
      harness.receiptStore
    )

    expect(noOp).toEqual({ status: 'noop', receipt: applied.receipt })
    expect(plan).toMatchObject({
      status: 'noop',
      alreadyAttached: 4,
      wouldAttach: 0,
      receiptState: 'applied',
    })
    expect(harness.receiptStore.writeCount).toBe(writesBeforeNoOp)
    expect(harness.updateCalls()).toBe(updatesBeforeNoOp)
  })

  it('recovers a preparation receipt before any config mutation', async () => {
    const harness = makeHarness()
    const before = harness.configs().map(parametersJson)
    harness.receiptStore.interruptOnWrite(1, true)

    await expect(
      applyFinanceWikiAttachment(
        harness.store,
        makeManifest(),
        harness.receiptStore
      )
    ).rejects.toThrow('synthetic receipt-store interruption')
    expect((await harness.receiptStore.read())?.state).toBe('preparing')
    expect(harness.configs().map(parametersJson)).toEqual(before)

    harness.receiptStore.clearInterruption()
    const recovered = await recoverFinanceWikiAttachment(
      harness.store,
      harness.receiptStore
    )

    expect(recovered.status).toBe('recovered')
    if (recovered.status !== 'recovered') throw new Error('recovery failed')
    expect(recovered.receipt.state).toBe('applied')
    expect(
      harness
        .configs()
        .every((config) =>
          JSON.stringify(config.parameters).includes(FINANCEWIKI_KB_ID)
        )
    ).toBe(true)
  })

  it('recovers a preparation receipt after the transaction committed', async () => {
    const harness = makeHarness()
    harness.receiptStore.interruptOnWrite(2)

    await expect(
      applyFinanceWikiAttachment(
        harness.store,
        makeManifest(),
        harness.receiptStore
      )
    ).rejects.toThrow('synthetic receipt-store interruption')
    expect((await harness.receiptStore.read())?.state).toBe('preparing')
    expect(
      harness
        .configs()
        .every((config) =>
          JSON.stringify(config.parameters).includes(FINANCEWIKI_KB_ID)
        )
    ).toBe(true)

    harness.receiptStore.clearInterruption()
    const recovered = await recoverFinanceWikiAttachment(
      harness.store,
      harness.receiptStore
    )

    expect(recovered.status).toBe('recovered')
    if (recovered.status !== 'recovered') throw new Error('recovery failed')
    expect(recovered.receipt.state).toBe('applied')
    expect(harness.updateCalls()).toBe(4)
  })

  it('rolls back every mode and restores each prior parameter JSON exactly', async () => {
    const harness = makeHarness()
    const before = new Map(
      harness.configs().map((config) => [config.id, parametersJson(config)])
    )
    await applyFinanceWikiAttachment(
      harness.store,
      makeManifest(),
      harness.receiptStore
    )

    const rolledBack = await rollbackFinanceWikiAttachment(
      harness.store,
      harness.receiptStore
    )
    const readback = await readFinanceWikiAttachment(
      harness.store,
      harness.receiptStore
    )

    expect(rolledBack.status).toBe('rolled_back')
    if (rolledBack.status !== 'rolled_back') {
      throw new Error('rollback did not complete')
    }
    expect(rolledBack.receipt.state).toBe('rolled_back')
    expect(
      new Map(
        harness.configs().map((config) => [config.id, parametersJson(config)])
      )
    ).toEqual(before)
    expect(readback).toEqual({
      state: 'rolled_back',
      targetCount: 4,
      attached: 0,
      restored: 4,
    })
  })

  it('does not partially attach modes when one compare-and-set fails', async () => {
    const harness = makeHarness()
    const before = new Map(
      harness.configs().map((config) => [config.id, parametersJson(config)])
    )
    harness.failNextUpdateFor(CONFIG_B_TUTOR_ID)

    await expect(
      applyFinanceWikiAttachment(
        harness.store,
        makeManifest(),
        harness.receiptStore
      )
    ).rejects.toMatchObject({ code: 'CONCURRENT_EDIT' })

    expect(harness.updateCalls()).toBe(3)
    expect(
      new Map(
        harness.configs().map((config) => [config.id, parametersJson(config)])
      )
    ).toEqual(before)
    expect(harness.receiptStore.writeCount).toBe(1)
    expect((await harness.receiptStore.read())?.state).toBe('preparing')
  })

  it.each([
    {
      name: 'the KB server is absent',
      makeCase: () => makeHarness(makeConfigs(), null),
      manifest: makeManifest(),
      code: 'KB_SERVER_MISSING',
    },
    {
      name: 'an enabled target config is absent',
      makeCase: () => makeHarness(makeConfigs().slice(0, 3)),
      manifest: makeManifest(),
      code: 'CONFIG_MISSING',
    },
    {
      name: 'the manifest omits an enabled target mode',
      makeCase: () => makeHarness(),
      manifest: makeManifest([{ chatbotId: CHATBOT_A_ID, chatMode: 'tutor' }]),
      code: 'TARGET_MODES_INCOMPLETE',
    },
    {
      name: 'the manifest target mode sets disagree',
      makeCase: () => makeHarness(),
      manifest: makeManifest([
        { chatbotId: CHATBOT_A_ID, chatMode: 'tutor' },
        { chatbotId: CHATBOT_B_ID, chatMode: 'review' },
      ]),
      code: 'TARGET_MODE_SET_MISMATCH',
    },
    {
      name: 'enabled modes use different KB sets',
      makeCase: () =>
        makeHarness([
          ...makeConfigs().slice(0, 3),
          makeConfig(
            CONFIG_B_TUTOR_ID,
            CHATBOT_B_ID,
            'tutor',
            makeParameters([OTHER_KB_ID])
          ),
        ]),
      manifest: makeManifest(),
      code: 'MODE_SET_MISMATCH',
    },
    {
      name: 'a target parameter object is malformed',
      makeCase: () =>
        makeHarness([
          makeConfig(CONFIG_A_REVIEW_ID, CHATBOT_A_ID, 'review', {
            required: true,
            toolAlias: 'doc_query',
            kb_id: BASE_KB_ID,
            kb_ids: [BASE_KB_ID],
          }),
          ...makeConfigs().slice(1),
        ]),
      manifest: makeManifest(),
      code: 'PARAMETERS_MALFORMED',
    },
  ])('fails before writing when $name', async ({
    makeCase,
    manifest,
    code,
  }) => {
    const harness = makeCase()
    const before = harness.configs().map(parametersJson)

    await expect(
      applyFinanceWikiAttachment(harness.store, manifest, harness.receiptStore)
    ).rejects.toMatchObject({ code })

    expect(harness.receiptStore.writeCount).toBe(0)
    expect(harness.updateCalls()).toBe(0)
    expect(harness.configs().map(parametersJson)).toEqual(before)
  })

  it('fails without another write when an applied receipt is stale', async () => {
    const harness = makeHarness()
    await applyFinanceWikiAttachment(
      harness.store,
      makeManifest(),
      harness.receiptStore
    )
    const stale = harness.configs()[0]!
    harness.replaceConfig({
      ...stale,
      updatedAt: new Date(stale.updatedAt.getTime() + 1000),
    })
    const writesBefore = harness.receiptStore.writeCount
    const updatesBefore = harness.updateCalls()

    await expect(
      rollbackFinanceWikiAttachment(harness.store, harness.receiptStore)
    ).rejects.toMatchObject({ code: 'RECEIPT_STALE' })

    expect(harness.receiptStore.writeCount).toBe(writesBefore)
    expect(harness.updateCalls()).toBe(updatesBefore)
    expect(harness.configs()[0]!.updatedAt).not.toEqual(stale.updatedAt)
  })
})
