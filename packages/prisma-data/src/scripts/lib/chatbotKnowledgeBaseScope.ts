/**
 * Knowledge-base scope helpers for provisioning a chatbot's Doc Query access.
 *
 * Authority model: the KBChatbot binding is the scope authority. The chat
 * runtime reads the Doc Query scope from the configuration parameters
 * (`apps/chat/src/services/mcpScope.ts` fails closed when they are missing or
 * malformed), so a binding is projected into exactly one representation:
 * `kb_id` for a single bound knowledge base and `kb_ids` for several.
 *
 * The helpers here are pure so the projection, the refusals and the rollback
 * snapshot can be verified without a database.
 */
import type { Prisma } from '@klicker-uzh/prisma/client'

export const DOC_QUERY_SERVER_NAME = 'KB'
export const DOC_QUERY_TOOL_ALIAS = 'doc_query'
export const SNAPSHOT_VERSION = 1 as const

const APPLY_FLAG = '--apply'
const ROLLBACK_FLAG = '--rollback'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class ProvisionFailure extends Error {
  readonly code: string

  constructor(code: string, detail?: string) {
    super(detail ? `FAIL: ${code} ${detail}` : `FAIL: ${code}`)
    this.name = 'ProvisionFailure'
    this.code = code
  }
}

export const USAGE = [
  'Usage: tsx provision_chatbot_knowledge_base.ts',
  '  --chatbot-id <uuid> --kb-id <uuid> --kb-name <text> --owner <email>',
  '  [--description <text>] [--legacy-server <name>]',
  '  [--snapshot-out <path>] [--apply]',
  'Usage: tsx provision_chatbot_knowledge_base.ts --rollback --snapshot <path>',
].join('\n')

export type ProvisionArgs = {
  apply: boolean
  rollback: boolean
  chatbotId: string
  kbId: string
  kbName: string
  description: string | null
  ownerEmail: string
  legacyServerName: string | null
  snapshotPath: string | null
}

function readFlag(argv: Array<string>, name: string): string | undefined {
  const index = argv.indexOf(name)
  return index === -1 ? undefined : argv[index + 1]
}

export function normalizeUuid(value: string, code: string): string {
  const normalized = value.trim().toLowerCase()
  if (!UUID_PATTERN.test(normalized)) {
    throw new ProvisionFailure(code, 'value is not a canonical UUID')
  }
  return normalized
}

export function parseArgs(argv: Array<string>): ProvisionArgs {
  const apply = argv.includes(APPLY_FLAG)
  const rollback = argv.includes(ROLLBACK_FLAG)

  if (rollback) {
    const snapshotPath = readFlag(argv, '--snapshot')
    if (!snapshotPath) {
      throw new ProvisionFailure('usage', '\n' + USAGE)
    }
    return {
      apply,
      rollback,
      chatbotId: '',
      kbId: '',
      kbName: '',
      description: null,
      ownerEmail: '',
      legacyServerName: null,
      snapshotPath,
    }
  }

  const chatbotId = readFlag(argv, '--chatbot-id')
  const kbId = readFlag(argv, '--kb-id')
  const kbName = readFlag(argv, '--kb-name')
  const ownerEmail = readFlag(argv, '--owner')
  if (!chatbotId || !kbId || !kbName || !ownerEmail || kbName.trim() === '') {
    throw new ProvisionFailure('usage', '\n' + USAGE)
  }

  const snapshotPath = readFlag(argv, '--snapshot-out')
  if (apply && !snapshotPath) {
    // Every write must be revertible; the snapshot is its recorded inverse.
    throw new ProvisionFailure(
      'usage',
      '--apply requires --snapshot-out <path>\n' + USAGE
    )
  }

  return {
    apply,
    rollback: false,
    chatbotId: normalizeUuid(chatbotId, 'chatbot_id_invalid'),
    kbId: normalizeUuid(kbId, 'kb_id_invalid'),
    kbName: kbName.trim(),
    description: readFlag(argv, '--description')?.trim() || null,
    ownerEmail: ownerEmail.trim().toLowerCase(),
    legacyServerName: readFlag(argv, '--legacy-server')?.trim() || null,
    snapshotPath: snapshotPath ?? null,
  }
}

export function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0
    )
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

export function equalJson(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right)
}

/**
 * Projects the Doc Query parameters from the binding-derived scope. Unknown
 * keys survive the projection so an unrelated configuration is never dropped.
 */
