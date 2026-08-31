import { describe, expect, it } from 'vitest'
import {
  assertReceiptMatchesManifest,
  DOC_QUERY_ROUTE_PATH,
  DOC_QUERY_TARGET_DESCRIPTION,
  DOC_QUERY_TARGET_SCOPE,
  DOC_QUERY_TARGET_SERVER_NAME,
  DOC_QUERY_TARGET_URL,
  type CohortActivationConfigRecord,
  type CohortActivationConfigUpdate,
  type CohortActivationManifest,
  type CohortActivationServerCreate,
  type CohortActivationServerRecord,
  type CohortActivationStore,
  type CohortActivationTransactionStore,
  dryRunCohortActivation,
  fingerprintManifest,
  makeCohortActivationReceiptIntent,
  prepareCohortActivation,
  recoverPreparedCohortActivation,
  readCohortActivationState,
  rollbackCohortActivation,
  switchCohortActivation,
  validatePinnedManifest,
  validateReceipt,
} from './doc-query-cohort-activation.js'

const sourceServer: CohortActivationServerRecord = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Source course server',
  description: 'Source course server for synthetic tests',
  url: 'http://source.example.invalid/mcp',
  authType: 'bearer',
  passChatbotId: true,
  chatbotIdHeader: 'Chatbot-ID',
  parameters: {},
  hasAuthSecret: true,
  isActive: true,
  updatedAt: new Date('2026-08-24T10:00:00.000Z'),
}

const sourceConfig: CohortActivationConfigRecord = {
  id: '00000000-0000-4000-8000-000000000002',
  chatbotId: '00000000-0000-4000-8000-000000000003',
  mcpServerId: sourceServer.id,
  chatMode: 'tutor',
  allowedTools: ['doc_query'],
  priority: 4,
  isEnabled: true,
  parameters: {},
  updatedAt: new Date('2026-08-24T10:00:00.000Z'),
}

const secondModeConfig: CohortActivationConfigRecord = {
  ...sourceConfig,
  id: '00000000-0000-4000-8000-000000000004',
  chatMode: 'review',
}

const secondChatbotConfig: CohortActivationConfigRecord = {
  ...sourceConfig,
  id: '00000000-0000-4000-8000-000000000005',
  chatbotId: '00000000-0000-4000-8000-000000000006',
}

function makeManifest(
  configs: CohortActivationConfigRecord[] = [sourceConfig]
): CohortActivationManifest {
  const unsigned = {
    target: {
      serverName: DOC_QUERY_TARGET_SERVER_NAME,
      routePath: DOC_QUERY_ROUTE_PATH,
      scope: DOC_QUERY_TARGET_SCOPE,
      url: DOC_QUERY_TARGET_URL,
    },
    entries: configs.map((config) => ({
      configId: config.id,
      chatbotId: config.chatbotId,
      chatMode: config.chatMode,
      sourceServerId: sourceServer.id,
      targetTool: 'doc_query' as const,
      kbId:
        config.chatbotId === sourceConfig.chatbotId
          ? '00000000-0000-4000-8000-000000000020'
          : '00000000-0000-4000-8000-000000000021',
      corpusIdentity:
        config.chatbotId === sourceConfig.chatbotId
          ? 'synthetic-corpus-a'
          : 'synthetic-corpus-b',
      corpusOwner: 'synthetic-owner',
    })),
    heldConfigIds: [],
    excludedCorpora: ['BF1', 'DF CF2', 'Vorkurs2'],
    excludedConfigIds: [],
  }
  return { ...unsigned, fingerprint: fingerprintManifest(unsigned) }
}

function cloneConfig(
  config: CohortActivationConfigRecord
): CohortActivationConfigRecord {
  return {
    ...config,
    allowedTools: structuredClone(config.allowedTools),
    parameters: structuredClone(config.parameters),
    updatedAt: new Date(config.updatedAt),
  }
}

function cloneServer(
  server: CohortActivationServerRecord
): CohortActivationServerRecord {
  return {
    ...server,
    parameters: structuredClone(server.parameters),
    updatedAt: new Date(server.updatedAt),
  }
}

