import { createHash, createHmac } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import type { WorkbookSheet } from '../scripts/lib/simpleWorkbook.js'
import {
  sanitizeFilename,
  writeWorkbookFile,
} from '../scripts/lib/simpleWorkbook.js'

import type {
  AnalysisCoreResult,
  AnalysisExchange,
  AnalysisMessage,
  AnalysisPurpose,
  AnalysisWindow,
} from './core.js'

export const AGGREGATE_REPORT_SCHEMA_VERSION = 1
export const RESTRICTED_EXPORT_SCHEMA_VERSION = 1
export const DEFAULT_MINIMUM_CELL_SIZE = 5

export type ReportMessage = AnalysisMessage & {
  chatMode?: string | null
  modelId?: string | null
}

export type DisclosureCell = {
  label: string
  value: number | null
}

export type DisclosureNumber = number | null

export type DisclosureTable = {
  dimension: string
  minimumCellSize: number
  suppressed: boolean
  rows: DisclosureCell[]
  total: number | null
}

export type ExploratorySignalSummary = {
  name: string
  assignedMessages: DisclosureNumber
  eligibleMessages: DisclosureNumber
  coverage: DisclosureNumber
  stability: number | null
  validated: false
}

export type AggregateReport = {
  schemaVersion: typeof AGGREGATE_REPORT_SCHEMA_VERSION
  reportKind: 'aggregate'
  purpose: AnalysisPurpose
  window: { from: string; to: string }
  privacy: {
    containsMessageContent: false
    containsStableIdentifiers: false
    containsParticipantPseudonyms: false
    minimumCellSize: number
    suppressedTables: string[]
  }
  summary: {
    eligibleMessages: DisclosureNumber
    userMessages: DisclosureNumber
    assistantMessages: DisclosureNumber
    participants: DisclosureNumber
    conversations: DisclosureNumber
    attachments: DisclosureNumber
    creditsInternalUnits: DisclosureNumber
    exchanges: Record<AnalysisExchange['status'], DisclosureNumber>
    ratingCoverage: {
      ratedResponses: DisclosureNumber
      unratedResponses: DisclosureNumber
      up: DisclosureNumber
      down: DisclosureNumber
      coverage: DisclosureNumber
    }
  }
  dimensions: {
    chatModes: DisclosureTable
    selectedModels: DisclosureTable
    attachmentModality: DisclosureTable
  }
  exploratorySignals: ExploratorySignalSummary[]
  provenance: Array<{
    field: string
    source: 'postgresql'
    definition: string
    denominator: string
    unknownCount: DisclosureNumber
  }>
}

export type RestrictedExportEligibility = {
  available: boolean
  filterApplied: boolean
  purpose: AnalysisPurpose
  courseId: string
  from: Date
  to: Date
  populationDescription: string
  authority: string
  eligibleMessageIds: ReadonlySet<string>
}

type DimensionValue = string | null | undefined

function normalizeDimension(value: DimensionValue) {
  return value && value.trim().length > 0 ? value : 'unknown'
}

function round(value: number) {
  const factor = 10 ** 6
  return Math.round(value * factor) / factor
}

function discloseCount(value: number, minimumCellSize: number) {
  return value === 0 || value >= minimumCellSize ? value : null
}

function discloseRatio(
  numerator: number,
  denominator: number,
  minimumCellSize: number
) {
  if (denominator === 0) return 0
  return denominator >= minimumCellSize ? round(numerator / denominator) : null
}

function countBy<T>(values: T[], getValue: (value: T) => DimensionValue) {
  const counts = new Map<string, number>()
  for (const value of values) {
    const label = normalizeDimension(getValue(value))
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return counts
}

export function buildDisclosureTable(
  dimension: string,
  counts: Map<string, number>,
  minimumCellSize = DEFAULT_MINIMUM_CELL_SIZE
): DisclosureTable {
  if (!Number.isInteger(minimumCellSize) || minimumCellSize < 2) {
    throw new Error('minimumCellSize must be an integer greater than one.')
  }

  const rows = Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, count]) => ({
      label,
      value: count < minimumCellSize ? null : count,
    }))
  const suppressed = rows.some((row) => row.value === null)

  return {
    dimension,
    minimumCellSize,
    suppressed,
    rows,
    // Omitting the margin whenever a cell is suppressed prevents a displayed
    // total from reconstructing the hidden cell in this one-dimensional table.
    total: suppressed
      ? null
      : rows.reduce((total, row) => total + (row.value ?? 0), 0),
  }
}