export function projectDocQueryParameters(
  existing: unknown,
  kbIds: readonly string[]
): Prisma.InputJsonObject {
  const [firstKbId] = kbIds
  if (!firstKbId) {
    throw new ProvisionFailure('kb_scope_empty')
  }
  const projected: Record<string, unknown> = isPlainObject(existing)
    ? { ...existing }
    : {}
  delete projected.kb_id
  delete projected.kb_ids
  projected.required = true
  projected.toolAlias = DOC_QUERY_TOOL_ALIAS
  if (kbIds.length === 1) {
    projected.kb_id = firstKbId
  } else {
    projected.kb_ids = [...kbIds].sort((left, right) =>
      left < right ? -1 : left > right ? 1 : 0
    )
  }
  return projected as Prisma.InputJsonObject
}

export function hasDocQueryToolDefinition(allowedTools: unknown): boolean {
  return (
    Array.isArray(allowedTools) &&
    allowedTools.length === 1 &&
    allowedTools[0] === DOC_QUERY_TOOL_ALIAS
  )
}

export type ConfigRecord = {
  id: string
  chatMode: string
  isEnabled: boolean
  allowedTools: unknown
  parameters: unknown
}

export type BindingRecord = {
  id: string
  kbId: string
  isEnabled: boolean
}

export type ProvisionState = {
  chatbot: {
    id: string
    name: string
    ownerId: string
    courseId: string
    courseOwnerId: string
  } | null
  owner: { id: string; email: string } | null
  kbById: {
    id: string
    name: string
    ownerId: string
    deletedAt: Date | null
  } | null
  kbNameConflictIds: string[]
  bindings: BindingRecord[]
  kbServerConfigs: ConfigRecord[]
  legacyServer: { id: string; name: string; isActive: boolean } | null
  legacyServerConfigs: ConfigRecord[]
  legacyServerOtherEnabledConfigs: number
}

export type PlannedConfigUpdate = {
  id: string
  chatMode: string
  isEnabled: true
  parameters: Prisma.InputJsonObject
  parametersChanged: boolean
  enablementChanged: boolean
}

export type ProvisionPlan = {
  refusal: string | null
  createKb: boolean
  createBinding: boolean
  configUpdates: PlannedConfigUpdate[]
  legacyConfigDisables: Array<{ id: string; chatMode: string }>
  deactivateLegacyServer: boolean
}

export function planProvision(
  state: ProvisionState,
  target: { kbId: string; kbName: string; legacyServerName: string | null }
): ProvisionPlan {
  const refusal = (code: string): ProvisionPlan => ({
    refusal: code,
    createKb: false,
    createBinding: false,
    configUpdates: [],
    legacyConfigDisables: [],
    deactivateLegacyServer: false,
  })

  if (!state.chatbot) return refusal('chatbot_not_found')
  if (!state.owner) return refusal('owner_not_found')
  if (state.chatbot.ownerId !== state.owner.id) {
    return refusal('owner_not_chatbot_owner')
  }
  if (state.chatbot.courseOwnerId !== state.owner.id) {
    return refusal('course_owner_mismatch')
  }

  if (state.kbById) {
    if (state.kbById.ownerId !== state.owner.id) {
      return refusal('kb_owner_mismatch')
    }
    if (state.kbById.deletedAt !== null) return refusal('kb_archived')
    if (state.kbById.name !== target.kbName) return refusal('kb_name_mismatch')
  }
  if (state.kbNameConflictIds.length > 0) return refusal('kb_name_conflict')

  if (state.bindings.some((binding) => binding.kbId !== target.kbId)) {
    return refusal('binding_conflict')
  }

  if (state.kbServerConfigs.length === 0) return refusal('kb_config_missing')
  for (const config of state.kbServerConfigs) {
    if (!hasDocQueryToolDefinition(config.allowedTools)) {
      return refusal('kb_config_tools_invalid')
    }
  }
  // The runtime resolves one enabled configuration per chat mode; two
  // bindings in the same mode cannot be reconciled into a single scope.
  const modes = new Set(state.kbServerConfigs.map(({ chatMode }) => chatMode))
  if (modes.size !== state.kbServerConfigs.length) {
    return refusal('kb_config_mode_duplicate')
  }

  if (target.legacyServerName && !state.legacyServer) {
    return refusal('legacy_server_not_found')
  }

  const configUpdates = state.kbServerConfigs.map((config) => {
    const parameters = projectDocQueryParameters(config.parameters, [
      target.kbId,
    ])
    return {
      id: config.id,
      chatMode: config.chatMode,
      isEnabled: true as const,
      parameters,
      parametersChanged: !equalJson(config.parameters, parameters),
      enablementChanged: config.isEnabled !== true,
    }
  })

  const legacyConfigDisables = state.legacyServerConfigs
    .filter((config) => config.isEnabled)
    .map((config) => ({ id: config.id, chatMode: config.chatMode }))

  const deactivateLegacyServer =
    !!state.legacyServer &&
    state.legacyServer.isActive &&
    state.legacyServerConfigs.length > 0 &&
    state.legacyServerOtherEnabledConfigs === 0

  return {
    refusal: null,
    createKb: !state.kbById,
    createBinding: !state.bindings.some(
      (binding) => binding.kbId === target.kbId
    ),
    configUpdates,
    legacyConfigDisables,
    deactivateLegacyServer,
  }
}

