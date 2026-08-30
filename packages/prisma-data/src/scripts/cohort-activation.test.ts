import { createHash } from 'node:crypto'
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { hostname, tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  type ActivationBindingCreate,
  type ActivationBindingRecord,
  type ActivationConfigCreate,
  type ActivationConfigRecord,
  type ActivationKnowledgeBaseCreate,
  type ActivationReceipt,
  type ActivationReceiptPayload,
  type ActivationReceiptSession,
  type ActivationReceiptStore,
  type ActivationServerCreate,
  type ActivationServerRecord,
  type ActivationStore,
  type ActivationTransactionStore,
  type ChatbotRecord,
  CohortActivationError,
  createFileActivationReceiptStore,
  dryRunCohortActivation,
  type FrozenCohortManifest,
  fingerprintManifest,
  type KnowledgeBaseRecord,
  prepareCohortActivation,
  readbackCohortActivation,
  rollbackCohortChatbot,
  switchCohortChatbot,
  validateCohortManifest,
} from './cohort-activation.js'

const TARGET = {
  description: 'Scoped document retrieval',
  url: 'https://doc-query.synthetic.invalid/mcp',
}
const SOURCE_SERVER_ID = uuid(900)
const SOURCE_CREDENTIAL = 'encrypted-transport-credential'
const OWNER_ID = uuid(901)