function suppressDisclosureTable(table: DisclosureTable): DisclosureTable {
  return {
    ...table,
    suppressed: true,
    rows: table.rows.map((row) => ({ ...row, value: null })),
    total: null,
  }
}

function exchangeCounts(exchanges: AnalysisExchange[]) {
  const counts: Record<AnalysisExchange['status'], number> = {
    linked: 0,
    ambiguous: 0,
    absent: 0,
    outside_window: 0,
  }
  for (const exchange of exchanges) counts[exchange.status] += 1
  return counts
}

function provenance(
  core: AnalysisCoreResult,
  users: ReportMessage[],
  selectedModels: ReportMessage[],
  minimumCellSize: number,
  messagePopulationSuppressed: boolean,
  ratingCoverageSuppressed: boolean
): AggregateReport['provenance'] {
  const unknownModes = users.filter(
    (message) => !message.chatMode || message.chatMode.trim().length === 0
  ).length
  const unknownModels = selectedModels.filter(
    (message) => !message.modelId || message.modelId.trim().length === 0
  ).length

  return [
    {
      field: 'summary.eligibleMessages',
      source: 'postgresql',
      definition:
        'Messages with exactly one matching effective purpose decision',
      denominator: 'selected message records',
      unknownCount: messagePopulationSuppressed
        ? null
        : discloseCount(
            core.eligible.excludedMessageIds.length,
            minimumCellSize
          ),
    },
    {
      field: 'summary.ratingCoverage',
      source: 'postgresql',
      definition: 'Explicit UP or DOWN ratings on linked tutor responses',
      denominator: 'linked tutor responses',
      unknownCount: ratingCoverageSuppressed
        ? null
        : discloseCount(core.ratingCoverage.unratedResponses, minimumCellSize),
    },
    {
      field: 'dimensions.chatModes',
      source: 'postgresql',
      definition: 'Stored chat mode on eligible user messages',
      denominator: 'eligible user messages',
      unknownCount: messagePopulationSuppressed
        ? null
        : discloseCount(unknownModes, minimumCellSize),
    },
    {
      field: 'dimensions.selectedModels',
      source: 'postgresql',
      definition:
        'Stored selected model identifier, not actual provider routing',
      denominator: 'linked tutor responses',
      unknownCount: messagePopulationSuppressed
        ? null
        : discloseCount(unknownModels, minimumCellSize),
    },
  ]
}

