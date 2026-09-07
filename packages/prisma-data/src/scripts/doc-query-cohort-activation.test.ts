import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  assertCohortActivationNotPrepared,
  assertCohortActivationReentryRoot,
  assertReceiptMatchesManifest,
  assertReceiptTransition,
  type CohortActivationConfigRecord,
  type CohortActivationConfigUpdate,
  type CohortActivationManifest,
  type CohortActivationReceipt,
  type CohortActivationServerCreate,
  type CohortActivationServerRecord,
  type CohortActivationStore,
  type CohortActivationTransactionStore,
  DOC_QUERY_ROUTE_PATH,
  DOC_QUERY_TARGET_DESCRIPTION,
  DOC_QUERY_TARGET_SCOPE,
  DOC_QUERY_TARGET_SERVER_NAME,
  DOC_QUERY_TARGET_URL,
  dryRunCohortActivation,
  fingerprintManifest,
  fingerprintSourceServerSnapshot,
  type JsonValue,
  makeCohortActivationReceiptIntent,
  makeCohortActivationReentryReceiptIntent,
  prepareCohortActivation,
  readCohortActivationState,
  receiptExpectation,
  recoverPreparedCohortActivation,
  rollbackCohortActivation,
  switchCohortActivation,
  validatePinnedManifest,
  validateReceipt,
} from './doc-query-cohort-activation.js'
import { createPrismaCohortActivationStore } from './doc-query-cohort-activation-prisma.js'
import {
  acquireCohortActivationSessionLock,
  clearPreparingReceipt,
  cohortActivationReentryClaimPath,
  executeCohortActivationReentry,
  resolveCohortActivationReentryPaths,
  validateCohortActivationReentryClaim,
  writeReceipt,
} from './doc-query-cohort-activation-run.js'

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

const compatibilitySourceServer: CohortActivationServerRecord = {
  ...sourceServer,
  name: 'Klicker-compat',
  description: 'Production compatibility bridge',
  url: DOC_QUERY_TARGET_URL,
}