function uuid(number: number): string {
  return `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function canonicalReceipt(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalReceipt(item))
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonicalReceipt(record[key])])
    )
  }
  return value
}

function receiptDigest(receipt: Record<string, unknown>): string {
  const { payloadDigest: _payloadDigest, ...withoutDigest } = receipt
  return createHash('sha256')
    .update(JSON.stringify(canonicalReceipt(withoutDigest)))
    .digest('hex')
}

function legacyReceipt(
  receipt: ActivationReceipt,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const { pendingRollbackOrigin: _origin, ...withoutOrigin } = clone(receipt)
  const legacy = {
    ...withoutOrigin,
    receiptVersion: 1,
    ...overrides,
  }
  legacy.payloadDigest = receiptDigest(legacy)
  return legacy
}

function deadPid(): number {
  for (let candidate = 2_000_000; candidate < 2_000_100; candidate += 1) {
    try {
      process.kill(candidate, 0)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') return candidate
    }
  }
  throw new Error('no dead test pid found')
}

function writeLockOwner(lockPath: string, pid: number, host = hostname()) {
  writeFileSync(
    lockPath,
    `${JSON.stringify({
      version: 2,
      pid,
      host,
      token: uuid(9990),
      acquiredAt: new Date().toISOString(),
    })}\n`
  )
}

function makeManifest(): FrozenCohortManifest {
  const corpora: FrozenCohortManifest['corpora'] = []
  let chatbotNumber = 1
  let courseNumber = 1
  let configNumber = 1
  for (let corpusNumber = 0; corpusNumber < 15; corpusNumber += 1) {
    const chatbotCount = corpusNumber < 12 ? 1 : corpusNumber === 12 ? 2 : 4
    const courseCount = corpusNumber < 12 ? 1 : corpusNumber === 12 ? 2 : 1
    const modes =
      corpusNumber === 14
        ? ['default', 'tutor', 'explainer', 'tutoradvanced']
        : ['tutor', 'explainer']
    const chatbotIds = Array.from({ length: chatbotCount }, () =>
      uuid(1000 + chatbotNumber++)
    )
    const courseIds = Array.from({ length: courseCount }, () =>
      uuid(2000 + courseNumber++)
    )
    const configurations = chatbotIds.flatMap((chatbotId) =>
      modes
        .slice(
          0,
          corpusNumber === 13 ? 1 : corpusNumber === 14 ? modes.length : 2
        )
        .map((chatMode) => ({
          allowedTools: [`source_tool_${corpusNumber}`],
          chatbotId,
          chatMode,
          configId: uuid(3000 + configNumber++),
          parameters: { required: true, toolAlias: 'doc_query' },
          priority: 0,
          sourceServerId: SOURCE_SERVER_ID,
        }))
    )
    corpora.push({
      chatbotIds,
      configurations,
      courseIds,
      kbId: uuid(4000 + corpusNumber),
      kbName: `Synthetic KB ${String(corpusNumber + 1)}`,
      ownerId: OWNER_ID,
      sourceCollection: 'source_collection',
      targetCollection: 'target_collection',
      tool: `source_tool_${corpusNumber}`,
    })
  }
  return {
    collection: 'synthetic_collection',
    corpora,
    environment: 'test',
    excluded: [
      {
        chatbotId: uuid(7001),
        chatMode: 'tutor',
        configId: uuid(7101),
        serverId: SOURCE_SERVER_ID,
        tool: 'bf1_expert',
      },
      {
        chatbotId: uuid(7001),
        chatMode: 'explainer',
        configId: uuid(7102),
        serverId: SOURCE_SERVER_ID,
        tool: 'bf1_expert',
      },
      {
        chatbotId: uuid(7002),
        chatMode: 'tutor',
        configId: uuid(7103),
        serverId: SOURCE_SERVER_ID,
        tool: 'df_cf2_expert',
      },
      {
        chatbotId: uuid(7002),
        chatMode: 'explainer',
        configId: uuid(7104),
        serverId: SOURCE_SERVER_ID,
        tool: 'vorkurs2_expert',
      },
    ],
    singletonCanaryKbId: uuid(8000),
    version: 1,
  }
}

class MemoryStore implements ActivationStore {
  readonly sourceServer: ActivationServerRecord = {
    id: SOURCE_SERVER_ID,
    name: 'Klicker-compat',
    description: 'legacy transport',
    url: 'https://legacy.synthetic.invalid/mcp',
    authType: 'bearer',
    authSecret: SOURCE_CREDENTIAL,
    passChatbotId: true,
    chatbotIdHeader: 'Chatbot-ID',
    parameters: {},
    isActive: true,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  }
  readonly chatbots = new Map<string, ChatbotRecord>()
  readonly courses = new Map<
    string,
    { id: string; ownerId: string; updatedAt: Date }
  >()
  readonly knowledgeBases = new Map<string, KnowledgeBaseRecord>()
  readonly sourceConfigs = new Map<string, ActivationConfigRecord>()
  readonly targetConfigs = new Map<string, ActivationConfigRecord>()
  readonly bindings = new Map<string, ActivationBindingRecord>()
  readonly servers = new Map<string, ActivationServerRecord>()
  writes = 0
  transactions = 0
  legacyUpdates = 0
  failTargetConfigUpdate = false
  failNextTransaction = false
  private sequence = 20000
  private clock = 1

  constructor(manifest: FrozenCohortManifest) {
    const chatbotIds = manifest.corpora.flatMap((corpus) => corpus.chatbotIds)
    for (const [index, chatbotId] of chatbotIds.entries()) {
      const corpus = manifest.corpora.find((entry) =>
        entry.chatbotIds.includes(chatbotId)
      )!
      this.chatbots.set(chatbotId, {
        id: chatbotId,
        courseId: corpus.courseIds[index % corpus.courseIds.length]!,
        ownerId: corpus.ownerId,
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      })
    }
    for (const courseId of new Set(
      manifest.corpora.flatMap((corpus) => corpus.courseIds)
    )) {
      this.courses.set(courseId, {
        id: courseId,
        ownerId: OWNER_ID,
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      })
    }
    for (const corpus of manifest.corpora) {
      for (const configuration of corpus.configurations) {
        this.sourceConfigs.set(configuration.configId, {
          id: configuration.configId,
          chatbotId: configuration.chatbotId,
          mcpServerId: configuration.sourceServerId,
          chatMode: configuration.chatMode,
          allowedTools: clone(configuration.allowedTools),
          priority: configuration.priority,
          isEnabled: true,
          parameters: clone(configuration.parameters),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        })
      }
    }
    for (const configuration of manifest.excluded) {
      this.sourceConfigs.set(configuration.configId, {
        id: configuration.configId,
        chatbotId: configuration.chatbotId,
        mcpServerId: configuration.serverId,
        chatMode: configuration.chatMode,
        allowedTools: [configuration.tool],
        priority: 0,
        isEnabled: true,
        parameters: { required: true, toolAlias: 'doc_query' },
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      })
    }
  }

  private nextId(): string {
    this.sequence += 1
    return uuid(this.sequence)
  }

  private nextDate(): Date {
    this.clock += 1
    return new Date(Date.UTC(2026, 0, 1, 0, 0, 0, this.clock))
  }

  private copy<T extends { updatedAt: Date }>(record: T): T {
    return {
      ...record,
      updatedAt: new Date(record.updatedAt),
    }
  }

  private snapshot() {
    return {
      knowledgeBases: new Map(
        [...this.knowledgeBases].map(([id, row]) => [id, this.copy(row)])
      ),
      targetConfigs: new Map(
        [...this.targetConfigs].map(([id, row]) => [id, this.copy(row)])
      ),
      bindings: new Map(
        [...this.bindings].map(([id, row]) => [id, this.copy(row)])
      ),
      servers: new Map(
        [...this.servers].map(([id, row]) => [id, this.copy(row)])
      ),
    }
  }

  private restore(snapshot: ReturnType<MemoryStore['snapshot']>): void {
    this.knowledgeBases.clear()
    snapshot.knowledgeBases.forEach((row, id) => {
      this.knowledgeBases.set(id, row)
    })
    this.targetConfigs.clear()
    snapshot.targetConfigs.forEach((row, id) => {
      this.targetConfigs.set(id, row)
    })
    this.bindings.clear()
    snapshot.bindings.forEach((row, id) => {
      this.bindings.set(id, row)
    })
    this.servers.clear()
    snapshot.servers.forEach((row, id) => {
      this.servers.set(id, row)
    })
  }

  async findKnowledgeBaseById(id: string) {
    const row = this.knowledgeBases.get(id)
    return row ? this.copy(row) : null
  }

  async findKnowledgeBasesByName(name: string) {
    return [...this.knowledgeBases.values()]
      .filter((row) => row.name === name)
      .map((row) => this.copy(row))
  }

  async findChatbotById(id: string) {
    const row = this.chatbots.get(id)
    return row ? this.copy(row) : null
  }

  async findCourseById(id: string) {
    const row = this.courses.get(id)
    return row ? this.copy(row) : null
  }

  async findServersByName(name: string) {
    const rows =
      name === this.sourceServer.name
        ? [this.sourceServer]
        : [...this.servers.values()].filter((row) => row.name === name)
    return rows.map((row) => this.copy(row))
  }

  async findConfigById(id: string) {
    const row = this.sourceConfigs.get(id) ?? this.targetConfigs.get(id)
    return row ? this.copy(row) : null
  }

  async findConfigsByServerId(mcpServerId: string) {
    return [...this.targetConfigs.values()]
      .filter((row) => row.mcpServerId === mcpServerId)
      .map((row) => this.copy(row))
  }

  async findBindingsByChatbotId(chatbotId: string) {
    return [...this.bindings.values()]
      .filter((row) => row.chatbotId === chatbotId)
      .map((row) => this.copy(row))
  }

  async createKnowledgeBase(data: ActivationKnowledgeBaseCreate) {
    this.writes += 1
    const row = {
      ...data,
      deletedAt: null,
      updatedAt: this.nextDate(),
    }
    this.knowledgeBases.set(row.id, row)
    return this.copy(row)
  }

  async createServer(data: ActivationServerCreate) {
    this.writes += 1
    const row = {
      id: this.nextId(),
      ...data,
      updatedAt: this.nextDate(),
    }
    this.servers.set(row.id, row)
    return this.copy(row)
  }

  async createBinding(data: ActivationBindingCreate) {
    this.writes += 1
    const row = {
      id: this.nextId(),
      ...data,
      updatedAt: this.nextDate(),
    }
    this.bindings.set(row.id, row)
    return this.copy(row)
  }

  async createConfig(data: ActivationConfigCreate) {
    this.writes += 1
    const row = {
      id: this.nextId(),
      ...data,
      updatedAt: this.nextDate(),
    }
    this.targetConfigs.set(row.id, row)
    return this.copy(row)
  }

  async updateBinding(snapshot: ActivationBindingRecord, isEnabled: boolean) {
    const current = this.bindings.get(snapshot.id)
    if (
      !current ||
      current.updatedAt.getTime() !== snapshot.updatedAt.getTime()
    ) {
      throw new CohortActivationError('CONCURRENT_EDIT', 'binding changed')
    }
    const updated = {
      ...current,
      isEnabled,
      updatedAt: this.nextDate(),
    }
    this.bindings.set(updated.id, updated)
    this.writes += 1
    return this.copy(updated)
  }

  async updateConfig(snapshot: ActivationConfigRecord, isEnabled: boolean) {
    if (this.failTargetConfigUpdate) {
      this.failTargetConfigUpdate = false
      throw new CohortActivationError('CONCURRENT_EDIT', 'config changed')
    }
    if (this.sourceConfigs.has(snapshot.id)) {
      this.legacyUpdates += 1
      throw new CohortActivationError('LEGACY_MUTATION', 'legacy row update')
    }
    const current = this.targetConfigs.get(snapshot.id)
    if (
      !current ||
      current.updatedAt.getTime() !== snapshot.updatedAt.getTime()
    ) {
      throw new CohortActivationError('CONCURRENT_EDIT', 'config changed')
    }
    const updated = {
      ...current,
      isEnabled,
      updatedAt: this.nextDate(),
    }
    this.targetConfigs.set(updated.id, updated)
    this.writes += 1
    return this.copy(updated)
  }

  async transaction<T>(
    callback: (store: ActivationTransactionStore) => Promise<T>
  ): Promise<T> {
    this.transactions += 1
    if (this.failNextTransaction) {
      this.failNextTransaction = false
      throw new Error('synthetic transaction failure')
    }
    const before = this.snapshot()
    try {
      return await callback(this)
    } catch (error) {
      this.restore(before)
      throw error
    }
  }

  targetServer(): ActivationServerRecord | null {
    return (
      [...this.servers.values()].find((server) => server.name === 'KB') ?? null
    )
  }

  targetConfigForChatbot(chatbotId: string) {
    return [...this.targetConfigs.values()].filter(
      (config) => config.chatbotId === chatbotId
    )
  }

  bindingForChatbot(chatbotId: string) {
    return [...this.bindings.values()].find(
      (binding) => binding.chatbotId === chatbotId
    )
  }
}

class MemoryReceiptStore {
  value: ActivationReceiptPayload | null = null
  writes = 0
  private locked = false
  private blockedExclusive: {
    entered: Promise<void>
    signalEntered: () => void
    released: Promise<void>
    release: () => void
  } | null = null

  async read() {
    return this.value
  }

  async compareAndSwap(
    expectedDigest: string | null,
    receipt: ActivationReceiptPayload
  ) {
    if ((this.value?.payloadDigest ?? null) !== expectedDigest) {
      throw new CohortActivationError('RECEIPT_CAS_FAILED', 'stale receipt')
    }
    this.value = clone(receipt)
    this.writes += 1
  }

  async runExclusive<T>(
    callback: (store: ActivationReceiptSession) => Promise<T>
  ) {
    if (this.locked) {
      throw new CohortActivationError(
        'RECEIPT_LOCKED',
        'receipt is already being updated'
      )
    }
    this.locked = true
    const blocked = this.blockedExclusive
    try {
      if (blocked) {
        blocked.signalEntered()
        await blocked.released
      }
      return await callback(this)
    } finally {
      this.locked = false
    }
  }

  blockNextExclusive() {
    let resolveEntered!: () => void
    let resolveRelease!: () => void
    const entered = new Promise<void>((resolve) => {
      resolveEntered = resolve
    })
    const released = new Promise<void>((resolve) => {
      resolveRelease = resolve
    })
    this.blockedExclusive = {
      entered,
      signalEntered: resolveEntered,
      released,
      release: resolveRelease,
    }
  }

  async waitForExclusive() {
    await this.blockedExclusive?.entered
  }

  releaseExclusive() {
    this.blockedExclusive?.release()
    this.blockedExclusive = null
  }
}

class ConcurrentReceiptStore implements ActivationReceiptStore {
  private readCount = 0
  private releaseReads: (() => void) | undefined
  private readonly readsReleased = new Promise<void>((resolve) => {
    this.releaseReads = resolve
  })

  constructor(private readonly delegate: ActivationReceiptStore) {}

  async read() {
    const value = await this.delegate.read()
    this.readCount += 1
    if (this.readCount === 1) {
      await this.readsReleased
    } else if (this.readCount === 2) {
      this.releaseReads?.()
    }
    return value
  }

  async compareAndSwap(
    expectedDigest: string | null,
    receipt: ActivationReceiptPayload
  ) {
    return this.delegate.compareAndSwap(expectedDigest, receipt)
  }

  async runExclusive<T>(
    callback: (store: ActivationReceiptSession) => Promise<T>
  ) {
    return this.delegate.runExclusive(callback)
  }
}

function options(
  receiptStore: ActivationReceiptStore,
  manifest: FrozenCohortManifest
) {
  return {
    expectedManifestFingerprint: fingerprintManifest(manifest),
    receiptStore,
    target: TARGET,
  }
}

function chatbotIdForAlias(
  manifest: FrozenCohortManifest,
  alias: string
): string {
  const ids = manifest.corpora.flatMap((corpus) => corpus.chatbotIds).sort()
  return ids[Number(alias.slice(-3)) - 1]!
}

describe('cohort activation operator', () => {
  let manifest: FrozenCohortManifest
  let store: MemoryStore
  let receiptStore: MemoryReceiptStore

  beforeEach(() => {
    manifest = makeManifest()
    store = new MemoryStore(manifest)
    receiptStore = new MemoryReceiptStore()
  })

  it('validates the frozen counts and excludes reserved corpora', () => {
    validateCohortManifest(manifest)
    expect(manifest.corpora).toHaveLength(15)
    expect(
      new Set(manifest.corpora.flatMap((corpus) => corpus.chatbotIds))
    ).toHaveLength(22)
    expect(
      new Set(manifest.corpora.flatMap((corpus) => corpus.courseIds))
    ).toHaveLength(16)
    expect(
      manifest.corpora.flatMap((corpus) => corpus.configurations)
    ).toHaveLength(48)
    expect(manifest.corpora[12]!.chatbotIds).toHaveLength(2)
    expect(manifest.corpora[12]!.courseIds).toHaveLength(2)

    const excluded = clone(manifest)
    excluded.corpora[0]!.tool = 'bf1_expert'
    expect(() => validateCohortManifest(excluded)).toThrowError(
      expect.objectContaining({ code: 'EXCLUDED_CORPUS' })
    )

    const wrongExclusionMultiset = clone(manifest)
    wrongExclusionMultiset.excluded[3]!.tool = 'bf1_expert'
    expect(() => validateCohortManifest(wrongExclusionMultiset)).toThrowError(
      expect.objectContaining({ code: 'COHORT_COUNT_MISMATCH' })
    )
  })

  it('allows HTTPS or only the reviewed internal PRD target', async () => {
    await expect(
      dryRunCohortActivation(
        store,
        manifest,
        {
          description: TARGET.description,
          url: 'http://mcp-doc-query.prd-doc-query.svc.cluster.local:1417/mcp/klicker',
        },
        fingerprintManifest(manifest)
      )
    ).resolves.toMatchObject({ status: 'dry-run' })
    await expect(
      dryRunCohortActivation(
        store,
        manifest,
        {
          description: TARGET.description,
          url: 'http://other.internal.invalid/mcp',
        },
        fingerprintManifest(manifest)
      )
    ).rejects.toThrowError(expect.objectContaining({ code: 'INVALID_TARGET' }))
  })

  it('requires the source contract and every frozen server id to agree', async () => {
    const cases: Array<keyof ActivationServerRecord> = [
      'authType',
      'passChatbotId',
      'chatbotIdHeader',
      'isActive',
      'authSecret',
    ]
    for (const field of cases) {
      const candidate = new MemoryStore(manifest)
      if (field === 'authType') candidate.sourceServer.authType = 'scope_token'
      if (field === 'passChatbotId')
        candidate.sourceServer.passChatbotId = false
      if (field === 'chatbotIdHeader')
        candidate.sourceServer.chatbotIdHeader = 'X-Chatbot'
      if (field === 'isActive') candidate.sourceServer.isActive = false
      if (field === 'authSecret') candidate.sourceServer.authSecret = ' '
      await expect(
        dryRunCohortActivation(
          candidate,
          manifest,
          TARGET,
          fingerprintManifest(manifest)
        )
      ).rejects.toThrowError(
        expect.objectContaining({ code: 'SOURCE_SERVER_MISMATCH' })
      )
    }

    const mismatchedManifest = clone(manifest)
    for (const corpus of mismatchedManifest.corpora) {
      for (const configuration of corpus.configurations) {
        configuration.sourceServerId = uuid(9999)
      }
    }
    for (const configuration of mismatchedManifest.excluded) {
      configuration.serverId = uuid(9999)
    }
    await expect(
      dryRunCohortActivation(
        new MemoryStore(mismatchedManifest),
        mismatchedManifest,
        TARGET,
        fingerprintManifest(mismatchedManifest)
      )
    ).rejects.toThrowError(
      expect.objectContaining({ code: 'SOURCE_SERVER_MISMATCH' })
    )
  })

  it('requires every listed course and excluded source row to exist with its frozen shape', async () => {
    store.courses.delete(manifest.corpora[0]!.courseIds[0]!)
    await expect(
      dryRunCohortActivation(
        store,
        manifest,
        TARGET,
        fingerprintManifest(manifest)
      )
    ).rejects.toThrowError(expect.objectContaining({ code: 'COURSE_MISSING' }))

    store = new MemoryStore(manifest)
    store.courses.get(manifest.corpora[0]!.courseIds[0]!)!.ownerId = uuid(9900)
    await expect(
      dryRunCohortActivation(
        store,
        manifest,
        TARGET,
        fingerprintManifest(manifest)
      )
    ).rejects.toThrowError(expect.objectContaining({ code: 'COURSE_DRIFT' }))

    store = new MemoryStore(manifest)
    const sharedCorpus = manifest.corpora[12]!
    const firstChatbot = store.chatbots.get(sharedCorpus.chatbotIds[0]!)!
    const secondChatbot = store.chatbots.get(sharedCorpus.chatbotIds[1]!)!
    secondChatbot.courseId = firstChatbot.courseId
    await expect(
      dryRunCohortActivation(
        store,
        manifest,
        TARGET,
        fingerprintManifest(manifest)
      )
    ).rejects.toThrowError(
      expect.objectContaining({ code: 'COURSE_REFERENCE_MISSING' })
    )

    store = new MemoryStore(manifest)
    store.sourceConfigs.delete(manifest.excluded[0]!.configId)
    await expect(
      dryRunCohortActivation(
        store,
        manifest,
        TARGET,
        fingerprintManifest(manifest)
      )
    ).rejects.toThrowError(
      expect.objectContaining({ code: 'EXCLUDED_CONFIG_DRIFT' })
    )

    store = new MemoryStore(manifest)
    const excluded = store.sourceConfigs.get(manifest.excluded[0]!.configId)!
    excluded.allowedTools = ['unexpected_tool']
    await expect(
      dryRunCohortActivation(
        store,
        manifest,
        TARGET,
        fingerprintManifest(manifest)
      )
    ).rejects.toThrowError(
      expect.objectContaining({ code: 'EXCLUDED_CONFIG_DRIFT' })
    )
  })

  it('dry-runs without invoking writes or a transaction', async () => {
    const result = await dryRunCohortActivation(
      store,
      manifest,
      TARGET,
      fingerprintManifest(manifest)
    )
    expect(result.status).toBe('dry-run')
    expect(result.writes).toEqual({
      knowledgeBases: 15,
      server: 1,
      bindings: 22,
      configurations: 48,
    })
    expect(store.writes).toBe(0)
    expect(store.transactions).toBe(0)
    expect(JSON.stringify(result)).not.toContain(SOURCE_CREDENTIAL)
  })

  it('requires the approved manifest fingerprint at every operation boundary', async () => {
    await expect(
      dryRunCohortActivation(store, manifest, TARGET, undefined as never)
    ).rejects.toThrowError(
      expect.objectContaining({ code: 'MANIFEST_FINGERPRINT_REQUIRED' })
    )
    await expect(
      prepareCohortActivation(store, manifest, {
        receiptStore,
        target: TARGET,
        expectedManifestFingerprint: '0'.repeat(64),
      })
    ).rejects.toThrowError(expect.objectContaining({ code: 'MANIFEST_DRIFT' }))
  })

  it('prepares idempotently with disabled scoped target rows and an opaque credential copy', async () => {
    const first = await prepareCohortActivation(
      store,
      manifest,
      options(receiptStore, manifest)
    )
    expect(first.status).toBe('prepared')
    expect(first.writes).toEqual({
      knowledgeBases: 15,
      server: 1,
      bindings: 22,
      configurations: 48,
    })
    const targetServer = store.targetServer()!
    expect(targetServer.authSecret).toBe(SOURCE_CREDENTIAL)
    expect(targetServer.authType).toBe('scope_token')
    expect(targetServer.passChatbotId).toBe(false)
    expect(targetServer.chatbotIdHeader).toBeNull()
    expect(targetServer.parameters).toEqual({})
    expect([...store.targetConfigs.values()]).toHaveLength(48)
    expect(
      [...store.targetConfigs.values()].every(
        (config) =>
          config.isEnabled === false &&
          JSON.stringify(config.allowedTools) ===
            JSON.stringify(['doc_query']) &&
          JSON.stringify(config.parameters) ===
            JSON.stringify({ required: true, toolAlias: 'doc_query' })
      )
    ).toBe(true)
    const second = await prepareCohortActivation(
      store,
      manifest,
      options(receiptStore, manifest)
    )
    expect(second.writes).toEqual({
      knowledgeBases: 0,
      server: 0,
      bindings: 0,
      configurations: 0,
    })
    expect(store.legacyUpdates).toBe(0)
    expect(JSON.stringify(first.receipt)).not.toContain(SOURCE_CREDENTIAL)
  })

  it('refuses target drift instead of reconciling an existing reserved server', async () => {
    await prepareCohortActivation(
      store,
      manifest,
      options(receiptStore, manifest)
    )
    const targetServer = store.targetServer()!
    targetServer.authType = 'bearer'
    const writesBefore = store.writes
    await expect(
      prepareCohortActivation(store, manifest, options(receiptStore, manifest))
    ).rejects.toThrowError(
      expect.objectContaining({ code: 'TARGET_SERVER_MISMATCH' })
    )
    expect(store.writes).toBe(writesBefore)
  })

  it('switches one chatbot atomically, preserves legacy rows, and rolls back exactly', async () => {
    await prepareCohortActivation(
      store,
      manifest,
      options(receiptStore, manifest)
    )
    const firstAlias = 'chatbot-001'
    const secondAlias = 'chatbot-002'
    const firstId = chatbotIdForAlias(manifest, firstAlias)
    const secondId = chatbotIdForAlias(manifest, secondAlias)
    const legacyBefore = [...store.sourceConfigs.values()].map((config) => ({
      ...config,
      updatedAt: new Date(config.updatedAt),
    }))

    const switched = await switchCohortChatbot(store, manifest, {
      ...options(receiptStore, manifest),
      chatbotAlias: firstAlias,
    })
    expect(switched.status).toBe('switched')
    expect(store.bindingForChatbot(firstId)!.isEnabled).toBe(true)
    expect(
      store.targetConfigForChatbot(firstId).every((config) => config.isEnabled)
    ).toBe(true)
    expect(store.bindingForChatbot(secondId)!.isEnabled).toBe(false)

    store.failTargetConfigUpdate = true
    await expect(
      switchCohortChatbot(store, manifest, {
        ...options(receiptStore, manifest),
        chatbotAlias: secondAlias,
      })
    ).rejects.toThrowError(expect.objectContaining({ code: 'CONCURRENT_EDIT' }))
    expect(store.bindingForChatbot(secondId)!.isEnabled).toBe(false)
    expect(receiptStore.value).toEqual(
      expect.objectContaining({ state: 'switching' })
    )

    const afterFailedSwitch = await rollbackCohortChatbot(store, manifest, {
      ...options(receiptStore, manifest),
      chatbotAlias: secondAlias,
    })
    expect(afterFailedSwitch.status).toBe('switched')
    expect(store.bindingForChatbot(firstId)!.isEnabled).toBe(true)
    expect(store.bindingForChatbot(secondId)!.isEnabled).toBe(false)

    const rolledBack = await rollbackCohortChatbot(store, manifest, {
      ...options(receiptStore, manifest),
      chatbotAlias: firstAlias,
    })
    expect(rolledBack.status).toBe('rolled_back')
    expect(
      [...store.bindings.values()].every((binding) => !binding.isEnabled)
    ).toBe(true)
    expect([...store.sourceConfigs.values()]).toEqual(legacyBefore)
    expect(store.legacyUpdates).toBe(0)
  })

  it('validates switch and rollback dry-runs without writing state or receipts', async () => {
    await prepareCohortActivation(
      store,
      manifest,
      options(receiptStore, manifest)
    )
    const writesBefore = store.writes
    const transactionsBefore = store.transactions
    const receiptsBefore = receiptStore.writes
    const switchDryRun = await switchCohortChatbot(store, manifest, {
      ...options(receiptStore, manifest),
      chatbotAlias: 'chatbot-001',
      dryRun: true,
    })
    expect(switchDryRun.status).toBe('dry-run')
    expect(store.writes).toBe(writesBefore)
    expect(store.transactions).toBe(transactionsBefore)
    expect(receiptStore.writes).toBe(receiptsBefore)

    await switchCohortChatbot(store, manifest, {
      ...options(receiptStore, manifest),
      chatbotAlias: 'chatbot-001',
    })
    const switchedWrites = store.writes
    const switchedTransactions = store.transactions
    const switchedReceipts = receiptStore.writes
    const rollbackDryRun = await rollbackCohortChatbot(store, manifest, {
      ...options(receiptStore, manifest),
      chatbotAlias: 'chatbot-001',
      dryRun: true,
    })
    expect(rollbackDryRun.status).toBe('dry-run')
    expect(store.writes).toBe(switchedWrites)
    expect(store.transactions).toBe(switchedTransactions)
    expect(receiptStore.writes).toBe(switchedReceipts)
  })

  it('rejects concurrent switch and rollback under one receipt guard', async () => {
    await prepareCohortActivation(
      store,
      manifest,
      options(receiptStore, manifest)
    )
    receiptStore.blockNextExclusive()
    const switching = switchCohortChatbot(store, manifest, {
      ...options(receiptStore, manifest),
      chatbotAlias: 'chatbot-001',
    })
    await receiptStore.waitForExclusive()
    await expect(
      rollbackCohortChatbot(store, manifest, {
        ...options(receiptStore, manifest),
        chatbotAlias: 'chatbot-001',
      })
    ).rejects.toThrowError(expect.objectContaining({ code: 'RECEIPT_LOCKED' }))
    receiptStore.releaseExclusive()
    await expect(switching).resolves.toMatchObject({ status: 'switched' })
    expect(receiptStore.value?.state).toBe('switched')
  })

  it('refuses a mixed target group and keeps the durable receipt unchanged', async () => {
    await prepareCohortActivation(
      store,
      manifest,
      options(receiptStore, manifest)
    )
    const firstId = chatbotIdForAlias(manifest, 'chatbot-001')
    const config = store.targetConfigForChatbot(firstId)[0]!
    config.isEnabled = true
    const receiptBefore = clone(receiptStore.value)
    await expect(
      switchCohortChatbot(store, manifest, {
        ...options(receiptStore, manifest),
        chatbotAlias: 'chatbot-001',
      })
    ).rejects.toThrowError(
      expect.objectContaining({ code: 'SNAPSHOT_MISMATCH' })
    )
    expect(receiptStore.value).toEqual(receiptBefore)
  })

  it('rejects semantically inconsistent receipts with otherwise valid digests', async () => {
    await prepareCohortActivation(
      store,
      manifest,
      options(receiptStore, manifest)
    )
    const baseline = clone(receiptStore.value!) as ActivationReceipt

    const wrongSwitchedAlias = clone(baseline)
    wrongSwitchedAlias.switchedChatbotAliases = ['chatbot-999']
    wrongSwitchedAlias.payloadDigest = receiptDigest(wrongSwitchedAlias)
    receiptStore.value = wrongSwitchedAlias
    await expect(
      switchCohortChatbot(store, manifest, {
        ...options(receiptStore, manifest),
        chatbotAlias: 'chatbot-001',
      })
    ).rejects.toThrowError(
      expect.objectContaining({ code: 'RECEIPT_MISMATCH' })
    )

    const enabledMismatch = clone(baseline)
    enabledMismatch.bindings[0]!.isEnabled = true
    enabledMismatch.payloadDigest = receiptDigest(enabledMismatch)
    receiptStore.value = enabledMismatch
    await expect(
      switchCohortChatbot(store, manifest, {
        ...options(receiptStore, manifest),
        chatbotAlias: 'chatbot-001',
      })
    ).rejects.toThrowError(expect.objectContaining({ code: 'RECEIPT_STATE' }))

    const invalidPending = clone(baseline)
    invalidPending.pendingChatbotAlias = 'chatbot-001'
    invalidPending.payloadDigest = receiptDigest(invalidPending)
    receiptStore.value = invalidPending
    await expect(
      switchCohortChatbot(store, manifest, {
        ...options(receiptStore, manifest),
        chatbotAlias: 'chatbot-001',
      })
    ).rejects.toThrowError(expect.objectContaining({ code: 'RECEIPT_STATE' }))

    receiptStore.value = baseline
    await switchCohortChatbot(store, manifest, {
      ...options(receiptStore, manifest),
      chatbotAlias: 'chatbot-001',
    })
    const switched = clone(receiptStore.value!) as ActivationReceipt
    const invalidRollback = clone(switched)
    invalidRollback.state = 'rolling_back'
    invalidRollback.pendingRollbackAliases = ['chatbot-002']
    invalidRollback.payloadDigest = receiptDigest(invalidRollback)
    receiptStore.value = invalidRollback
    await expect(
      rollbackCohortChatbot(store, manifest, {
        ...options(receiptStore, manifest),
        chatbotAlias: 'chatbot-001',
      })
    ).rejects.toThrowError(expect.objectContaining({ code: 'RECEIPT_STATE' }))
  })

  it('refuses enabled alternative bindings during switch and rollback validation', async () => {
    await prepareCohortActivation(
      store,
      manifest,
      options(receiptStore, manifest)
    )
    const chatbotId = chatbotIdForAlias(manifest, 'chatbot-001')
    const switchAlternative = await store.createBinding({
      kbId: uuid(8800),
      chatbotId,
      isEnabled: false,
    })
    store.bindings.get(switchAlternative.id)!.isEnabled = true
    await expect(
      switchCohortChatbot(store, manifest, {
        ...options(receiptStore, manifest),
        chatbotAlias: 'chatbot-001',
      })
    ).rejects.toThrowError(
      expect.objectContaining({ code: 'ENABLED_KB_CONFLICT' })
    )

    const cleanStore = new MemoryStore(manifest)
    const cleanReceipts = new MemoryReceiptStore()
    await prepareCohortActivation(
      cleanStore,
      manifest,
      options(cleanReceipts, manifest)
    )
    await switchCohortChatbot(cleanStore, manifest, {
      ...options(cleanReceipts, manifest),
      chatbotAlias: 'chatbot-001',
    })
    const rollbackAlternative = await cleanStore.createBinding({
      kbId: uuid(8801),
      chatbotId: chatbotIdForAlias(manifest, 'chatbot-001'),
      isEnabled: false,
    })
    cleanStore.bindings.get(rollbackAlternative.id)!.isEnabled = true
    await expect(
      rollbackCohortChatbot(cleanStore, manifest, {
        ...options(cleanReceipts, manifest),
        chatbotAlias: 'chatbot-001',
      })
    ).rejects.toThrowError(
      expect.objectContaining({ code: 'ENABLED_KB_CONFLICT' })
    )
  })

  it('refuses an untracked partial target inventory', async () => {
    const targetServer = await store.createServer({
      name: 'KB',
      description: TARGET.description,
      url: TARGET.url,
      authType: 'scope_token',
      authSecret: SOURCE_CREDENTIAL,
      passChatbotId: false,
      chatbotIdHeader: null,
      parameters: {},
      isActive: true,
    })
    const firstCorpus = manifest.corpora[0]!
    await store.createConfig({
      chatbotId: firstCorpus.chatbotIds[0]!,
      mcpServerId: targetServer.id,
      chatMode: 'tutor',
      allowedTools: ['doc_query'],
      priority: 0,
      isEnabled: false,
      parameters: { required: true, toolAlias: 'doc_query' },
    })
    await expect(
      prepareCohortActivation(store, manifest, options(receiptStore, manifest))
    ).rejects.toThrowError(expect.objectContaining({ code: 'MIXED_STATE' }))
  })

  it('readback is receipt-bound and rejects an in-flight state', async () => {
    await prepareCohortActivation(
      store,
      manifest,
      options(receiptStore, manifest)
    )
    const result = await readbackCohortActivation(
      store,
      manifest,
      options(receiptStore, manifest)
    )
    expect(result.status).toBe('readback')
    expect(result.fingerprints.receipt).toBe(
      fingerprintManifest(manifest) === result.fingerprints.manifest
        ? receiptStore.value?.payloadDigest
        : undefined
    )
  })

  it('writes a private atomic receipt without credential or raw row identifiers', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'cohort-activation-'))
    const path = join(directory, 'receipt.json')
    const fileStore = createFileActivationReceiptStore(path)
    await prepareCohortActivation(store, manifest, options(fileStore, manifest))
    const receipt = await fileStore.read()
    expect(receipt).not.toBeNull()
    const contents = readFileSync(path, 'utf8')
    expect(statSync(path).mode & 0o777).toBe(0o600)
    expect(contents).not.toContain(SOURCE_CREDENTIAL)
    expect(contents).not.toContain(SOURCE_SERVER_ID)
    expect(await fileStore.read()).toEqual(receipt)
  })

  it('reclaims only a dead same-host lock owner for in-flight recovery', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'cohort-activation-stale-'))
    const path = join(directory, 'receipt.json')
    writeLockOwner(`${path}.lock`, deadPid())
    const fileStore = createFileActivationReceiptStore(path)
    const result = await prepareCohortActivation(
      store,
      manifest,
      options(fileStore, manifest)
    )
    expect(result.status).toBe('prepared')
    expect(() => statSync(`${path}.lock`)).toThrow()
  })

  it('refuses live and unknown receipt lock owners without expiry', async () => {
    const sourceDirectory = mkdtempSync(
      join(tmpdir(), 'cohort-activation-lock-source-')
    )
    const sourcePath = join(sourceDirectory, 'receipt.json')
    const sourceStore = createFileActivationReceiptStore(sourcePath)
    await prepareCohortActivation(
      store,
      manifest,
      options(sourceStore, manifest)
    )
    const receipt = await sourceStore.read()
    for (const [index, owner] of [
      { host: hostname(), pid: process.pid },
      { host: 'unknown-host', pid: deadPid() },
    ].entries()) {
      const directory = mkdtempSync(
        join(tmpdir(), `cohort-activation-locked-${index}-`)
      )
      const path = join(directory, 'receipt.json')
      writeLockOwner(`${path}.lock`, owner.pid, owner.host)
      const fileStore = createFileActivationReceiptStore(path)
      await expect(
        fileStore.compareAndSwap(null, receipt!)
      ).rejects.toThrowError(
        expect.objectContaining({ code: 'RECEIPT_LOCKED' })
      )
      expect(statSync(`${path}.lock`).isFile()).toBe(true)
      rmSync(`${path}.lock`, { force: true })
    }
  })

  it('preserves the primary failure when lock cleanup also fails', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'cohort-activation-cleanup-'))
    const path = join(directory, 'receipt.json')
    const fileStore = createFileActivationReceiptStore(path)
    const primary = new Error('synthetic operation failure')
    const failure = await fileStore
      .runExclusive(async () => {
        rmSync(`${path}.lock`, { force: true })
        throw primary
      })
      .catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors).toContain(primary)
    expect(
      (failure as AggregateError).errors.some(
        (error) =>
          error instanceof CohortActivationError &&
          error.code === 'RECEIPT_LOCK_CLEANUP_FAILED'
      )
    ).toBe(true)
  })

  it('does not let concurrent prepare calls overwrite receipt recovery evidence', async () => {
    const directory = mkdtempSync(
      join(tmpdir(), 'cohort-activation-concurrent-')
    )
    const fileStore = createFileActivationReceiptStore(
      join(directory, 'receipt.json')
    )
    const concurrentStore = new ConcurrentReceiptStore(fileStore)
    const outcomes = await Promise.allSettled([
      prepareCohortActivation(store, manifest, {
        ...options(concurrentStore, manifest),
      }),
      prepareCohortActivation(store, manifest, {
        ...options(concurrentStore, manifest),
      }),
    ])
    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled')
    ).toHaveLength(1)
    expect(
      outcomes.filter((outcome) => outcome.status === 'rejected')
    ).toHaveLength(1)
    expect(['RECEIPT_LOCKED', 'RECEIPT_CAS_FAILED']).toContain(
      outcomes.find((outcome) => outcome.status === 'rejected')?.reason.code
    )
    expect(store.writes).toBe(15 + 1 + 22 + 48)
    expect(store.transactions).toBe(1)
    expect(store.knowledgeBases).toHaveLength(15)
    expect(store.targetServer()).not.toBeNull()
    expect(store.bindings).toHaveLength(22)
    expect(store.targetConfigs).toHaveLength(48)
    expect((await fileStore.read())?.state).toBe('prepared')
  })

  it('rejects a stale prepare intent without overwriting the winner', async () => {
    await prepareCohortActivation(
      store,
      manifest,
      options(receiptStore, manifest)
    )
    const prepared = receiptStore.value!
    const intentWithoutDigest = {
      receiptVersion: prepared.receiptVersion,
      manifestFingerprint: prepared.manifestFingerprint,
      counts: prepared.counts,
      aliases: prepared.aliases,
      state: 'preparing' as const,
    }
    receiptStore.value = {
      ...intentWithoutDigest,
      payloadDigest: receiptDigest(intentWithoutDigest),
    }

    const outcomes = await Promise.allSettled([
      prepareCohortActivation(store, manifest, options(receiptStore, manifest)),
      prepareCohortActivation(store, manifest, options(receiptStore, manifest)),
    ])
    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled')
    ).toHaveLength(1)
    expect(
      outcomes.filter((outcome) => outcome.status === 'rejected')
    ).toHaveLength(1)
    expect(
      outcomes.find((outcome) => outcome.status === 'rejected')?.reason
    ).toMatchObject({
      code: expect.stringMatching(/RECEIPT_(CAS_FAILED|LOCKED)/),
    })
    expect(receiptStore.value?.state).toBe('prepared')
  })

  it('leaves a durable in-flight receipt readable for rollback recovery', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'cohort-activation-inflight-'))
    const path = join(directory, 'receipt.json')
    const fileStore = createFileActivationReceiptStore(path)
    await prepareCohortActivation(store, manifest, options(fileStore, manifest))
    await switchCohortChatbot(store, manifest, {
      ...options(fileStore, manifest),
      chatbotAlias: 'chatbot-001',
    })
    store.failTargetConfigUpdate = true
    await expect(
      switchCohortChatbot(store, manifest, {
        ...options(fileStore, manifest),
        chatbotAlias: 'chatbot-002',
      })
    ).rejects.toThrowError(expect.objectContaining({ code: 'CONCURRENT_EDIT' }))
    expect((await fileStore.read())?.state).toBe('switching')
    store.failNextTransaction = true
    await expect(
      rollbackCohortChatbot(store, manifest, {
        ...options(fileStore, manifest),
        chatbotAlias: 'chatbot-002',
      })
    ).rejects.toThrowError('synthetic transaction failure')
    expect(await fileStore.read()).toMatchObject({
      state: 'rolling_back',
      switchedChatbotAliases: ['chatbot-001'],
      pendingRollbackAliases: ['chatbot-002'],
      pendingRollbackOrigin: 'switching',
    })
    await expect(
      rollbackCohortChatbot(store, manifest, {
        ...options(fileStore, manifest),
        chatbotAlias: 'chatbot-002',
      })
    ).resolves.toMatchObject({
      status: 'switched',
      aliases: { switchedChatbotAliases: ['chatbot-001'] },
    })
    expect(
      store.bindingForChatbot(chatbotIdForAlias(manifest, 'chatbot-001'))
        ?.isEnabled
    ).toBe(true)
    expect(
      store.bindingForChatbot(chatbotIdForAlias(manifest, 'chatbot-002'))
        ?.isEnabled
    ).toBe(false)
    await expect(
      rollbackCohortChatbot(store, manifest, {
        ...options(fileStore, manifest),
        chatbotAlias: 'chatbot-001',
      })
    ).resolves.toMatchObject({ status: 'rolled_back' })
  })

  it('normalizes legacy receipts and refuses ambiguous rollback origin', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'cohort-activation-legacy-'))
    const path = join(directory, 'receipt.json')
    const fileStore = createFileActivationReceiptStore(path)
    await prepareCohortActivation(store, manifest, options(fileStore, manifest))
    const prepared = (await fileStore.read()) as ActivationReceipt

    const legacyPrepared = legacyReceipt(prepared)
    writeFileSync(path, `${JSON.stringify(legacyPrepared)}\n`)
    await expect(fileStore.read()).resolves.toMatchObject({
      receiptVersion: 2,
      state: 'prepared',
      pendingRollbackOrigin: null,
    })
    writeFileSync(
      path,
      `${JSON.stringify({ ...legacyPrepared, payloadDigest: '0'.repeat(64) })}\n`
    )
    await expect(fileStore.read()).rejects.toThrowError(
      expect.objectContaining({ code: 'RECEIPT_INVALID' })
    )

    const legacySwitching = legacyReceipt(prepared, {
      state: 'switching',
      pendingChatbotAlias: 'chatbot-001',
    })
    writeFileSync(path, `${JSON.stringify(legacySwitching)}\n`)
    await expect(fileStore.read()).resolves.toMatchObject({
      receiptVersion: 2,
      state: 'switching',
      pendingRollbackOrigin: null,
    })

    writeFileSync(path, `${JSON.stringify(legacyPrepared)}\n`)
    await switchCohortChatbot(store, manifest, {
      ...options(fileStore, manifest),
      chatbotAlias: 'chatbot-001',
    })
    const switched = (await fileStore.read()) as ActivationReceipt
    const legacySwitched = legacyReceipt(switched)
    writeFileSync(path, `${JSON.stringify(legacySwitched)}\n`)
    await expect(fileStore.read()).resolves.toMatchObject({
      receiptVersion: 2,
      state: 'switched',
      pendingRollbackOrigin: null,
    })
    await rollbackCohortChatbot(store, manifest, {
      ...options(fileStore, manifest),
      chatbotAlias: 'chatbot-001',
    })
    const rolledBack = (await fileStore.read()) as ActivationReceipt
    const legacyRolledBack = legacyReceipt(rolledBack)
    writeFileSync(path, `${JSON.stringify(legacyRolledBack)}\n`)
    await expect(fileStore.read()).resolves.toMatchObject({
      receiptVersion: 2,
      state: 'rolled_back',
      pendingRollbackOrigin: null,
    })

    const legacySwitchedRollback = legacyReceipt(switched, {
      state: 'rolling_back',
      pendingChatbotAlias: null,
      pendingRollbackAliases: ['chatbot-001'],
      switchedChatbotAliases: ['chatbot-001'],
    })
    writeFileSync(path, `${JSON.stringify(legacySwitchedRollback)}\n`)
    await expect(fileStore.read()).resolves.toMatchObject({
      receiptVersion: 2,
      state: 'rolling_back',
      pendingRollbackOrigin: 'switched',
    })

    const unambiguousRollback = legacyReceipt(rolledBack, {
      state: 'rolling_back',
      pendingChatbotAlias: null,
      pendingRollbackAliases: ['chatbot-001'],
      switchedChatbotAliases: [],
    })
    writeFileSync(path, `${JSON.stringify(unambiguousRollback)}\n`)
    await expect(fileStore.read()).resolves.toMatchObject({
      receiptVersion: 2,
      state: 'rolling_back',
      pendingRollbackOrigin: 'switching',
    })

    const ambiguousRollback = legacyReceipt(rolledBack, {
      state: 'rolling_back',
      pendingChatbotAlias: null,
      pendingRollbackAliases: [],
      switchedChatbotAliases: [],
    })
    writeFileSync(path, `${JSON.stringify(ambiguousRollback)}\n`)
    await expect(fileStore.read()).rejects.toThrowError(
      expect.objectContaining({ code: 'RECEIPT_STATE' })
    )
  })

  it('serializes receipt updates, rejects stale digests, and refuses tampered shape', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'cohort-activation-cas-'))
    const path = join(directory, 'receipt.json')
    const fileStore = createFileActivationReceiptStore(path)
    await prepareCohortActivation(store, manifest, options(fileStore, manifest))
    const prepared = await fileStore.read()
    expect(prepared).not.toBeNull()

    writeFileSync(`${path}.lock`, '')
    await expect(
      fileStore.compareAndSwap(prepared!.payloadDigest, prepared!)
    ).rejects.toThrowError(expect.objectContaining({ code: 'RECEIPT_LOCKED' }))
    rmSync(`${path}.lock`)
    expect(await fileStore.read()).toEqual(prepared)

    await expect(
      fileStore.compareAndSwap('0'.repeat(64), prepared!)
    ).rejects.toThrowError(
      expect.objectContaining({ code: 'RECEIPT_CAS_FAILED' })
    )
    expect(await fileStore.read()).toEqual(prepared)

    const tampered = JSON.parse(readFileSync(path, 'utf8')) as {
      aliases: Record<string, unknown>
    }
    delete tampered.aliases.courses
    writeFileSync(path, `${JSON.stringify(tampered)}\n`)
    await expect(fileStore.read()).rejects.toThrowError(
      expect.objectContaining({ code: 'RECEIPT_INVALID' })
    )
  })
})