export function buildAggregateReport(input: {
  core: AnalysisCoreResult
  messages: ReportMessage[]
  purpose: AnalysisPurpose
  window: AnalysisWindow
  minimumCellSize?: number
  exploratorySignals?: ExploratorySignalSummary[]
}): AggregateReport {
  const minimumCellSize = input.minimumCellSize ?? DEFAULT_MINIMUM_CELL_SIZE
  const eligibleIds = new Set(
    input.core.eligible.messages.map((message) => message.id)
  )
  const messages = input.messages.filter((message) =>
    eligibleIds.has(message.id)
  )
  const messageById = new Map(messages.map((message) => [message.id, message]))
  const users = messages.filter((message) => message.role === 'user')
  const assistants = messages.filter((message) => message.role === 'assistant')
  const linked = input.core.exchanges
    .map((exchange) => messageById.get(exchange.assistantMessage?.id ?? ''))
    .filter(
      (message): message is ReportMessage => message?.role === 'assistant'
    )
  const selectedModels = linked
  const exchangeCountsByStatus = exchangeCounts(input.core.exchanges)
  const participants = new Set(messages.map((message) => message.participantId))
  const conversations = new Set(messages.map((message) => message.threadId))
  const attachments = messages.reduce(
    (total, message) => total + message.attachmentCount,
    0
  )
  const credits = messages.reduce(
    (total, message) => total + (message.creditsUsed ?? 0),
    0
  )
  const ratedResponses = input.core.ratingCoverage.ratedResponses
  const unratedResponses = input.core.ratingCoverage.unratedResponses
  const linkedResponses = ratedResponses + unratedResponses
  const exchangePartitionSuppressed = Object.values(
    exchangeCountsByStatus
  ).some((count) => count > 0 && count < minimumCellSize)
  const ratingPartitionSuppressed = [
    ratedResponses,
    unratedResponses,
    input.core.ratingCoverage.up,
    input.core.ratingCoverage.down,
  ].some((count) => count > 0 && count < minimumCellSize)
  const messageRolePartitionSuppressed = [users.length, assistants.length].some(
    (count) => count > 0 && count < minimumCellSize
  )
  const rawDimensions = {
    chatModes: buildDisclosureTable(
      'chatMode',
      countBy(users, (message) => message.chatMode),
      minimumCellSize
    ),
    selectedModels: buildDisclosureTable(
      'selectedModel',
      countBy(selectedModels, (message) => message.modelId),
      minimumCellSize
    ),
    attachmentModality: buildDisclosureTable(
      'attachmentModality',
      countBy(users, (message) =>
        message.attachmentCount > 0 ? 'with_attachment' : 'without_attachment'
      ),
      minimumCellSize
    ),
  }
  const rawDimensionSuppressed = Object.values(rawDimensions).some(
    (table) => table.suppressed
  )
  const messagePopulationSuppressed =
    rawDimensionSuppressed ||
    exchangePartitionSuppressed ||
    messageRolePartitionSuppressed
  const dimensions = {
    chatModes: messagePopulationSuppressed
      ? suppressDisclosureTable(rawDimensions.chatModes)
      : rawDimensions.chatModes,
    selectedModels: messagePopulationSuppressed
      ? suppressDisclosureTable(rawDimensions.selectedModels)
      : rawDimensions.selectedModels,
    attachmentModality: messagePopulationSuppressed
      ? suppressDisclosureTable(rawDimensions.attachmentModality)
      : rawDimensions.attachmentModality,
  }
  const ratingCoverageSuppressed =
    messagePopulationSuppressed || ratingPartitionSuppressed
  const suppressedTables = [
    ...Object.values(dimensions)
      .filter((table) => table.suppressed)
      .map((table) => table.dimension),
    ...(messagePopulationSuppressed
      ? ['summary.userPopulation', 'summary.exchanges', 'exploratorySignals']
      : []),
    ...(ratingCoverageSuppressed ? ['summary.ratingCoverage'] : []),
  ]
  const exploratorySignals = (input.exploratorySignals ?? []).map((signal) => ({
    ...signal,
    assignedMessages: messagePopulationSuppressed
      ? null
      : discloseCount(signal.assignedMessages ?? 0, minimumCellSize),
    eligibleMessages: messagePopulationSuppressed
      ? null
      : discloseCount(signal.eligibleMessages ?? 0, minimumCellSize),
    coverage: messagePopulationSuppressed
      ? null
      : (signal.assignedMessages ?? 0) < minimumCellSize
        ? null
        : discloseRatio(
            signal.assignedMessages ?? 0,
            signal.eligibleMessages ?? 0,
            minimumCellSize
          ),
  }))

  return {
    schemaVersion: AGGREGATE_REPORT_SCHEMA_VERSION,
    reportKind: 'aggregate',
    purpose: input.purpose,
    window: {
      from: input.window.from.toISOString(),
      to: input.window.to.toISOString(),
    },
    privacy: {
      containsMessageContent: false,
      containsStableIdentifiers: false,
      containsParticipantPseudonyms: false,
      minimumCellSize,
      suppressedTables,
    },
    summary: {
      eligibleMessages: messagePopulationSuppressed
        ? null
        : discloseCount(messages.length, minimumCellSize),
      userMessages: messagePopulationSuppressed
        ? null
        : discloseCount(users.length, minimumCellSize),
      assistantMessages: messagePopulationSuppressed
        ? null
        : discloseCount(assistants.length, minimumCellSize),
      participants: messagePopulationSuppressed
        ? null
        : discloseCount(participants.size, minimumCellSize),
      conversations: messagePopulationSuppressed
        ? null
        : discloseCount(conversations.size, minimumCellSize),
      attachments: messagePopulationSuppressed
        ? null
        : discloseCount(attachments, minimumCellSize),
      creditsInternalUnits:
        participants.size < minimumCellSize || messagePopulationSuppressed
          ? null
          : round(credits),
      exchanges: Object.fromEntries(
        Object.entries(exchangeCountsByStatus).map(([status, count]) => [
          status,
          messagePopulationSuppressed || exchangePartitionSuppressed
            ? null
            : discloseCount(count, minimumCellSize),
        ])
      ) as Record<AnalysisExchange['status'], DisclosureNumber>,
      ratingCoverage: {
        ratedResponses: ratingCoverageSuppressed
          ? null
          : discloseCount(ratedResponses, minimumCellSize),
        unratedResponses: ratingCoverageSuppressed
          ? null
          : discloseCount(unratedResponses, minimumCellSize),
        up: ratingCoverageSuppressed
          ? null
          : discloseCount(input.core.ratingCoverage.up, minimumCellSize),
        down: ratingCoverageSuppressed
          ? null
          : discloseCount(input.core.ratingCoverage.down, minimumCellSize),
        coverage: ratingCoverageSuppressed
          ? null
          : discloseRatio(ratedResponses, linkedResponses, minimumCellSize),
      },
    },
    dimensions,
    exploratorySignals,
    provenance: provenance(
      input.core,
      users,
      selectedModels,
      minimumCellSize,
      messagePopulationSuppressed,
      ratingCoverageSuppressed
    ),
  }
}