export function describePlan(
  args: ProvisionArgs,
  state: ProvisionState,
  plan: ProvisionPlan
): string {
  const lines = ['Plan:']
  lines.push(`  chatbotId=${args.chatbotId}`)
  lines.push(`  chatbotName=${state.chatbot?.name ?? 'unknown'}`)
  lines.push(`  courseId=${state.chatbot?.courseId ?? 'unknown'}`)
  lines.push(`  owner=${state.owner?.email ?? 'unknown'}`)
  lines.push(`  kbId=${args.kbId}`)
  lines.push(`  kbName=${args.kbName}`)
  lines.push(`  action=${plan.createKb ? 'create_kb' : 'none'}`)
  lines.push(`  action=${plan.createBinding ? 'create_binding' : 'none'}`)
  lines.push(`  kbConfigs=${state.kbServerConfigs.length}`)
  for (const update of plan.configUpdates) {
    lines.push(
      `  action=project_parameters config=${update.id} mode=${update.chatMode} changed=${update.parametersChanged}`
    )
    if (update.enablementChanged) {
      lines.push(
        `  action=enable_config config=${update.id} mode=${update.chatMode}`
      )
    }
  }
  for (const legacy of plan.legacyConfigDisables) {
    lines.push(
      `  action=disable_legacy_config config=${legacy.id} mode=${legacy.chatMode}`
    )
  }
  if (plan.deactivateLegacyServer) {
    lines.push(
      `  action=deactivate_legacy_server server=${state.legacyServer?.id ?? 'unknown'}`
    )
  }
  return lines.join('\n')
}

export type ProvisionSnapshot = {
  version: typeof SNAPSHOT_VERSION
  createdAt: string
  chatbotId: string
  kbId: string
  kbName: string
  kbWasCreated: boolean
  binding: { id: string; isEnabled: boolean } | null
  configs: Array<{
    id: string
    chatMode: string
    isEnabled: boolean
    parameters: unknown
  }>
  legacyServer: { id: string; isActive: boolean } | null
  legacyConfigs: Array<{ id: string; isEnabled: boolean }>
}

export function buildSnapshot(
  state: ProvisionState,
  plan: ProvisionPlan,
  target: { chatbotId: string; kbId: string; kbName: string }
): ProvisionSnapshot {
  const existingBinding = state.bindings.find(
    (binding) => binding.kbId === target.kbId
  )
  return {
    version: SNAPSHOT_VERSION,
    createdAt: new Date().toISOString(),
    chatbotId: target.chatbotId,
    kbId: target.kbId,
    kbName: target.kbName,
    kbWasCreated: plan.createKb,
    binding: existingBinding
      ? { id: existingBinding.id, isEnabled: existingBinding.isEnabled }
      : null,
    configs: state.kbServerConfigs.map((config) => ({
      id: config.id,
      chatMode: config.chatMode,
      isEnabled: config.isEnabled,
      parameters: config.parameters,
    })),
    legacyServer: state.legacyServer
      ? { id: state.legacyServer.id, isActive: state.legacyServer.isActive }
      : null,
    legacyConfigs: state.legacyServerConfigs.map((config) => ({
      id: config.id,
      isEnabled: config.isEnabled,
    })),
  }
}

export function parseSnapshot(raw: string): ProvisionSnapshot {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new ProvisionFailure('snapshot_invalid', 'snapshot is not JSON')
  }
  if (!isPlainObject(parsed)) {
    throw new ProvisionFailure('snapshot_invalid', 'snapshot is not an object')
  }
  const candidate = parsed as Partial<ProvisionSnapshot>
  const binding = candidate.binding
  if (
    candidate.version !== SNAPSHOT_VERSION ||
    typeof candidate.chatbotId !== 'string' ||
    typeof candidate.kbId !== 'string' ||
    typeof candidate.kbName !== 'string' ||
    typeof candidate.kbWasCreated !== 'boolean' ||
    !Array.isArray(candidate.configs) ||
    !(
      binding === null ||
      binding === undefined ||
      (isPlainObject(binding) &&
        typeof binding.id === 'string' &&
        typeof binding.isEnabled === 'boolean')
    )
  ) {
    throw new ProvisionFailure('snapshot_invalid', 'snapshot shape mismatch')
  }
  return { ...candidate, binding: binding ?? null } as ProvisionSnapshot
}