function fakeStore(
  initialConfigs:
    | CohortActivationConfigRecord[]
    | CohortActivationConfigRecord = [sourceConfig],
  initialTarget?: CohortActivationServerRecord
): {
  store: CohortActivationStore
  currentConfig: (id: string) => CohortActivationConfigRecord | undefined
  currentTarget: () => CohortActivationServerRecord | undefined
  writes: () => number
  transactions: () => number
  targetConfigCount: () => number
  replaceConfig: (config: CohortActivationConfigRecord) => void
  replaceSourceServer: (server: CohortActivationServerRecord) => void
  failNextTargetUpdate: () => void
} {
  let servers = new Map<string, CohortActivationServerRecord>([
    [sourceServer.id, cloneServer(sourceServer)],
  ])
  if (initialTarget) servers.set(initialTarget.id, cloneServer(initialTarget))
  const configsToSeed = Array.isArray(initialConfigs)
    ? initialConfigs
    : [initialConfigs]
  let configs = new Map<string, CohortActivationConfigRecord>(
    configsToSeed.map((config) => [config.id, cloneConfig(config)])
  )
  let writes = 0
  let transactions = 0
  let failTargetUpdate = false
  const makeTransaction = (
    workingServers: Map<string, CohortActivationServerRecord>,
    workingConfigs: Map<string, CohortActivationConfigRecord>
  ): CohortActivationTransactionStore => ({
    async findServerByName(name) {
      const found = [...workingServers.values()].find(
        (server) => server.name === name
      )
      return found ? cloneServer(found) : null
    },
    async findServerById(id) {
      const found = workingServers.get(id)
      return found ? cloneServer(found) : null
    },
    async findConfigById(id) {
      const found = workingConfigs.get(id)
      return found ? cloneConfig(found) : null
    },
    async findConfigByChatbotServer(chatbotId, mcpServerId, chatMode) {
      const found = [...workingConfigs.values()].find(
        (config) =>
          config.chatbotId === chatbotId &&
          config.mcpServerId === mcpServerId &&
          config.chatMode === chatMode
      )
      return found ? cloneConfig(found) : null
    },
    async findConfigsByServerId(mcpServerId) {
      return [...workingConfigs.values()]
        .filter((config) => config.mcpServerId === mcpServerId)
        .map(cloneConfig)
    },
    async createServer(data: CohortActivationServerCreate) {
      const id = data.id ?? '00000000-0000-4000-8000-000000000010'
      const created: CohortActivationServerRecord = {
        id,
        name: data.name,
        description: data.description,
        url: data.url,
        authType: data.authType,
        passChatbotId: data.passChatbotId,
        chatbotIdHeader: data.chatbotIdHeader,
        parameters: structuredClone(data.parameters),
        hasAuthSecret: true,
        isActive: data.isActive,
        updatedAt: new Date('2026-08-24T10:00:00.001Z'),
      }
      workingServers.set(id, created)
      writes += 1
      return cloneServer(created)
    },
    async createConfig(data) {
      const id =
        data.id ??
        `00000000-0000-4000-8000-${String(workingConfigs.size + 10).padStart(12, '0')}`
      const created: CohortActivationConfigRecord = {
        id,
        ...data,
        allowedTools: structuredClone(data.allowedTools),
        parameters: structuredClone(data.parameters),
        updatedAt: new Date('2026-08-24T10:00:00.001Z'),
      }
      workingConfigs.set(id, created)
      writes += 1
      return cloneConfig(created)
    },
    async updateConfig(
      id,
      expectedUpdatedAt,
      data: CohortActivationConfigUpdate
    ) {
      if (failTargetUpdate && data.mcpServerId !== sourceServer.id) {
        failTargetUpdate = false
        return null
      }
      const current = workingConfigs.get(id)
      if (
        !current ||
        current.updatedAt.getTime() !== expectedUpdatedAt.getTime()
      ) {
        return null
      }
      const updated: CohortActivationConfigRecord = {
        ...current,
        ...data,
        allowedTools: structuredClone(data.allowedTools),
        parameters: structuredClone(data.parameters),
        updatedAt: new Date(current.updatedAt.getTime() + 1),
      }
      workingConfigs.set(id, updated)
      writes += 1
      return cloneConfig(updated)
    },
  })

  const store: CohortActivationStore = {
    async transaction(callback) {
      transactions += 1
      const workingServers = new Map(
        [...servers].map(([id, server]) => [id, cloneServer(server)])
      )
      const workingConfigs = new Map(
        [...configs].map(([id, config]) => [id, cloneConfig(config)])
      )
      const result = await callback(
        makeTransaction(workingServers, workingConfigs)
      )
      servers = workingServers
      configs = workingConfigs
      return result
    },
  }
  return {
    store,
    currentConfig: (id) => {
      const config = configs.get(id)
      return config ? cloneConfig(config) : undefined
    },
    currentTarget: () => {
      const target = [...servers.values()].find(
        (server) => server.name === DOC_QUERY_TARGET_SERVER_NAME
      )
      return target ? cloneServer(target) : undefined
    },
    writes: () => writes,
    transactions: () => transactions,
    targetConfigCount: () => {
      const targetId = [...servers.values()].find(
        (server) => server.name === DOC_QUERY_TARGET_SERVER_NAME
      )?.id
      return targetId
        ? [...configs.values()].filter(
            (config) => config.mcpServerId === targetId
          ).length
        : 0
    },
    replaceConfig: (config) => configs.set(config.id, cloneConfig(config)),
    replaceSourceServer: (server) =>
      servers.set(server.id, cloneServer(server)),
    failNextTargetUpdate: () => {
      failTargetUpdate = true
    },
  }
}