/**
 * The historical exporter can still calculate content-sensitive sheets
 * internally, but its old content flag must not be an output authorization.
 * Callers must use the governed restricted-export contract instead.
 */
export function assertLegacyMessageContentExportDisabled(
  includeMessageContent: boolean
) {
  if (includeMessageContent) {
    throw new Error(
      '--includeMessageContent is disabled; use the governed restricted-export action with eligibility, operator, destination, audit, expiry, and deletion gates.'
    )
  }
}

function aggregateReportSheets(report: AggregateReport): WorkbookSheet[] {
  const summary: Array<[string, string, string | number]> = Object.entries(
    report.summary
  ).flatMap(([field, value]) => {
    if (field === 'exchanges' || field === 'ratingCoverage') {
      return Object.entries(value as Record<string, number>).map(
        ([subfield, subvalue]) =>
          [field, subfield, subvalue] as [string, string, string | number]
      )
    }
    return [
      ['summary', field, value as string | number] as [
        string,
        string,
        string | number,
      ],
    ]
  })
  const dimensions: Array<[string, string, number | null, boolean, number]> =
    Object.values(report.dimensions).flatMap((table) =>
      table.rows.map(
        (row) =>
          [
            table.dimension,
            row.label,
            row.value,
            table.suppressed,
            table.minimumCellSize,
          ] as [string, string, number | null, boolean, number]
      )
    )

  return [
    {
      name: 'Summary',
      headers: ['section', 'field', 'value'],
      rows: summary,
    },
    {
      name: 'Dimensions',
      headers: ['dimension', 'label', 'value', 'suppressed', 'minimumCellSize'],
      rows: dimensions,
    },
    {
      name: 'Exploratory Signals',
      headers: [
        'name',
        'assignedMessages',
        'eligibleMessages',
        'coverage',
        'stability',
        'validated',
      ],
      rows: report.exploratorySignals.map((signal) => [
        signal.name,
        signal.assignedMessages,
        signal.eligibleMessages,
        signal.coverage,
        signal.stability,
        signal.validated,
      ]),
    },
    {
      name: 'Provenance',
      headers: ['field', 'source', 'definition', 'denominator', 'unknownCount'],
      rows: report.provenance.map((entry) => [
        entry.field,
        entry.source,
        entry.definition,
        entry.denominator,
        entry.unknownCount,
      ]),
    },
  ]
}

export async function writeAggregateReportFiles(input: {
  outDir: string
  filePrefix: string
  report: AggregateReport
}) {
  await mkdir(input.outDir, { recursive: true })
  const prefix = sanitizeFilename(input.filePrefix)
  const jsonPath = resolve(input.outDir, `${prefix}.json`)
  await writeFile(
    jsonPath,
    `${JSON.stringify(input.report, null, 2)}\n`,
    'utf8'
  )
  const workbookPath = await writeWorkbookFile(
    input.outDir,
    `${prefix}.xlsx`,
    aggregateReportSheets(input.report)
  )
  return { jsonPath, workbookPath }
}

export type RestrictedExportMessage = ReportMessage & {
  attachmentDescriptions?: string[]
}

export type RestrictedExportRequest = {
  purpose: AnalysisPurpose
  courseId: string
  operatorId: string
  from: Date
  to: Date
  expiresAt: Date
}

export type RestrictedExportDependencies = {
  eligibility: RestrictedExportEligibility
  operator: { authoritative: boolean }
  destination: { encrypted: boolean; verified: boolean; descriptor: string }
  deletion: { owner: string; rebuildKey: string }
  audit: {
    append: (event: RestrictedExportAuditEvent) => Promise<void>
  }
}