const inactiveSourceServer: CohortActivationServerRecord = {
  ...sourceServer,
  isActive: false,
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

const extraSourceConfig: CohortActivationConfigRecord = {
  ...sourceConfig,
  id: '00000000-0000-4000-8000-000000000008',
  chatMode: 'exam',
}

const targetServer: CohortActivationServerRecord = {
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
  updatedAt: new Date('2026-08-24T10:00:00.001Z'),
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
      sourceServerId: config.mcpServerId,
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

function makeInactiveSourceManifest(
  configs: CohortActivationConfigRecord[] = [sourceConfig, secondModeConfig],
  options: { heldConfigIds?: string[]; excludedConfigIds?: string[] } = {},
  server: CohortActivationServerRecord = inactiveSourceServer
): CohortActivationManifest {
  const base = makeManifest(configs)
  const unsigned = {
    target: base.target,
    entries: base.entries,
    heldConfigIds: options.heldConfigIds ?? base.heldConfigIds,
    inactiveSource: {
      sourceServerId: server.id,
      chatbotId: configs[0]!.chatbotId,
      configIds: configs.map((config) => config.id),
      snapshotDigest: fingerprintSourceServerSnapshot(server),
      rollbackMode: 'preserve-inactive' as const,
    },
    excludedCorpora: base.excludedCorpora,
    excludedConfigIds: options.excludedConfigIds ?? base.excludedConfigIds,
  }
  return { ...unsigned, fingerprint: fingerprintManifest(unsigned) }
}

function recomputeReceiptDigest(
  receipt: Omit<CohortActivationReceipt, 'payloadDigest'>
): CohortActivationReceipt {
  return {
    ...receipt,
    payloadDigest: createHash('sha256')
      .update(JSON.stringify(receipt))
      .digest('hex'),
  }
}

function transitionReceipt(
  receipt: CohortActivationReceipt,
  changes: Partial<Omit<CohortActivationReceipt, 'payloadDigest'>>
): CohortActivationReceipt {
  const { payloadDigest: _ignored, ...withoutDigest } = receipt
  return recomputeReceiptDigest({ ...withoutDigest, ...changes })
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
  initialTarget?: CohortActivationServerRecord,
  initialSources: CohortActivationServerRecord[] = [sourceServer]
): {
  store: CohortActivationStore
  currentConfig: (id: string) => CohortActivationConfigRecord | undefined
  currentSource: () => CohortActivationServerRecord | undefined
  currentServer: (id: string) => CohortActivationServerRecord | undefined
  currentTarget: () => CohortActivationServerRecord | undefined
  writes: () => number
  transactions: () => number
  targetConfigCount: () => number
  replaceConfig: (config: CohortActivationConfigRecord) => void
  replaceSourceServer: (server: CohortActivationServerRecord) => void
  replaceTargetServer: (server: CohortActivationServerRecord) => void
  failNextTargetUpdate: () => void
} {
  let servers = new Map<string, CohortActivationServerRecord>(
    initialSources.map((server) => [server.id, cloneServer(server)])
  )
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
      if (
        failTargetUpdate &&
        workingServers.get(data.mcpServerId)?.name ===
          DOC_QUERY_TARGET_SERVER_NAME
      ) {
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
    currentSource: () => {
      const source = servers.get(sourceServer.id)
      return source ? cloneServer(source) : undefined
    },
    currentServer: (id) => {
      const server = servers.get(id)
      return server ? cloneServer(server) : undefined
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
    replaceTargetServer: (server) =>
      servers.set(server.id, cloneServer(server)),
    failNextTargetUpdate: () => {
      failTargetUpdate = true
    },
  }
}

function activeAliasesFixture(includeInactive = false) {
  const aliases: CohortActivationServerRecord[] = [1, 2].map((index) => ({
    ...sourceServer,
    id: `00000000-0000-4000-8000-000000000${index}01`,
    name: `Synthetic active alias ${index}`,
    parameters: index === 1 ? null : {},
    description: `Synthetic course alias ${index}`,
    url: DOC_QUERY_TARGET_URL,
    passChatbotId: false,
    chatbotIdHeader: null,
  }))
  const activeConfigs = aliases.flatMap((server, index) =>
    [sourceConfig, secondModeConfig].map((config, mode) => ({
      ...config,
      id: `00000000-0000-4000-8000-000000000${index + 1}0${mode + 2}`,
      chatbotId: `00000000-0000-4000-8000-000000000${index + 1}04`,
      mcpServerId: server.id,
    }))
  )
  const inactiveConfigs = [sourceConfig, secondModeConfig].map((config) => ({
    ...config,
    chatbotId: '00000000-0000-4000-8000-000000000304',
  }))
  const protectedServer = {
    ...sourceServer,
    id: '00000000-0000-4000-8000-000000000900',
    name: 'Synthetic excluded source',
  }
  const held = {
    ...sourceConfig,
    id: '00000000-0000-4000-8000-000000000901',
    chatbotId: '00000000-0000-4000-8000-000000000904',
    mcpServerId: targetServer.id,
    parameters: {
      required: true,
      toolAlias: 'doc_query',
      kb_id: sourceConfig.chatbotId,
    },
  }
  const excluded = {
    ...secondModeConfig,
    id: '00000000-0000-4000-8000-000000000902',
    chatbotId: held.chatbotId,
    mcpServerId: protectedServer.id,
    isEnabled: false,
  }
  const configs = [
    ...activeConfigs,
    ...(includeInactive ? inactiveConfigs : []),
  ]
  const servers = [
    ...aliases,
    ...(includeInactive ? [inactiveSourceServer] : []),
    protectedServer,
  ]
  const base = makeManifest(configs)
  const unsigned = {
    ...base,
    entries: base.entries.map((entry) => ({
      ...entry,
      kbId: entry.chatbotId,
      corpusIdentity: `synthetic-corpus-${entry.chatbotId}`,
    })),
    heldConfigIds: [held.id],
    excludedConfigIds: [excluded.id],
    activeSources: aliases.map((server) => {
      const group = activeConfigs.filter(
        (config) => config.mcpServerId === server.id
      )
      return {
        sourceServerId: server.id,
        chatbotId: group[0]!.chatbotId,
        configIds: group.map((config) => config.id),
        snapshotDigest: fingerprintSourceServerSnapshot(server),
        rollbackMode: 'preserve-active' as const,
      }
    }),
    ...(includeInactive
      ? {
          inactiveSource:
            makeInactiveSourceManifest(inactiveConfigs).inactiveSource,
        }
      : {}),
  }
  const manifest: CohortActivationManifest = {
    ...unsigned,
    fingerprint: fingerprintManifest(unsigned),
  }
  const fake = fakeStore([...configs, held, excluded], targetServer, servers)
  return { fake, manifest, aliases, configs, servers, held, excluded }
}

describe('pinned active source aliases', () => {
  it('recovers, switches, and restores the combined batch without changing servers or protected rows', async () => {
    const { fake, manifest, configs, servers, held, excluded } =
      activeAliasesFixture(true)
    await expect(
      dryRunCohortActivation(fake.store, manifest)
    ).resolves.toMatchObject({ wouldSwitch: 6 })
    const intent = makeCohortActivationReceiptIntent(manifest)
    const prepared = await prepareCohortActivation(fake.store, manifest, {
      intent,
    })
    const recovered = await recoverPreparedCohortActivation(
      fake.store,
      manifest,
      intent
    )
    expect(recovered.payloadDigest).toBe(prepared.payloadDigest)
    expect(intent.activeSources).toEqual(manifest.activeSources)
    expect(recovered.activeSources).toEqual(manifest.activeSources)
    const switched = await switchCohortActivation(fake.store, recovered)
    expect(receiptExpectation(switched)?.activeSources).toEqual(
      manifest.activeSources
    )
    await expect(
      readCohortActivationState(fake.store, switched)
    ).resolves.toMatchObject({
      state: 'switched',
      sourceDisabled: 6,
      targetEnabled: 6,
    })
    const rolledBack = await rollbackCohortActivation(fake.store, switched)
    expect(rolledBack.activeSources).toEqual(manifest.activeSources)
    expect(rolledBack.inactiveSource).toEqual(manifest.inactiveSource)
    await expect(
      readCohortActivationState(fake.store, rolledBack)
    ).resolves.toMatchObject({
      state: 'rolled_back',
      sourceEnabled: 6,
      targetDisabled: 6,
    })
    for (const config of configs) {
      const restored = fake.currentConfig(config.id)!
      expect(restored).toEqual({ ...config, updatedAt: restored.updatedAt })
      expect(restored.updatedAt.getTime()).toBeGreaterThan(
        config.updatedAt.getTime()
      )
    }
    for (const server of [...servers, targetServer]) {
      expect(fake.currentServer(server.id)).toEqual(server)
    }
    expect(fake.currentConfig(held.id)).toEqual(held)
    expect(fake.currentConfig(excluded.id)).toEqual(excluded)
  })

  it('rolls back the whole batch after one alias commits and the next transaction fails', async () => {
    const { fake, manifest, configs, servers, held, excluded } =
      activeAliasesFixture(true)
    const prepared = await prepareCohortActivation(fake.store, manifest, {})
    let checkpoint = prepared
    let injected = false
    await expect(
      switchCohortActivation(fake.store, prepared, async (next) => {
        checkpoint = next
        if (!injected && next.switchedChatbotIds.length === 1) {
          injected = true
          fake.failNextTargetUpdate()
        }
      })
    ).rejects.toMatchObject({ code: 'CONCURRENT_EDIT' })
    expect(injected).toBe(true)
    expect(checkpoint.switchedChatbotIds).toHaveLength(1)
    expect(
      configs.filter((config) => !fake.currentConfig(config.id)!.isEnabled)
    ).toHaveLength(2)
    const rolledBack = await rollbackCohortActivation(fake.store, checkpoint)
    await expect(
      readCohortActivationState(fake.store, rolledBack)
    ).resolves.toMatchObject({
      state: 'rolled_back',
      sourceEnabled: 6,
      targetDisabled: 6,
    })
    for (const config of configs) {
      const restored = fake.currentConfig(config.id)!
      expect(restored).toEqual({ ...config, updatedAt: restored.updatedAt })
    }
    for (const server of [...servers, targetServer])
      expect(fake.currentServer(server.id)).toEqual(server)
    expect(fake.currentConfig(held.id)).toEqual(held)
    expect(fake.currentConfig(excluded.id)).toEqual(excluded)
  })

  it('rechecks active-only mode inventory before any switch config writes', async () => {
    const { fake, manifest, configs } = activeAliasesFixture()
    expect(manifest.inactiveSource).toBeUndefined()
    const prepared = await prepareCohortActivation(fake.store, manifest, {})
    fake.replaceConfig({
      ...configs[0]!,
      id: extraSourceConfig.id,
      chatMode: 'exam',
    })
    const writes = fake.writes()
    await expect(
      switchCohortActivation(fake.store, prepared)
    ).rejects.toMatchObject({
      code: 'ACTIVE_SOURCE_INVENTORY_MISMATCH',
    })
    expect(fake.writes()).toBe(writes)
  })

  it('does not exempt unpinned aliases or disabled source configurations', async () => {
    const { fake, manifest, configs } = activeAliasesFixture()
    const unmarked = { ...manifest, activeSources: undefined }
    unmarked.fingerprint = fingerprintManifest(unmarked)
    await expect(
      dryRunCohortActivation(fake.store, unmarked)
    ).rejects.toMatchObject({ code: 'SOURCE_IS_TARGET' })
    fake.replaceConfig({ ...configs[0]!, isEnabled: false })
    await expect(dryRunCohortActivation(fake.store, manifest)).rejects.toThrow()
    expect(fake.writes()).toBe(0)
  })

  it('canonicalizes active pin order and preserves absent-field fingerprints', () => {
    const { manifest } = activeAliasesFixture()
    expect(
      fingerprintManifest({
        ...manifest,
        activeSources: [...manifest.activeSources!].reverse().map((pin) => ({
          ...pin,
          configIds: [...pin.configIds].reverse(),
          snapshotDigest: pin.snapshotDigest.toUpperCase(),
        })),
      })
    ).toBe(manifest.fingerprint)
    const legacy = makeManifest()
    expect(fingerprintManifest({ ...legacy, activeSources: undefined })).toBe(
      legacy.fingerprint
    )
    expect(
      fingerprintManifest({ ...manifest, activeSources: undefined })
    ).not.toBe(manifest.fingerprint)
  })

  it('rejects malformed, overlapping, and incorrectly scoped pins', async () => {
    const { fake, manifest } = activeAliasesFixture(true)
    const pins = manifest.activeSources!
    const invalid = [
      { activeSources: [pins[0]!] },
      { activeSources: [pins[0]!, pins[0]!] },
      {
        activeSources: [
          { ...pins[0]!, configIds: [pins[0]!.configIds[0]!] },
          pins[1]!,
        ],
      },
      {
        activeSources: [
          { ...pins[0]!, chatbotId: pins[1]!.chatbotId },
          pins[1]!,
        ],
      },
      { activeSources: [{ ...pins[0]!, unexpected: true }, pins[1]!] },
      { activeSources: [{ ...pins[0]!, snapshotDigest: 'invalid' }, pins[1]!] },
      {
        activeSources: [
          { ...pins[0]!, rollbackMode: 'preserve-inactive' },
          pins[1]!,
        ],
      },
      { heldConfigIds: [pins[0]!.configIds[0]!] },
      { excludedConfigIds: [pins[1]!.configIds[0]!] },
      {
        activeSources: [
          { ...manifest.inactiveSource!, rollbackMode: 'preserve-active' },
          pins[1]!,
        ],
      },
    ]
    for (const changes of invalid) {
      await expect(
        (async () => {
          const altered = {
            ...manifest,
            ...changes,
          } as CohortActivationManifest
          altered.fingerprint = fingerprintManifest(altered)
          await dryRunCohortActivation(fake.store, altered)
        })()
      ).rejects.toThrow()
    }
    expect(fake.writes()).toBe(0)
  })

  it('rejects disabled rows on another chatbot even when held or excluded', async () => {
    for (const kind of ['disabled', 'held', 'excluded']) {
      const { fake, manifest, configs } = activeAliasesFixture()
      const extra = {
        ...configs[0]!,
        id: extraSourceConfig.id,
        chatbotId: sourceConfig.chatbotId,
        isEnabled: false,
      }
      fake.replaceConfig(extra)
      if (kind === 'held') manifest.heldConfigIds.push(extra.id)
      if (kind === 'excluded') manifest.excludedConfigIds!.push(extra.id)
      manifest.fingerprint = fingerprintManifest(manifest)
      await expect(
        dryRunCohortActivation(fake.store, manifest)
      ).rejects.toMatchObject({ code: 'ACTIVE_SOURCE_INVENTORY_MISMATCH' })
      expect(fake.writes()).toBe(0)
    }
  })

  it.each([
    'readback',
    'restored',
  ] as const)('checks active alias state and snapshot during %s', async (phase) => {
    const { fake, manifest, aliases, configs } = activeAliasesFixture()
    const prepared = await prepareCohortActivation(fake.store, manifest, {})
    let receipt = await switchCohortActivation(fake.store, prepared)
    if (phase === 'restored')
      receipt = transitionReceipt(
        await rollbackCohortActivation(fake.store, receipt),
        { state: 'rolling_back' }
      )
    const writes = fake.writes()
    for (const [change, code] of [
      [{ isActive: false }, 'ACTIVE_SOURCE_INACTIVE'],
      [
        { description: 'Changed synthetic metadata' },
        'ACTIVE_SOURCE_SNAPSHOT_MISMATCH',
      ],
    ] as const) {
      fake.replaceSourceServer({ ...aliases[0]!, ...change })
      await expect(
        phase === 'readback'
          ? readCohortActivationState(fake.store, receipt)
          : rollbackCohortActivation(fake.store, receipt)
      ).rejects.toMatchObject({ code })
    }
    fake.replaceSourceServer(aliases[0]!)
    fake.replaceConfig({
      ...configs[0]!,
      id: extraSourceConfig.id,
      chatMode: 'exam',
      isEnabled: false,
    })
    await expect(
      phase === 'readback'
        ? readCohortActivationState(fake.store, receipt)
        : rollbackCohortActivation(fake.store, receipt)
    ).rejects.toMatchObject({ code: 'ACTIVE_SOURCE_INVENTORY_MISMATCH' })
    expect(fake.writes()).toBe(writes)
  })

  it('rejects unsafe alias contracts even when the changed snapshot is pinned', async () => {
    const changes: Partial<CohortActivationServerRecord>[] = [
      { url: `${DOC_QUERY_TARGET_URL}/?alias=true` },
      { name: DOC_QUERY_TARGET_SERVER_NAME },
      { description: DOC_QUERY_TARGET_DESCRIPTION },
      { authType: 'none' },
      { hasAuthSecret: false },
      { parameters: { alias: true } },
      { passChatbotId: true },
    ]
    for (const change of changes) {
      const { fake, manifest, aliases } = activeAliasesFixture()
      const server = { ...aliases[0]!, ...change }
      fake.replaceSourceServer(server)
      manifest.activeSources![0]!.snapshotDigest =
        fingerprintSourceServerSnapshot(server)
      manifest.fingerprint = fingerprintManifest(manifest)
      await expect(
        prepareCohortActivation(fake.store, manifest, {})
      ).rejects.toMatchObject({ code: 'ACTIVE_SOURCE_CONTRACT_MISMATCH' })
      expect(fake.writes()).toBe(0)
    }
  })

  it.each([
    'add',
    'remove',
    'substitute',
  ] as const)('rejects recomputed-digest active pin %s in receipts and intents', async (kind) => {
    const { fake, manifest } = activeAliasesFixture()
    const marked = kind !== 'add'
    const originalManifest = marked ? manifest : makeManifest()
    const store = marked
      ? fake.store
      : fakeStore([sourceConfig], targetServer).store
    const receipt = await prepareCohortActivation(store, originalManifest, {})
    const changed =
      kind === 'remove'
        ? undefined
        : manifest.activeSources!.map((pin) => ({
            ...pin,
            snapshotDigest: 'a'.repeat(64),
          }))
    const tampered = transitionReceipt(receipt, { activeSources: changed })
    expect(() =>
      assertReceiptTransition(receiptExpectation(receipt), receipt, tampered)
    ).toThrowError(
      expect.objectContaining({ code: 'RECEIPT_MANIFEST_MISMATCH' })
    )
    expect(() =>
      assertReceiptTransition(receiptExpectation(receipt), tampered, tampered)
    ).toThrowError(
      expect.objectContaining({ code: 'RECEIPT_MANIFEST_MISMATCH' })
    )
    expect(() =>
      assertReceiptMatchesManifest(tampered, originalManifest)
    ).toThrow()
    const intent = makeCohortActivationReceiptIntent(originalManifest)
    const { payloadDigest: _digest, ...unsigned } = intent
    const payload = { ...unsigned, activeSources: changed }
    const alteredIntent = {
      ...payload,
      payloadDigest: createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex'),
    }
    expect(() =>
      assertReceiptTransition(receiptExpectation(intent), intent, alteredIntent)
    ).toThrowError(
      expect.objectContaining({ code: 'RECEIPT_MANIFEST_MISMATCH' })
    )
    await expect(
      recoverPreparedCohortActivation(store, originalManifest, alteredIntent)
    ).rejects.toThrow()
  })
})

async function rolledBackReentryFixture() {
  const fake = fakeStore([sourceConfig, secondModeConfig])
  const manifest = makeManifest([sourceConfig, secondModeConfig])
  const prepared = await prepareCohortActivation(fake.store, manifest, {
    encryptedBearer: 'encrypted-synthetic-bearer',
  })
  const switched = await switchCohortActivation(fake.store, prepared)
  const rolledBack = await rollbackCohortActivation(fake.store, switched)
  return { fake, manifest, rolledBack }
}

async function writeRolledBackReceipt(
  path: string,
  fixture: Awaited<ReturnType<typeof rolledBackReentryFixture>>
): Promise<void> {
  await writeFile(path, JSON.stringify(fixture.rolledBack))
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

  it('persists receipts from canonical exclusion aliases', async () => {
    const base = makeManifest()
    const unsigned = {
      target: base.target,
      entries: base.entries,
      heldConfigIds: base.heldConfigIds,
      excludedCorpora: [' bf1 ', 'DF_CF2', 'VORKURS2'],
      excludedConfigIds: ['AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'],
    }
    const manifest = {
      ...unsigned,
      fingerprint: fingerprintManifest(unsigned),
    }
    const intent = makeCohortActivationReceiptIntent(manifest)
    const prepared = await prepareCohortActivation(
      fakeStore().store,
      manifest,
      { encryptedBearer: 'encrypted-synthetic-bearer', intent }
    )
    const directory = await mkdtemp(
      join(tmpdir(), 'cohort-activation-alias-receipt-')
    )
    const receiptPath = join(directory, 'receipt.json')

    try {
      await writeReceipt(receiptPath, intent, null)
      await writeReceipt(receiptPath, prepared, receiptExpectation(intent))
      const persisted = JSON.parse(await readFile(receiptPath, 'utf8'))
      expect(() => validateReceipt(persisted)).not.toThrow()
      expect(persisted.excludedCorpora).toEqual(['BF1', 'DF CF2', 'Vorkurs2'])
      expect(persisted.excludedConfigIds).toEqual([
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
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

  it('proves a preparing intent was not committed before clearing it', async () => {
    const manifest = makeManifest()
    const fake = fakeStore()
    await expect(
      assertCohortActivationNotPrepared(
        fake.store,
        manifest,
        makeCohortActivationReceiptIntent(manifest)
      )
    ).resolves.toBeUndefined()
    expect(fake.writes()).toBe(0)
  })

  it('accepts an unchanged pre-existing target with no prepared slots', async () => {
    const manifest = makeManifest()
    const fake = fakeStore([sourceConfig], targetServer)
    await expect(
      assertCohortActivationNotPrepared(
        fake.store,
        manifest,
        makeCohortActivationReceiptIntent(manifest, targetServer.id)
      )
    ).resolves.toBeUndefined()
  })

  it('refuses to clear when a target server appeared after the intent', async () => {
    const manifest = makeManifest()
    const fake = fakeStore([sourceConfig], targetServer)
    await expect(
      assertCohortActivationNotPrepared(
        fake.store,
        manifest,
        makeCohortActivationReceiptIntent(manifest)
      )
    ).rejects.toMatchObject({ code: 'CLEAR_AMBIGUOUS' })
  })

  it('refuses to clear when any deterministic target config was prepared', async () => {
    const manifest = makeManifest()
    const intent = makeCohortActivationReceiptIntent(manifest, targetServer.id)
    const fake = fakeStore([sourceConfig], targetServer)
    await prepareCohortActivation(fake.store, manifest, { intent })
    await expect(
      assertCohortActivationNotPrepared(fake.store, manifest, intent)
    ).rejects.toMatchObject({ code: 'CLEAR_AMBIGUOUS' })
  })

  it('refuses to clear when the frozen source state drifted', async () => {
    const manifest = makeManifest()
    const fake = fakeStore()
    fake.replaceConfig({ ...sourceConfig, isEnabled: false })
    await expect(
      assertCohortActivationNotPrepared(
        fake.store,
        manifest,
        makeCohortActivationReceiptIntent(manifest)
      )
    ).rejects.toMatchObject({ code: 'SOURCE_MISMATCH' })
  })

  it('refuses a concurrent session for the same receipt path', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cohort-activation-lock-'))
    const receiptPath = join(directory, 'receipt.json')
    const first = await acquireCohortActivationSessionLock(receiptPath)
    try {
      await expect(
        acquireCohortActivationSessionLock(receiptPath)
      ).rejects.toMatchObject({ message: 'SESSION_LOCKED' })
    } finally {
      await first.release()
      const second = await acquireCohortActivationSessionLock(receiptPath)
      await second.release()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('allows at most one simultaneous session-lock contender', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cohort-activation-lock-'))
    const receiptPath = join(directory, 'receipt.json')
    try {
      const contenders = await Promise.allSettled([
        acquireCohortActivationSessionLock(receiptPath),
        acquireCohortActivationSessionLock(receiptPath),
      ])
      const acquired = contenders.filter(
        (
          result
        ): result is PromiseFulfilledResult<
          Awaited<ReturnType<typeof acquireCohortActivationSessionLock>>
        > => result.status === 'fulfilled'
      )
      const refused = contenders.filter(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected'
      )

      expect(acquired).toHaveLength(1)
      expect(refused).toHaveLength(1)
      expect(refused[0]!.reason).toMatchObject({ message: 'SESSION_LOCKED' })
      await acquired[0]!.value.release()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('refuses stale and out-of-order receipt replacement', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'cohort-activation-receipt-')
    )
    const receiptPath = join(directory, 'receipt.json')
    const intent = makeCohortActivationReceiptIntent(makeManifest())
    try {
      await writeReceipt(receiptPath, intent, null)

      const fake = fakeStore()
      const prepared = await prepareCohortActivation(
        fake.store,
        makeManifest(),
        { encryptedBearer: 'encrypted-synthetic-bearer' }
      )
      const switched = await switchCohortActivation(fake.store, prepared)

      await expect(
        writeReceipt(receiptPath, prepared, null)
      ).rejects.toMatchObject({ code: 'RECEIPT_CONCURRENT_WRITE' })
      await expect(
        writeReceipt(receiptPath, switched, receiptExpectation(intent))
      ).rejects.toMatchObject({ code: 'RECEIPT_STATE_TRANSITION' })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('clears only the exact preparing receipt expectation', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cohort-activation-clear-'))
    const receiptPath = join(directory, 'receipt.json')
    const intent = makeCohortActivationReceiptIntent(makeManifest())
    try {
      await writeReceipt(receiptPath, intent, null)
      await expect(
        clearPreparingReceipt(receiptPath, {
          ...receiptExpectation(intent)!,
          payloadDigest: '0'.repeat(64),
        })
      ).rejects.toMatchObject({ code: 'RECEIPT_CONCURRENT_WRITE' })
      await clearPreparingReceipt(receiptPath, receiptExpectation(intent)!)
      await expect(readFile(receiptPath, 'utf8')).rejects.toMatchObject({
        code: 'ENOENT',
      })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
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

  it('accepts null source parameters without writes', async () => {
    const sourceWithNullParameters = { ...sourceConfig, parameters: null }
    const fake = fakeStore(sourceWithNullParameters)

    await expect(
      dryRunCohortActivation(
        fake.store,
        makeManifest([sourceWithNullParameters])
      )
    ).resolves.toMatchObject({ status: 'dry-run', wouldSwitch: 1 })
    expect(fake.writes()).toBe(0)
  })

  it('creates target rows, switches by CAS, and restores exact source content', async () => {
    const sourceParameters = { required: true, toolAlias: 'doc_query' }
    const sourceWithParameters = {
      ...sourceConfig,
      parameters: sourceParameters,
    }
    const fake = fakeStore(sourceWithParameters)
    const prepared = await prepareCohortActivation(
      fake.store,
      makeManifest([sourceWithParameters]),
      {
        encryptedBearer: 'encrypted-synthetic-bearer',
      }
    )
    expect(prepared.state).toBe('prepared')
    expect(prepared.entries[0]!.prior.parameters).toEqual(sourceParameters)
    expect(fake.currentConfig(sourceConfig.id)).toMatchObject({
      ...sourceWithParameters,
      parameters: sourceParameters,
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
      parameters: sourceParameters,
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

  it('treats case-variant chatbot UUIDs as one readback group', async () => {
    const chatbotId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const firstMode = {
      ...sourceConfig,
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      chatbotId,
    }
    const secondMode = {
      ...secondModeConfig,
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      chatbotId: chatbotId.toUpperCase(),
    }
    const fake = fakeStore([firstMode, secondMode])
    const prepared = await prepareCohortActivation(
      fake.store,
      makeManifest([firstMode, secondMode]),
      { encryptedBearer: 'encrypted-synthetic-bearer' }
    )
    fake.replaceConfig({
      ...fake.currentConfig(firstMode.id)!,
      isEnabled: false,
    })
    fake.replaceConfig({
      ...fake.currentConfig(prepared.entries[0]!.target.id)!,
      isEnabled: true,
    })

    await expect(
      readCohortActivationState(fake.store, prepared)
    ).rejects.toMatchObject({ code: 'READBACK_STATE_MISMATCH' })
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

  it('switches and rolls back a pinned inactive source while preserving it inactive', async () => {
    const fake = fakeStore([sourceConfig, secondModeConfig])
    fake.replaceSourceServer(inactiveSourceServer)
    const manifest = makeInactiveSourceManifest()

    const prepared = await prepareCohortActivation(fake.store, manifest, {
      encryptedBearer: 'encrypted-synthetic-bearer',
    })
    expect(prepared.inactiveSource).toEqual(manifest.inactiveSource)

    const switched = await switchCohortActivation(fake.store, prepared)
    await expect(
      readCohortActivationState(fake.store, switched)
    ).resolves.toMatchObject({
      state: 'switched',
      sourceDisabled: 2,
      targetEnabled: 2,
    })
    expect(fake.currentSource()?.isActive).toBe(false)

    const rolledBack = await rollbackCohortActivation(fake.store, switched)
    await expect(
      readCohortActivationState(fake.store, rolledBack)
    ).resolves.toMatchObject({
      state: 'rolled_back',
      sourceEnabled: 2,
      targetDisabled: 2,
    })
    expect(fake.currentSource()?.isActive).toBe(false)
  })

  it('refuses an inactive source without the pinned exception before writes', async () => {
    const fake = fakeStore([sourceConfig, secondModeConfig])
    fake.replaceSourceServer(inactiveSourceServer)
    await expect(
      prepareCohortActivation(
        fake.store,
        makeManifest([sourceConfig, secondModeConfig]),
        {}
      )
    ).rejects.toMatchObject({ code: 'SOURCE_SERVER_INACTIVE' })
    expect(fake.writes()).toBe(0)
  })

  it('canonicalizes the exception and leaves legacy fingerprints unchanged when absent', () => {
    const manifest = makeInactiveSourceManifest()
    expect(
      fingerprintManifest({
        ...manifest,
        inactiveSource: {
          ...manifest.inactiveSource!,
          configIds: [...manifest.inactiveSource!.configIds].reverse(),
          snapshotDigest: manifest.inactiveSource!.snapshotDigest.toUpperCase(),
        },
      })
    ).toBe(manifest.fingerprint)
    const legacy = makeManifest()
    expect(fingerprintManifest({ ...legacy, inactiveSource: undefined })).toBe(
      legacy.fingerprint
    )
    expect(
      fingerprintManifest({ ...manifest, inactiveSource: undefined })
    ).not.toBe(manifest.fingerprint)
  })

  it.each([
    { configIds: [sourceConfig.id, sourceConfig.id] },
    { configIds: [sourceConfig.id] },
    { snapshotDigest: 'invalid' },
    { rollbackMode: 'enable-source' },
    { extra: true },
  ])('rejects malformed inactive exceptions %j', (changes) => {
    const manifest = makeInactiveSourceManifest()
    expect(() =>
      fingerprintManifest({
        ...manifest,
        inactiveSource: { ...manifest.inactiveSource!, ...changes },
      } as CohortActivationManifest)
    ).toThrow()
  })

  it.each([
    'heldConfigIds',
    'excludedConfigIds',
  ] as const)('refuses exception overlap with %s', (field) => {
    const manifest = makeInactiveSourceManifest(undefined, {
      [field]: [sourceConfig.id],
    })
    expect(() =>
      validatePinnedManifest(manifest, manifest.fingerprint)
    ).toThrow()
  })

  it.each([
    'sourceServerId',
    'chatbotId',
  ] as const)('rejects a mismatched exception %s', (field) => {
    const original = makeInactiveSourceManifest()
    const altered = {
      ...original,
      inactiveSource: {
        ...original.inactiveSource!,
        [field]: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      },
    }
    const manifest = { ...altered, fingerprint: fingerprintManifest(altered) }
    expect(() =>
      validatePinnedManifest(manifest, manifest.fingerprint)
    ).toThrow()
  })

  it.each([
    'enabled',
    'disabled',
    'held',
    'excluded',
  ] as const)('rejects an additional %s source config globally', async (kind) => {
    const extra = { ...extraSourceConfig, isEnabled: kind === 'enabled' }
    const fake = fakeStore([sourceConfig, secondModeConfig, extra])
    fake.replaceSourceServer(inactiveSourceServer)
    const manifest = makeInactiveSourceManifest(undefined, {
      heldConfigIds: kind === 'held' ? [extra.id] : [],
      excludedConfigIds: kind === 'excluded' ? [extra.id] : [],
    })
    await expect(
      prepareCohortActivation(fake.store, manifest, {})
    ).rejects.toMatchObject({ code: 'INACTIVE_SOURCE_INVENTORY_MISMATCH' })
    expect(fake.writes()).toBe(0)
  })

  it('rechecks global source inventory before switching', async () => {
    const fake = fakeStore([sourceConfig, secondModeConfig], targetServer)
    fake.replaceSourceServer(inactiveSourceServer)
    const receipt = await prepareCohortActivation(
      fake.store,
      makeInactiveSourceManifest(),
      {}
    )
    fake.replaceConfig({ ...extraSourceConfig, isEnabled: false })
    const writes = fake.writes()
    await expect(
      switchCohortActivation(fake.store, receipt)
    ).rejects.toMatchObject({ code: 'INACTIVE_SOURCE_INVENTORY_MISMATCH' })
    expect(fake.writes()).toBe(writes)
  })

  it.each([
    'prepare',
    'switch',
    'readback',
    'rollback',
    'restored',
  ] as const)('rejects source snapshot drift during %s', async (phase) => {
    const fake = fakeStore([sourceConfig, secondModeConfig], targetServer)
    fake.replaceSourceServer(inactiveSourceServer)
    const manifest = makeInactiveSourceManifest()
    let receipt =
      phase === 'prepare'
        ? undefined
        : await prepareCohortActivation(fake.store, manifest, {})
    if (phase === 'readback' || phase === 'rollback' || phase === 'restored')
      receipt = await switchCohortActivation(fake.store, receipt!)
    if (phase === 'restored')
      receipt = transitionReceipt(
        await rollbackCohortActivation(fake.store, receipt!),
        { state: 'rolling_back' }
      )
    fake.replaceSourceServer({
      ...inactiveSourceServer,
      description: 'Changed safe metadata',
    })
    const writes = fake.writes()
    const operation =
      phase === 'prepare'
        ? prepareCohortActivation(fake.store, manifest, {})
        : phase === 'switch'
          ? switchCohortActivation(fake.store, receipt!)
          : phase === 'readback'
            ? readCohortActivationState(fake.store, receipt!)
            : rollbackCohortActivation(fake.store, receipt!)
    await expect(operation).rejects.toMatchObject({
      code: 'INACTIVE_SOURCE_SNAPSHOT_MISMATCH',
    })
    expect(fake.writes()).toBe(writes)
  })

  it('refuses activation of the pinned inactive source even with its original metadata', async () => {
    const fake = fakeStore([sourceConfig, secondModeConfig], targetServer)
    fake.replaceSourceServer(inactiveSourceServer)
    const receipt = await prepareCohortActivation(
      fake.store,
      makeInactiveSourceManifest(),
      {}
    )
    fake.replaceSourceServer({ ...inactiveSourceServer, isActive: true })
    await expect(
      switchCohortActivation(fake.store, receipt)
    ).rejects.toMatchObject({ code: 'INACTIVE_SOURCE_ACTIVE' })
  })

  it.each([
    { name: DOC_QUERY_TARGET_SERVER_NAME },
    { description: DOC_QUERY_TARGET_DESCRIPTION },
    { url: DOC_QUERY_TARGET_URL },
    { url: `${DOC_QUERY_TARGET_URL}/?ignored=true` },
    { ...compatibilitySourceServer, isActive: false },
  ])('refuses managed or shared sources even when their snapshot is pinned %j', async (changes) => {
    const server = { ...inactiveSourceServer, ...changes }
    const fake = fakeStore([sourceConfig, secondModeConfig])
    fake.replaceSourceServer(server)
    await expect(
      prepareCohortActivation(
        fake.store,
        makeInactiveSourceManifest(undefined, {}, server),
        {}
      )
    ).rejects.toMatchObject({ code: 'SOURCE_IS_TARGET' })
    expect(fake.writes()).toBe(0)
  })

  it('preserves the inactive exception through intent recovery', async () => {
    const fake = fakeStore([sourceConfig, secondModeConfig], targetServer)
    fake.replaceSourceServer(inactiveSourceServer)
    const manifest = makeInactiveSourceManifest()
    const intent = makeCohortActivationReceiptIntent(manifest)
    const prepared = await prepareCohortActivation(fake.store, manifest, {
      intent,
    })
    const recovered = await recoverPreparedCohortActivation(
      fake.store,
      manifest,
      intent
    )
    expect(intent.inactiveSource).toEqual(manifest.inactiveSource)
    expect(recovered.inactiveSource).toEqual(manifest.inactiveSource)
    expect(recovered.payloadDigest).toBe(prepared.payloadDigest)
  })

  it.each([
    'remove',
    'substitute',
    'add',
  ] as const)('rejects recomputed-digest exception tampering: %s', async (kind) => {
    const marked = kind !== 'add'
    const fake = fakeStore([sourceConfig, secondModeConfig], targetServer)
    if (marked) fake.replaceSourceServer(inactiveSourceServer)
    const manifest = marked
      ? makeInactiveSourceManifest()
      : makeManifest([sourceConfig, secondModeConfig])
    const receipt = await prepareCohortActivation(fake.store, manifest, {})
    const changed =
      kind === 'remove'
        ? undefined
        : {
            ...makeInactiveSourceManifest().inactiveSource!,
            snapshotDigest: 'a'.repeat(64),
          }
    const tampered = transitionReceipt(receipt, { inactiveSource: changed })
    expect(() =>
      assertReceiptTransition(receiptExpectation(receipt), receipt, tampered)
    ).toThrowError(
      expect.objectContaining({ code: 'RECEIPT_MANIFEST_MISMATCH' })
    )
    expect(() =>
      assertReceiptTransition(receiptExpectation(receipt), tampered, tampered)
    ).toThrowError(
      expect.objectContaining({ code: 'RECEIPT_MANIFEST_MISMATCH' })
    )
    expect(() => assertReceiptMatchesManifest(tampered, manifest)).toThrow()
    const intent = makeCohortActivationReceiptIntent(manifest)
    const { payloadDigest: _digest, ...unsigned } = intent
    const payload = { ...unsigned, inactiveSource: changed }
    const alteredIntent = {
      ...payload,
      payloadDigest: createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex'),
    }
    expect(() =>
      assertReceiptTransition(receiptExpectation(intent), intent, alteredIntent)
    ).toThrowError(
      expect.objectContaining({ code: 'RECEIPT_MANIFEST_MISMATCH' })
    )
    await expect(
      recoverPreparedCohortActivation(fake.store, manifest, alteredIntent)
    ).rejects.toThrow()
  })

  it('switches and restores every mode from the pinned compatibility source', async () => {
    const fake = fakeStore([sourceConfig, secondModeConfig])
    fake.replaceSourceServer(compatibilitySourceServer)
    const manifest = makeManifest([sourceConfig, secondModeConfig])

    await expect(
      dryRunCohortActivation(fake.store, manifest)
    ).resolves.toMatchObject({ status: 'dry-run', wouldSwitch: 2 })
    const intent = makeCohortActivationReceiptIntent(manifest)
    const prepared = await prepareCohortActivation(fake.store, manifest, {
      encryptedBearer: 'encrypted-synthetic-bearer',
      intent,
    })
    const recovered = await recoverPreparedCohortActivation(
      fake.store,
      manifest,
      intent
    )
    expect(recovered.payloadDigest).toBe(prepared.payloadDigest)
    const switched = await switchCohortActivation(fake.store, recovered)
    await expect(
      readCohortActivationState(fake.store, switched)
    ).resolves.toMatchObject({
      state: 'switched',
      sourceDisabled: 2,
      targetEnabled: 2,
    })

    const rolledBack = await rollbackCohortActivation(fake.store, switched)
    await expect(
      readCohortActivationState(fake.store, rolledBack)
    ).resolves.toMatchObject({
      state: 'rolled_back',
      sourceEnabled: 2,
      targetDisabled: 2,
    })
  })

  it.each<
    [
      string,
      Partial<CohortActivationServerRecord>,
      'SOURCE_IS_TARGET' | 'SOURCE_SERVER_INACTIVE',
    ]
  >([
    [
      'different name',
      { name: 'Other compatibility source' },
      'SOURCE_IS_TARGET',
    ],
    ['missing description', { description: null }, 'SOURCE_IS_TARGET'],
    [
      'target ownership marker',
      { description: DOC_QUERY_TARGET_DESCRIPTION },
      'SOURCE_IS_TARGET',
    ],
    [
      'alternate route',
      { url: 'http://compat.example.invalid/mcp/klicker' },
      'SOURCE_IS_TARGET',
    ],
    ['wrong auth type', { authType: 'none' }, 'SOURCE_IS_TARGET'],
    ['chatbot id disabled', { passChatbotId: false }, 'SOURCE_IS_TARGET'],
    [
      'wrong chatbot header',
      { chatbotIdHeader: 'X-Chatbot-ID' },
      'SOURCE_IS_TARGET',
    ],
    [
      'nonempty parameters',
      { parameters: { mode: 'legacy' } },
      'SOURCE_IS_TARGET',
    ],
    ['missing auth secret', { hasAuthSecret: false }, 'SOURCE_IS_TARGET'],
    ['inactive server', { isActive: false }, 'SOURCE_SERVER_INACTIVE'],
  ])('refuses a compatibility source with %s', async (_name, change, code) => {
    const fake = fakeStore()
    fake.replaceSourceServer({ ...compatibilitySourceServer, ...change })

    await expect(
      dryRunCohortActivation(fake.store, makeManifest())
    ).rejects.toMatchObject({ code })
    expect(fake.writes()).toBe(0)
  })

  it('revalidates the compatibility source before switching', async () => {
    const fake = fakeStore()
    fake.replaceSourceServer(compatibilitySourceServer)
    const prepared = await prepareCohortActivation(fake.store, makeManifest(), {
      encryptedBearer: 'encrypted-synthetic-bearer',
    })
    const writesAfterPrepare = fake.writes()
    fake.replaceSourceServer({
      ...compatibilitySourceServer,
      authType: 'none',
    })

    await expect(
      readCohortActivationState(fake.store, prepared)
    ).rejects.toMatchObject({ code: 'SOURCE_IS_TARGET' })
    await expect(
      switchCohortActivation(fake.store, prepared)
    ).rejects.toMatchObject({ code: 'SOURCE_IS_TARGET' })
    expect(fake.writes()).toBe(writesAfterPrepare)
    expect(fake.currentConfig(sourceConfig.id)?.isEnabled).toBe(true)
  })

  it('refuses to restore a drifted compatibility source', async () => {
    const fake = fakeStore()
    fake.replaceSourceServer(compatibilitySourceServer)
    const prepared = await prepareCohortActivation(fake.store, makeManifest(), {
      encryptedBearer: 'encrypted-synthetic-bearer',
    })
    const switched = await switchCohortActivation(fake.store, prepared)
    const writesAfterSwitch = fake.writes()
    fake.replaceSourceServer({
      ...compatibilitySourceServer,
      chatbotIdHeader: 'X-Chatbot-ID',
    })

    await expect(
      rollbackCohortActivation(fake.store, switched)
    ).rejects.toMatchObject({ code: 'SOURCE_IS_TARGET' })
    expect(fake.writes()).toBe(writesAfterSwitch)
    expect(fake.currentConfig(sourceConfig.id)?.isEnabled).toBe(false)
    expect(fake.currentConfig(prepared.entries[0]!.target.id)?.isEnabled).toBe(
      true
    )

    fake.replaceSourceServer(compatibilitySourceServer)
    await expect(
      rollbackCohortActivation(fake.store, switched)
    ).resolves.toMatchObject({ state: 'rolled_back' })
  })

  it.each<JsonValue>([
    { source: true },
    { required: false, toolAlias: 'doc_query' },
    { required: true, toolAlias: 'legacy_doc_query' },
    { required: true, toolAlias: 'doc_query', extra: true },
    ['doc_query'],
  ])('refuses unsafe source parameters before writing: %j', async (parameters) => {
    const fake = fakeStore()
    const unsafe = { ...sourceConfig, parameters }
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

  it('refuses mixed knowledge bases for one chatbot', async () => {
    const manifest = makeManifest([sourceConfig, secondModeConfig])
    const conflicted = {
      ...manifest,
      entries: [
        manifest.entries[0]!,
        {
          ...manifest.entries[1]!,
          kbId: '00000000-0000-4000-8000-000000000022',
        },
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
        fakeStore([sourceConfig, secondModeConfig]).store,
        conflicted
      )
    ).rejects.toMatchObject({ code: 'MIXED_KB_COVERAGE' })
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

describe('cohort activation rollback re-entry', () => {
  it('refuses a source mode added after preparation before any switch writes', async () => {
    const fixture = await rolledBackReentryFixture()
    const { fake, manifest, rolledBack } = fixture
    const directory = await mkdtemp(
      join(tmpdir(), 'cohort-activation-reentry-')
    )
    const predecessorPath = join(directory, 'predecessor.json')
    const successorPath = join(directory, 'successor.json')
    try {
      await writeRolledBackReceipt(predecessorPath, fixture)
      const predecessorBytes = await readFile(predecessorPath)
      const writesBefore = fake.writes()
      await expect(
        executeCohortActivationReentry(
          fake.store,
          manifest,
          predecessorPath,
          successorPath,
          {
            afterPrepared: async () => {
              fake.replaceConfig({
                ...fake.currentConfig(sourceConfig.id)!,
                id: '00000000-0000-4000-8000-000000000099',
                chatMode: 'new-mode',
              })
            },
          }
        )
      ).rejects.toMatchObject({ code: 'PARTIAL_MODE_COVERAGE' })
      expect(fake.writes()).toBe(writesBefore)
      for (const entry of rolledBack.entries) {
        expect(fake.currentConfig(entry.prior.id)?.isEnabled).toBe(true)
        expect(fake.currentConfig(entry.target.id)?.isEnabled).toBe(false)
      }
      expect(await readFile(predecessorPath)).toEqual(predecessorBytes)
      expect(JSON.parse(await readFile(successorPath, 'utf8')).state).toBe(
        'switching'
      )
      expect(
        await readFile(
          cohortActivationReentryClaimPath(predecessorPath),
          'utf8'
        )
      ).not.toBe('')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('reuses the rolled-back bindings, preserves lineage, and allows rollback', async () => {
    const fixture = await rolledBackReentryFixture()
    const { fake, manifest, rolledBack } = fixture
    const directory = await mkdtemp(
      join(tmpdir(), 'cohort-activation-reentry-')
    )
    const predecessorPath = join(directory, 'predecessor.json')
    const successorPath = join(directory, 'successor.json')

    try {
      await writeRolledBackReceipt(predecessorPath, fixture)
      const predecessorBytes = await readFile(predecessorPath)
      const writesBefore = fake.writes()
      let reentryPrepared: CohortActivationReceipt | undefined
      const switched = await executeCohortActivationReentry(
        fake.store,
        manifest,
        predecessorPath,
        successorPath,
        {
          afterPrepared: async (receipt) => {
            reentryPrepared = receipt
          },
        }
      )

      expect(switched.state).toBe('switched')
      expect(reentryPrepared?.entries[0]?.target.updatedAt).toBe(
        rolledBack.entries[0]!.target.updatedAt
      )
      expect(reentryPrepared?.targetServer.updatedAt).toBe(
        rolledBack.targetServer.updatedAt
      )
      expect(switched.reentry?.predecessorPayloadDigest).toBe(
        rolledBack.payloadDigest
      )
      expect(switched.reentry?.claimDigest).toMatch(/^[0-9a-f]{64}$/)
      expect(fake.writes()).toBe(writesBefore + 4)
      expect(fake.targetConfigCount()).toBe(2)
      expect(fake.currentTarget()?.id).toBe(rolledBack.targetServer.id)
      expect(switched.entries.map(({ target }) => target.id)).toEqual(
        rolledBack.entries.map(({ target }) => target.id)
      )
      expect(switched.entries[0]!.prior.updatedAt).not.toBe(
        rolledBack.entries[0]!.prior.updatedAt
      )
      expect(await readFile(predecessorPath)).toEqual(predecessorBytes)

      const rolledBackSuccessor = await rollbackCohortActivation(
        fake.store,
        switched
      )
      await writeReceipt(
        successorPath,
        rolledBackSuccessor,
        receiptExpectation(switched)
      )
      expect(rolledBackSuccessor.state).toBe('rolled_back')
      expect(rolledBackSuccessor.reentry).toEqual(switched.reentry)
      expect(await readFile(predecessorPath)).toEqual(predecessorBytes)
      await expect(
        readCohortActivationState(fake.store, rolledBackSuccessor)
      ).resolves.toMatchObject({
        state: 'rolled_back',
        sourceEnabled: 2,
        targetDisabled: 2,
      })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('refuses replay with the same or a different successor path', async () => {
    const fixture = await rolledBackReentryFixture()
    const { fake, manifest } = fixture
    const directory = await mkdtemp(join(tmpdir(), 'cohort-activation-replay-'))
    const predecessorPath = join(directory, 'predecessor.json')
    const successorPath = join(directory, 'successor.json')
    const differentSuccessorPath = join(directory, 'different.json')

    try {
      await writeRolledBackReceipt(predecessorPath, fixture)
      await executeCohortActivationReentry(
        fake.store,
        manifest,
        predecessorPath,
        successorPath
      )
      await expect(
        executeCohortActivationReentry(
          fake.store,
          manifest,
          predecessorPath,
          successorPath
        )
      ).rejects.toMatchObject({ code: 'REENTRY_SUCCESSOR_EXISTS' })
      await expect(
        executeCohortActivationReentry(
          fake.store,
          manifest,
          predecessorPath,
          differentSuccessorPath
        )
      ).rejects.toMatchObject({ code: 'REENTRY_CLAIM_MISMATCH' })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('rejects lineage in ordinary prepare, recovery, and clear paths', async () => {
    const { fake, manifest, rolledBack } = await rolledBackReentryFixture()
    const intent = makeCohortActivationReentryReceiptIntent(
      manifest,
      rolledBack,
      {
        predecessorPayloadDigest: rolledBack.payloadDigest,
        claimDigest: 'a'.repeat(64),
      }
    )

    await expect(
      prepareCohortActivation(fake.store, manifest, { intent })
    ).rejects.toMatchObject({ code: 'REENTRY_NOT_ALLOWED' })
    await expect(
      recoverPreparedCohortActivation(fake.store, manifest, intent)
    ).rejects.toMatchObject({ code: 'REENTRY_NOT_ALLOWED' })
    await expect(
      assertCohortActivationNotPrepared(fake.store, manifest, intent)
    ).rejects.toMatchObject({ code: 'REENTRY_NOT_ALLOWED' })

    const directory = await mkdtemp(join(tmpdir(), 'cohort-reentry-clear-'))
    const path = join(directory, 'intent.json')
    try {
      await writeReceipt(path, intent, null)
      const before = await readFile(path)
      await expect(
        clearPreparingReceipt(path, receiptExpectation(intent)!)
      ).rejects.toMatchObject({ code: 'REENTRY_NOT_ALLOWED' })
      expect(await readFile(path)).toEqual(before)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('refuses a changed manifest, incomplete inventory, and lineage predecessor', async () => {
    const fixture = await rolledBackReentryFixture()
    const directory = await mkdtemp(
      join(tmpdir(), 'cohort-activation-reentry-contract-')
    )
    const predecessorPath = join(directory, 'predecessor.json')

    try {
      await writeRolledBackReceipt(predecessorPath, fixture)
      await expect(
        executeCohortActivationReentry(
          fixture.fake.store,
          makeManifest([sourceConfig]),
          predecessorPath,
          join(directory, 'changed-manifest.json')
        )
      ).rejects.toMatchObject({ code: 'RECEIPT_MANIFEST_MISMATCH' })

      const incompleteFake = fakeStore()
      const incompleteManifest = makeManifest()
      const incompletePrepared = await prepareCohortActivation(
        incompleteFake.store,
        incompleteManifest,
        { encryptedBearer: 'encrypted-synthetic-bearer' }
      )
      const incompleteSwitched = await switchCohortActivation(
        incompleteFake.store,
        incompletePrepared
      )
      const incompleteRolledBack = await rollbackCohortActivation(
        incompleteFake.store,
        incompleteSwitched
      )
      const incompletePath = join(directory, 'incomplete.json')
      await writeFile(incompletePath, JSON.stringify(incompleteRolledBack))
      await expect(
        executeCohortActivationReentry(
          incompleteFake.store,
          incompleteManifest,
          incompletePath,
          join(directory, 'incomplete-successor.json')
        )
      ).rejects.toMatchObject({ code: 'REENTRY_INVENTORY_MISMATCH' })

      const successorPath = join(directory, 'successor.json')
      await executeCohortActivationReentry(
        fixture.fake.store,
        fixture.manifest,
        predecessorPath,
        successorPath
      )
      const lineageRolledBack = await rollbackCohortActivation(
        fixture.fake.store,
        JSON.parse(await readFile(successorPath, 'utf8'))
      )
      const lineagePath = join(directory, 'lineage-predecessor.json')
      await writeFile(lineagePath, JSON.stringify(lineageRolledBack))
      await expect(
        executeCohortActivationReentry(
          fixture.fake.store,
          fixture.manifest,
          lineagePath,
          join(directory, 'lineage-successor.json')
        )
      ).rejects.toMatchObject({ code: 'REENTRY_PREDECESSOR_INVALID' })
      expect(() =>
        assertCohortActivationReentryRoot(lineageRolledBack)
      ).toThrow(
        expect.objectContaining({ code: 'REENTRY_PREDECESSOR_INVALID' })
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it.each<
    [
      string,
      (
        fake: ReturnType<typeof fakeStore>,
        rolledBack: Awaited<
          ReturnType<typeof rolledBackReentryFixture>
        >['rolledBack']
      ) => void,
      string,
    ]
  >([
    [
      'disabled source',
      (fake) =>
        fake.replaceConfig({
          ...fake.currentConfig(sourceConfig.id)!,
          isEnabled: false,
        }),
      'SOURCE_MISMATCH',
    ],
    [
      'changed source content',
      (fake) =>
        fake.replaceConfig({
          ...fake.currentConfig(sourceConfig.id)!,
          priority: 9,
        }),
      'SOURCE_DRIFT',
    ],
    [
      'enabled target',
      (fake, rolledBack) =>
        fake.replaceConfig({
          ...fake.currentConfig(rolledBack.entries[0]!.target.id)!,
          isEnabled: true,
        }),
      'TARGET_DRIFT',
    ],
    [
      'changed target timestamp',
      (fake, rolledBack) =>
        fake.replaceConfig({
          ...fake.currentConfig(rolledBack.entries[0]!.target.id)!,
          updatedAt: new Date('2026-08-24T10:00:00.999Z'),
        }),
      'TARGET_DRIFT',
    ],
    [
      'changed target server timestamp',
      (fake) =>
        fake.replaceTargetServer({
          ...fake.currentTarget()!,
          updatedAt: new Date('2026-08-24T10:00:00.999Z'),
        }),
      'TARGET_SERVER_DRIFT',
    ],
  ])('refuses %s before claiming', async (_name, mutate, code) => {
    const fixture = await rolledBackReentryFixture()
    const { fake, manifest, rolledBack } = fixture
    mutate(fake, rolledBack)
    const directory = await mkdtemp(
      join(tmpdir(), 'cohort-activation-reentry-drift-')
    )
    const predecessorPath = join(directory, 'predecessor.json')
    const successorPath = join(directory, 'successor.json')

    try {
      await writeRolledBackReceipt(predecessorPath, fixture)
      const predecessorBytes = await readFile(predecessorPath)
      const writesBefore = fake.writes()
      await expect(
        executeCohortActivationReentry(
          fake.store,
          manifest,
          predecessorPath,
          successorPath
        )
      ).rejects.toMatchObject({ code })
      expect(fake.writes()).toBe(writesBefore)
      await expect(readFile(successorPath)).rejects.toMatchObject({
        code: 'ENOENT',
      })
      await expect(
        readFile(cohortActivationReentryClaimPath(predecessorPath))
      ).rejects.toMatchObject({ code: 'ENOENT' })
      expect(await readFile(predecessorPath)).toEqual(predecessorBytes)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('rejects equal and symlink-ambiguous receipt paths', async () => {
    const fixture = await rolledBackReentryFixture()
    const { fake, manifest } = fixture
    const directory = await mkdtemp(
      join(tmpdir(), 'cohort-activation-reentry-path-')
    )
    const predecessorPath = join(directory, 'predecessor.json')
    const symlinkPath = join(directory, 'symlink.json')

    try {
      await writeRolledBackReceipt(predecessorPath, fixture)
      await expect(
        resolveCohortActivationReentryPaths(predecessorPath, predecessorPath)
      ).rejects.toMatchObject({ code: 'REENTRY_PATH_AMBIGUOUS' })
      await symlink(predecessorPath, symlinkPath)
      await expect(
        executeCohortActivationReentry(
          fake.store,
          manifest,
          predecessorPath,
          symlinkPath
        )
      ).rejects.toMatchObject({ code: 'REENTRY_PATH_AMBIGUOUS' })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('allows only one competing re-entry session', async () => {
    const fixture = await rolledBackReentryFixture()
    const { fake, manifest } = fixture
    const directory = await mkdtemp(
      join(tmpdir(), 'cohort-activation-reentry-concurrency-')
    )
    const predecessorPath = join(directory, 'predecessor.json')
    const firstSuccessorPath = join(directory, 'first.json')
    const secondSuccessorPath = join(directory, 'second.json')

    try {
      await writeRolledBackReceipt(predecessorPath, fixture)
      const results = await Promise.allSettled([
        executeCohortActivationReentry(
          fake.store,
          manifest,
          predecessorPath,
          firstSuccessorPath
        ),
        executeCohortActivationReentry(
          fake.store,
          manifest,
          predecessorPath,
          secondSuccessorPath
        ),
      ])
      expect(
        results.filter((result) => result.status === 'fulfilled')
      ).toHaveLength(1)
      expect(
        results.filter((result) => result.status === 'rejected')
      ).toHaveLength(1)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it.each([
    'claim',
    'intent',
    'prepared',
  ] as const)('retains evidence when a crash occurs after the %s boundary', async (boundary) => {
    const fixture = await rolledBackReentryFixture()
    const { fake, manifest, rolledBack } = fixture
    const directory = await mkdtemp(
      join(tmpdir(), 'cohort-activation-reentry-crash-')
    )
    const predecessorPath = join(directory, 'predecessor.json')
    const successorPath = join(directory, 'successor.json')

    try {
      await writeRolledBackReceipt(predecessorPath, fixture)
      const predecessorBytes = await readFile(predecessorPath)
      const writesBefore = fake.writes()
      const crash = async () => {
        throw new Error('simulated crash')
      }
      const hooks =
        boundary === 'claim'
          ? { afterClaim: crash }
          : boundary === 'intent'
            ? { afterIntent: crash }
            : { afterPrepared: crash }
      await expect(
        executeCohortActivationReentry(
          fake.store,
          manifest,
          predecessorPath,
          successorPath,
          hooks
        )
      ).rejects.toThrow('simulated crash')
      const claimPath = cohortActivationReentryClaimPath(predecessorPath)
      const claimBytes = await readFile(claimPath, 'utf8')
      const claim = JSON.parse(claimBytes)
      validateCohortActivationReentryClaim(claim, {
        predecessorPath,
        successorPath,
      })
      expect(claim.predecessorPayloadDigest).toBe(rolledBack.payloadDigest)
      for (const nextPath of [successorPath, join(directory, 'retry.json')]) {
        await expect(
          executeCohortActivationReentry(
            fake.store,
            manifest,
            predecessorPath,
            nextPath
          )
        ).rejects.toThrow()
      }
      expect(fake.writes()).toBe(writesBefore)
      expect(await readFile(claimPath, 'utf8')).toBe(claimBytes)
      if (boundary === 'claim') {
        await expect(readFile(successorPath)).rejects.toMatchObject({
          code: 'ENOENT',
        })
      } else {
        const successor = JSON.parse(await readFile(successorPath, 'utf8'))
        expect(successor.state).toBe(
          boundary === 'intent' ? 'preparing' : 'prepared'
        )
      }
      expect(await readFile(predecessorPath)).toEqual(predecessorBytes)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})

describe('Prisma cohort activation transactions', () => {
  it('retries a P2034 transaction until it succeeds', async () => {
    const transaction = vi.fn()
    let attempts = 0
    transaction.mockImplementation(async (operation) => {
      attempts += 1
      const result = await operation({} as never)
      if (attempts === 1) throw { code: 'P2034' }
      return result
    })
    const store = createPrismaCohortActivationStore({
      $transaction: transaction,
    } as unknown as PrismaClient)
    const callback = vi.fn(async () => 'committed')

    await expect(store.transaction(callback)).resolves.toBe('committed')
    expect(transaction).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('bounds P2034 retries and rethrows the final conflict', async () => {
    const transaction = vi.fn()
    const conflict = { code: 'P2034' }
    transaction.mockImplementation(async (operation) => {
      await operation({} as never)
      throw conflict
    })
    const store = createPrismaCohortActivationStore({
      $transaction: transaction,
    } as unknown as PrismaClient)

    await expect(store.transaction(async () => 'unreachable')).rejects.toBe(
      conflict
    )
    expect(transaction).toHaveBeenCalledTimes(3)
  })

  it('does not retry non-P2034 transaction errors', async () => {
    const transaction = vi.fn()
    const error = new Error('transaction timeout')
    transaction.mockRejectedValue(error)
    const store = createPrismaCohortActivationStore({
      $transaction: transaction,
    } as unknown as PrismaClient)

    await expect(store.transaction(async () => 'unreachable')).rejects.toBe(
      error
    )
    expect(transaction).toHaveBeenCalledTimes(1)
  })
})