describe('cohort activation contract', () => {
  it('rejects a self-authenticated manifest that is not the reviewed PRD set', () => {
    expect(() => validatePinnedManifest(makeManifest())).toThrow(
      expect.objectContaining({ code: 'MANIFEST_NOT_PINNED' })
    )
  })

  it('refuses a receipt bound to a different manifest', async () => {
    const fake = fakeStore()
    const manifest = makeManifest()
    const prepared = await prepareCohortActivation(fake.store, manifest, {
      encryptedBearer: 'encrypted-synthetic-bearer',
    })
    expect(() =>
      assertReceiptMatchesManifest(
        prepared,
        makeManifest([sourceConfig, secondModeConfig])
      )
    ).toThrow(expect.objectContaining({ code: 'RECEIPT_MANIFEST_MISMATCH' }))
  })

  it('reconstructs a prepared receipt after the intent survives a write failure', async () => {
    const fake = fakeStore()
    const manifest = makeManifest()
    const intent = makeCohortActivationReceiptIntent(manifest)
    await prepareCohortActivation(fake.store, manifest, {
      encryptedBearer: 'encrypted-synthetic-bearer',
      intent,
    })
    const recovered = await recoverPreparedCohortActivation(
      fake.store,
      manifest,
      intent
    )
    expect(recovered.state).toBe('prepared')
    expect(recovered.entries).toHaveLength(1)
    expect(recovered.targetServer.id).toBeDefined()
    expect(recovered.entries[0]!.target.id).toBe(
      intent.targetConfigIds[sourceConfig.id]
    )
  })

  it('refuses recovery when prepare did not commit', async () => {
    const fake = fakeStore()
    const manifest = makeManifest()
    await expect(
      recoverPreparedCohortActivation(
        fake.store,
        manifest,
        makeCohortActivationReceiptIntent(manifest)
      )
    ).rejects.toMatchObject({ code: 'RECOVERY_NOT_PREPARED' })
  })

  it('refuses recovery when the target server UUID belongs to another intent', async () => {
    const fake = fakeStore()
    const manifest = makeManifest()
    const preparedIntent = makeCohortActivationReceiptIntent(manifest)
    await prepareCohortActivation(fake.store, manifest, {
      encryptedBearer: 'encrypted-synthetic-bearer',
      intent: preparedIntent,
    })
    await expect(
      recoverPreparedCohortActivation(
        fake.store,
        manifest,
        makeCohortActivationReceiptIntent(manifest)
      )
    ).rejects.toMatchObject({ code: 'RECOVERY_AMBIGUOUS' })
  })

  it('dry-runs without writes and reports target creation', async () => {
    const fake = fakeStore()
    const result = await dryRunCohortActivation(fake.store, makeManifest())
    expect(result).toMatchObject({
      status: 'dry-run',
      entryCount: 1,
      heldCount: 0,
      wouldCreateServer: true,
      wouldCreateConfigs: 1,
      wouldSwitch: 1,
      wouldPreserveSourceRows: true,
    })
    expect(fake.writes()).toBe(0)
    expect(fake.currentTarget()).toBeUndefined()
  })

  it('creates target rows, switches by CAS, and restores exact source content', async () => {
    const fake = fakeStore()
    const prepared = await prepareCohortActivation(fake.store, makeManifest(), {
      encryptedBearer: 'encrypted-synthetic-bearer',
    })
    expect(prepared.state).toBe('prepared')
    expect(fake.currentConfig(sourceConfig.id)).toMatchObject({
      ...sourceConfig,
      parameters: {},
    })
    expect(fake.targetConfigCount()).toBe(1)
    expect(fake.currentConfig(prepared.entries[0]!.target.id)).toMatchObject({
      allowedTools: ['doc_query'],
      parameters: {
        required: true,
        toolAlias: 'doc_query',
        kb_id: '00000000-0000-4000-8000-000000000020',
      },
    })

    const switched = await switchCohortActivation(fake.store, prepared)
    expect(fake.currentConfig(sourceConfig.id)?.isEnabled).toBe(false)
    expect(await readCohortActivationState(fake.store, switched)).toMatchObject(
      {
        state: 'switched',
        entryCount: 1,
        sourceEnabled: 0,
        sourceDisabled: 1,
        targetEnabled: 1,
        targetDisabled: 0,
      }
    )

    const rolledBack = await rollbackCohortActivation(fake.store, switched)
    expect(rolledBack.state).toBe('rolled_back')
    expect(fake.currentConfig(sourceConfig.id)).toMatchObject({
      id: sourceConfig.id,
      chatbotId: sourceConfig.chatbotId,
      mcpServerId: sourceConfig.mcpServerId,
      chatMode: sourceConfig.chatMode,
      allowedTools: sourceConfig.allowedTools,
      priority: sourceConfig.priority,
      isEnabled: true,
      parameters: sourceConfig.parameters,
    })
    expect(
      fake.currentConfig(sourceConfig.id)?.updatedAt.getTime()
    ).toBeGreaterThan(sourceConfig.updatedAt.getTime())
    expect(
      await readCohortActivationState(fake.store, rolledBack)
    ).toMatchObject({
      sourceEnabled: 1,
      sourceDisabled: 0,
      targetEnabled: 0,
      targetDisabled: 1,
    })
  })

  it('switches every mode for one chatbot in one transaction', async () => {
    const fake = fakeStore([sourceConfig, secondModeConfig])
    const prepared = await prepareCohortActivation(
      fake.store,
      makeManifest([sourceConfig, secondModeConfig]),
      { encryptedBearer: 'encrypted-synthetic-bearer' }
    )

    const switched = await switchCohortActivation(fake.store, prepared)

    expect(fake.transactions()).toBe(2)
    expect(fake.targetConfigCount()).toBe(2)
    expect(await readCohortActivationState(fake.store, switched)).toMatchObject(
      {
        state: 'switched',
        chatbotCount: 1,
        switchedChatbotCount: 1,
        sourceDisabled: 2,
        targetEnabled: 2,
      }
    )
  })

  it('refuses a mixed chatbot rollback before writing either mode', async () => {
    const fake = fakeStore([sourceConfig, secondModeConfig])
    const prepared = await prepareCohortActivation(
      fake.store,
      makeManifest([sourceConfig, secondModeConfig]),
      { encryptedBearer: 'encrypted-synthetic-bearer' }
    )
    const writesBeforeRollback = fake.writes()
    const source = fake.currentConfig(sourceConfig.id)!
    const target = fake.currentConfig(prepared.entries[0]!.target.id)!
    fake.replaceConfig({ ...source, isEnabled: false })
    fake.replaceConfig({ ...target, isEnabled: true })

    await expect(
      rollbackCohortActivation(fake.store, prepared)
    ).rejects.toMatchObject({ code: 'READBACK_STATE_MISMATCH' })
    expect(fake.writes()).toBe(writesBeforeRollback)
    expect(fake.currentConfig(sourceConfig.id)?.isEnabled).toBe(false)
    expect(fake.currentConfig(prepared.entries[0]!.target.id)?.isEnabled).toBe(
      true
    )
  })

  it('checkpoints chatbot groups and rolls back a stale partial receipt', async () => {
    const fake = fakeStore([sourceConfig, secondChatbotConfig])
    const prepared = await prepareCohortActivation(
      fake.store,
      makeManifest([sourceConfig, secondChatbotConfig]),
      { encryptedBearer: 'encrypted-synthetic-bearer' }
    )
    const checkpoints = [] as Awaited<
      ReturnType<typeof switchCohortActivation>
    >[]

    const switched = await switchCohortActivation(
      fake.store,
      prepared,
      async (checkpoint) => {
        checkpoints.push(checkpoint)
      }
    )
    const partial = checkpoints.find(
      (checkpoint) =>
        checkpoint.state === 'switching' &&
        checkpoint.switchedChatbotIds.length === 1
    )
    expect(partial).toBeDefined()
    expect(switched.state).toBe('switched')
    expect(fake.transactions()).toBe(3)

    const rolledBack = await rollbackCohortActivation(fake.store, partial!)
    expect(rolledBack.state).toBe('rolled_back')
    expect(
      await readCohortActivationState(fake.store, rolledBack)
    ).toMatchObject({
      state: 'rolled_back',
      chatbotCount: 2,
      switchedChatbotCount: 0,
      sourceEnabled: 2,
      targetDisabled: 2,
    })
  })

  it('refuses source drift before any switch write', async () => {
    const fake = fakeStore()
    const prepared = await prepareCohortActivation(fake.store, makeManifest(), {
      encryptedBearer: 'encrypted-synthetic-bearer',
    })
    fake.replaceConfig({ ...sourceConfig, priority: 9 })
    await expect(
      switchCohortActivation(fake.store, prepared)
    ).rejects.toMatchObject({
      code: 'SOURCE_DRIFT',
    })
    expect(fake.currentConfig(sourceConfig.id)?.priority).toBe(9)
  })

  it('refuses inactive and test-route source rows', async () => {
    const inactive = fakeStore()
    inactive.replaceSourceServer({ ...sourceServer, isActive: false })
    await expect(
      dryRunCohortActivation(inactive.store, makeManifest())
    ).rejects.toMatchObject({ code: 'SOURCE_SERVER_INACTIVE' })

    const testRoute = fakeStore()
    testRoute.replaceSourceServer({
      ...sourceServer,
      url: 'http://test.example.invalid/mcp/klicker',
    })
    await expect(
      dryRunCohortActivation(testRoute.store, makeManifest())
    ).rejects.toMatchObject({ code: 'SOURCE_IS_TARGET' })
  })

  it('refuses source parameters that could leak into a receipt', async () => {
    const fake = fakeStore()
    const unsafe = { ...sourceConfig, parameters: { source: true } }
    fake.replaceConfig(unsafe)
    await expect(
      prepareCohortActivation(fake.store, makeManifest(), {
        encryptedBearer: 'encrypted-synthetic-bearer',
      })
    ).rejects.toMatchObject({ code: 'SOURCE_SHAPE_UNSUPPORTED' })
    expect(fake.writes()).toBe(0)
  })

  it('requires complete source mode coverage for each chatbot', async () => {
    const fake = fakeStore([sourceConfig, secondModeConfig])
    await expect(
      dryRunCohortActivation(fake.store, makeManifest([sourceConfig]))
    ).rejects.toMatchObject({ code: 'PARTIAL_MODE_COVERAGE' })
    expect(fake.writes()).toBe(0)
  })

  it('refuses mixed source servers for one chatbot', async () => {
    const manifest = makeManifest([sourceConfig, secondModeConfig])
    const mixed = {
      ...manifest,
      entries: [
        manifest.entries[0]!,
        {
          ...manifest.entries[1]!,
          sourceServerId: '00000000-0000-4000-8000-000000000011',
        },
      ],
    }
    mixed.fingerprint = fingerprintManifest({
      target: mixed.target,
      entries: mixed.entries,
      heldConfigIds: mixed.heldConfigIds,
      excludedCorpora: mixed.excludedCorpora,
      excludedConfigIds: mixed.excludedConfigIds,
    })
    await expect(
      dryRunCohortActivation(
        fakeStore([sourceConfig, secondModeConfig]).store,
        mixed
      )
    ).rejects.toMatchObject({ code: 'MIXED_MODE_COVERAGE' })
  })

  it('refuses repeated knowledge-base ids with conflicting corpus ownership', async () => {
    const manifest = makeManifest([sourceConfig, secondChatbotConfig])
    const conflicted = {
      ...manifest,
      entries: [
        manifest.entries[0]!,
        { ...manifest.entries[1]!, kbId: manifest.entries[0]!.kbId },
      ],
    }
    conflicted.fingerprint = fingerprintManifest({
      target: conflicted.target,
      entries: conflicted.entries,
      heldConfigIds: conflicted.heldConfigIds,
      excludedCorpora: conflicted.excludedCorpora,
      excludedConfigIds: conflicted.excludedConfigIds,
    })
    await expect(
      dryRunCohortActivation(
        fakeStore([sourceConfig, secondChatbotConfig]).store,
        conflicted
      )
    ).rejects.toMatchObject({ code: 'KB_ID_OWNERSHIP_CONFLICT' })
  })

  it('refuses an excluded corpus and malformed knowledge-base id', async () => {
    const manifest = makeManifest()
    const excluded = {
      ...manifest,
      entries: [{ ...manifest.entries[0]!, corpusIdentity: 'BF1' }],
    }
    excluded.fingerprint = fingerprintManifest({
      target: excluded.target,
      entries: excluded.entries,
      heldConfigIds: excluded.heldConfigIds,
      excludedCorpora: excluded.excludedCorpora,
      excludedConfigIds: excluded.excludedConfigIds,
    })
    await expect(
      dryRunCohortActivation(fakeStore().store, excluded)
    ).rejects.toMatchObject({ code: 'EXCLUDED_CORPUS_INCLUDED' })

    const malformed = {
      ...manifest,
      entries: [{ ...manifest.entries[0]!, kbId: 'not-a-uuid' }],
    }
    malformed.fingerprint = fingerprintManifest({
      target: malformed.target,
      entries: malformed.entries,
      heldConfigIds: malformed.heldConfigIds,
      excludedCorpora: malformed.excludedCorpora,
      excludedConfigIds: malformed.excludedConfigIds,
    })
    await expect(
      dryRunCohortActivation(fakeStore().store, malformed)
    ).rejects.toMatchObject({ code: 'INVALID_ID' })
  })

  it('rolls back the synthetic transaction when a later target update fails', async () => {
    const base = fakeStore()
    const prepared = await prepareCohortActivation(base.store, makeManifest(), {
      encryptedBearer: 'encrypted-synthetic-bearer',
    })
    base.failNextTargetUpdate()
    await expect(
      switchCohortActivation(base.store, prepared)
    ).rejects.toMatchObject({
      code: 'CONCURRENT_EDIT',
    })
    expect(base.currentConfig(sourceConfig.id)?.isEnabled).toBe(true)
    expect(base.targetConfigCount()).toBe(1)
    expect(
      [...(base.currentConfig(sourceConfig.id)?.allowedTools as string[])].join(
        ','
      )
    ).toBe('doc_query')
  })

  it('reuses an owned target server and preserves unrelated target configs', async () => {
    const target: CohortActivationServerRecord = {
      id: '00000000-0000-4000-8000-000000000010',
      name: DOC_QUERY_TARGET_SERVER_NAME,
      description: DOC_QUERY_TARGET_DESCRIPTION,
      url: DOC_QUERY_TARGET_URL,
      authType: 'bearer',
      passChatbotId: true,
      chatbotIdHeader: 'Chatbot-ID',
      parameters: {},
      hasAuthSecret: true,
      isActive: true,
      updatedAt: new Date('2026-08-24T10:00:00.000Z'),
    }
    const existingTargetConfig: CohortActivationConfigRecord = {
      ...sourceConfig,
      id: '00000000-0000-4000-8000-000000000007',
      chatbotId: '00000000-0000-4000-8000-000000000008',
      mcpServerId: target.id,
      allowedTools: ['banking_expert'],
      isEnabled: false,
      parameters: { required: true, toolAlias: 'doc_query' },
    }
    const fake = fakeStore([sourceConfig, existingTargetConfig], target)
    expect(fake.currentTarget()?.id).toBe(target.id)
    const prepared = await prepareCohortActivation(fake.store, makeManifest(), {
      intent: makeCohortActivationReceiptIntent(makeManifest()),
    })
    expect(prepared.targetServer.id).toBe(target.id)
    expect(fake.targetConfigCount()).toBe(2)
  })

  it('refuses any pre-existing target server before ownership reuse', async () => {
    const target: CohortActivationServerRecord = {
      id: '00000000-0000-4000-8000-000000000010',
      name: DOC_QUERY_TARGET_SERVER_NAME,
      description: 'unmanaged compatibility route',
      url: DOC_QUERY_TARGET_URL,
      authType: 'bearer',
      passChatbotId: true,
      chatbotIdHeader: 'Chatbot-ID',
      parameters: {},
      hasAuthSecret: true,
      isActive: true,
      updatedAt: new Date('2026-08-24T10:00:00.000Z'),
    }
    const fake = fakeStore([sourceConfig], target)
    await expect(
      dryRunCohortActivation(fake.store, makeManifest())
    ).rejects.toMatchObject({ code: 'TARGET_OWNERSHIP_UNKNOWN' })
    expect(fake.writes()).toBe(0)
  })

  it('refuses a target contract that points at the test route', async () => {
    const fake = fakeStore()
    const manifest = makeManifest()
    const invalid = {
      ...manifest,
      target: { ...manifest.target, url: 'http://test/mcp/klicker' as const },
    }
    invalid.fingerprint = fingerprintManifest({
      target: invalid.target,
      entries: invalid.entries,
      heldConfigIds: invalid.heldConfigIds,
      excludedCorpora: invalid.excludedCorpora,
      excludedConfigIds: invalid.excludedConfigIds,
    })
    await expect(
      dryRunCohortActivation(fake.store, invalid)
    ).rejects.toMatchObject({
      code: 'TARGET_CONTRACT_MISMATCH',
    })
  })

  it('refuses malformed target tools and held-row overlap', async () => {
    const fake = fakeStore()
    const malformed = {
      ...makeManifest(),
      entries: [
        { ...makeManifest().entries[0]!, targetTool: 'banking*' as never },
      ],
      heldConfigIds: [],
    }
    malformed.fingerprint = fingerprintManifest({
      target: malformed.target,
      entries: malformed.entries,
      heldConfigIds: malformed.heldConfigIds,
      excludedCorpora: malformed.excludedCorpora,
      excludedConfigIds: malformed.excludedConfigIds,
    })
    await expect(
      dryRunCohortActivation(fake.store, malformed)
    ).rejects.toMatchObject({
      code: 'INVALID_TARGET_SHAPE',
    })

    const held = {
      ...makeManifest(),
      heldConfigIds: [sourceConfig.id],
    }
    held.fingerprint = fingerprintManifest({
      target: held.target,
      entries: held.entries,
      heldConfigIds: held.heldConfigIds,
      excludedCorpora: held.excludedCorpora,
      excludedConfigIds: held.excludedConfigIds,
    })
    await expect(
      dryRunCohortActivation(fake.store, held)
    ).rejects.toMatchObject({
      code: 'HELD_CONFIG_INCLUDED',
    })

    const excluded = {
      ...makeManifest(),
      excludedConfigIds: [sourceConfig.id],
    }
    excluded.fingerprint = fingerprintManifest({
      target: excluded.target,
      entries: excluded.entries,
      heldConfigIds: excluded.heldConfigIds,
      excludedCorpora: excluded.excludedCorpora,
      excludedConfigIds: excluded.excludedConfigIds,
    })
    await expect(
      dryRunCohortActivation(fake.store, excluded)
    ).rejects.toMatchObject({ code: 'EXCLUDED_CONFIG_INCLUDED' })
  })

  it('binds target contract state to the receipt digest', async () => {
    const fake = fakeStore()
    const prepared = await prepareCohortActivation(fake.store, makeManifest(), {
      encryptedBearer: 'encrypted-synthetic-bearer',
    })
    const changed = {
      ...prepared,
      targetServer: {
        ...prepared.targetServer,
        updatedAt: '2026-08-24T10:00:00.002Z',
      },
    }
    expect(() => validateReceipt(changed)).toThrow(
      expect.objectContaining({ code: 'RECEIPT_INVALID' })
    )
  })
})