export type RestrictedExportAuditEvent = {
  schemaVersion: typeof RESTRICTED_EXPORT_SCHEMA_VERSION
  eventType: 'chatbot-restricted-export-authorized'
  purpose: AnalysisPurpose
  courseId: string
  operatorId: string
  expiresAt: string
  destinationDescriptor: string
  rowCount: number
  artifactSha256: string
  fields: string[]
  eligibilityFrom: string
  eligibilityTo: string
  populationDescription: string
  eligibilityAuthority: string
  outputTier: 'restricted'
  limitations: string[]
}

export type RestrictedExportRow = {
  coursePseudonym: string
  participantPseudonym: string
  threadPseudonym: string
  messagePseudonym: string
  parentMessagePseudonym: string | null
  role: string
  messageCreatedAt: string
  chatMode: string | null
  selectedModel: string | null
  rating: 'UP' | 'DOWN' | null
  creditsInternalUnits: number | null
  attachmentDescriptions: string[]
  text: string
}

export type RestrictedExportArtifact = {
  schemaVersion: typeof RESTRICTED_EXPORT_SCHEMA_VERSION
  rows: RestrictedExportRow[]
  manifest: {
    purpose: AnalysisPurpose
    coursePseudonym: string
    expiresAt: string
    deletionOwner: string
    rebuildKey: string
    artifactSha256: string
    fields: string[]
    excludedFields: string[]
    eligibilityFrom: string
    eligibilityTo: string
    populationDescription: string
    eligibilityAuthority: string
    outputTier: 'restricted'
    limitations: string[]
  }
}

function scopedPseudonym(
  value: string,
  purpose: AnalysisPurpose,
  courseId: string,
  secret: string,
  domain: string
) {
  return createHmac('sha256', secret)
    .update(`${domain}\0${purpose}\0${courseId}\0${value}`)
    .digest('hex')
    .slice(0, 24)
}

function restrictedRows(
  messages: RestrictedExportMessage[],
  request: RestrictedExportRequest,
  secret: string
): RestrictedExportRow[] {
  const sorted = [...messages].sort(
    (left, right) =>
      left.createdAt.getTime() - right.createdAt.getTime() ||
      left.id.localeCompare(right.id)
  )
  const messagePseudonyms = new Map(
    sorted.map((message) => [
      message.id,
      scopedPseudonym(
        message.id,
        request.purpose,
        request.courseId,
        secret,
        'message'
      ),
    ])
  )
  const coursePseudonym = scopedPseudonym(
    request.courseId,
    request.purpose,
    request.courseId,
    secret,
    'course'
  )

  return sorted.map((message) => ({
    coursePseudonym,
    participantPseudonym: scopedPseudonym(
      message.participantId,
      request.purpose,
      request.courseId,
      secret,
      'participant'
    ),
    threadPseudonym: scopedPseudonym(
      message.threadId,
      request.purpose,
      request.courseId,
      secret,
      'thread'
    ),
    messagePseudonym: messagePseudonyms.get(message.id)!,
    parentMessagePseudonym: message.parentId
      ? (messagePseudonyms.get(message.parentId) ?? null)
      : null,
    role: message.role,
    messageCreatedAt: message.createdAt.toISOString(),
    chatMode: message.chatMode ?? null,
    selectedModel: message.modelId ?? null,
    rating: message.rating,
    creditsInternalUnits: message.creditsUsed,
    attachmentDescriptions: (message.attachmentDescriptions ?? []).filter(
      (description) => description.trim().length > 0
    ),
    text: message.text,
  }))
}

function digestRows(rows: RestrictedExportRow[]) {
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex')
}

function assertRestrictedRequest(
  request: RestrictedExportRequest,
  dependencies: RestrictedExportDependencies,
  secret: string,
  now: Date,
  messages: RestrictedExportMessage[]
) {
  const failures: string[] = []
  if (!request.operatorId.trim()) failures.push('operator identity is missing')
  if (!dependencies.operator.authoritative) {
    failures.push('operator identity is not authoritative')
  }
  if (!dependencies.eligibility.available) {
    failures.push('authoritative eligibility is unavailable')
  }
  if (!dependencies.eligibility.filterApplied) {
    failures.push('eligibility filter was not applied')
  }
  if (dependencies.eligibility.purpose !== request.purpose) {
    failures.push('eligibility purpose does not match the export purpose')
  }
  if (dependencies.eligibility.courseId !== request.courseId) {
    failures.push('eligibility course does not match the export course')
  }
  if (
    dependencies.eligibility.from.getTime() !== request.from.getTime() ||
    dependencies.eligibility.to.getTime() !== request.to.getTime()
  ) {
    failures.push('eligibility period does not match the export period')
  }
  if (!dependencies.eligibility.populationDescription.trim()) {
    failures.push('eligibility population description is missing')
  }
  if (!dependencies.eligibility.authority.trim()) {
    failures.push('eligibility authority is missing')
  }
  if (
    messages.some(
      (message) =>
        message.courseId !== request.courseId ||
        !dependencies.eligibility.eligibleMessageIds.has(message.id)
    )
  ) {
    failures.push('one or more rows are outside the authoritative eligible set')
  }
  if (request.expiresAt.getTime() <= now.getTime()) {
    failures.push('export expiry must be in the future')
  }
  if (!dependencies.destination.encrypted) {
    failures.push('destination is not encrypted')
  }
  if (
    !dependencies.destination.verified ||
    !dependencies.destination.descriptor.trim()
  ) {
    failures.push('destination verification is missing')
  }
  if (!dependencies.deletion.owner.trim())
    failures.push('deletion owner is missing')
  if (!dependencies.deletion.rebuildKey.trim()) {
    failures.push('withdrawal rebuild key is missing')
  }
  if (!secret.trim()) failures.push('pseudonym secret is missing')
  if (failures.length > 0) {
    throw new Error(`Restricted export denied: ${failures.join('; ')}.`)
  }
}

export async function authorizeRestrictedExport(input: {
  messages: RestrictedExportMessage[]
  request: RestrictedExportRequest
  dependencies: RestrictedExportDependencies
  pseudonymSecret: string
  now?: Date
}): Promise<RestrictedExportArtifact> {
  assertRestrictedRequest(
    input.request,
    input.dependencies,
    input.pseudonymSecret,
    input.now ?? new Date(),
    input.messages
  )
  const rows = restrictedRows(
    input.messages,
    input.request,
    input.pseudonymSecret
  )
  const fields = [
    'coursePseudonym',
    'participantPseudonym',
    'threadPseudonym',
    'messagePseudonym',
    'parentMessagePseudonym',
    'role',
    'messageCreatedAt',
    'chatMode',
    'selectedModel',
    'rating',
    'creditsInternalUnits',
    'attachmentDescriptions',
    'text',
  ]
  const excludedFields = [
    'participantId',
    'threadId',
    'messageId',
    'reasoningContent',
    'rawImageBytes',
    'rawToolResults',
  ]
  const artifactSha256 = digestRows(rows)
  const manifest = {
    purpose: input.request.purpose,
    coursePseudonym: scopedPseudonym(
      input.request.courseId,
      input.request.purpose,
      input.request.courseId,
      input.pseudonymSecret,
      'course'
    ),
    expiresAt: input.request.expiresAt.toISOString(),
    eligibilityFrom: input.request.from.toISOString(),
    eligibilityTo: input.request.to.toISOString(),
    populationDescription: input.dependencies.eligibility.populationDescription,
    eligibilityAuthority: input.dependencies.eligibility.authority,
    outputTier: 'restricted' as const,
    limitations: [
      'Purpose-scoped pseudonyms are not a substitute for access control.',
      'Raw reasoning, image bytes, and tool results are excluded.',
    ],
    deletionOwner: input.dependencies.deletion.owner,
    rebuildKey: input.dependencies.deletion.rebuildKey,
    artifactSha256,
    fields,
    excludedFields,
  }
  await input.dependencies.audit.append({
    schemaVersion: RESTRICTED_EXPORT_SCHEMA_VERSION,
    eventType: 'chatbot-restricted-export-authorized',
    purpose: input.request.purpose,
    courseId: input.request.courseId,
    operatorId: input.request.operatorId,
    expiresAt: manifest.expiresAt,
    eligibilityFrom: manifest.eligibilityFrom,
    eligibilityTo: manifest.eligibilityTo,
    populationDescription: manifest.populationDescription,
    eligibilityAuthority: manifest.eligibilityAuthority,
    outputTier: manifest.outputTier,
    limitations: manifest.limitations,
    destinationDescriptor: input.dependencies.destination.descriptor,
    rowCount: rows.length,
    artifactSha256,
    fields,
  })

  return {
    schemaVersion: RESTRICTED_EXPORT_SCHEMA_VERSION,
    rows,
    manifest,
  }
}
