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
  AnalysisRecordProvider,
  AnalysisWindow,
} from './core.js'
import { runAnalysisCore } from './core.js'

export const AGGREGATE_REPORT_SCHEMA_VERSION = 1
export const DEFAULT_MINIMUM_CELL_SIZE = 5

export type ReportMessage = AnalysisMessage

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

export type ExploratorySignalInput = {
  name: string
  assignedMessages: number
  eligibleMessages: number
  coverage: number
  stability: number | null
  validated: false
}

export type ExploratorySignalSummary = Omit<
  ExploratorySignalInput,
  'assignedMessages' | 'eligibleMessages' | 'coverage'
> & {
  assignedMessages: DisclosureNumber
  eligibleMessages: DisclosureNumber
  coverage: DisclosureNumber
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
  exploratorySignals?: ExploratorySignalInput[]
}): AggregateReport {
  const minimumCellSize = input.minimumCellSize ?? DEFAULT_MINIMUM_CELL_SIZE
  const eligibleIds = new Set(
    input.core.eligible.messages.map((message) => message.id)
  )
  const messages = input.messages.filter((message) =>
    eligibleIds.has(message.id)
  )
  const eligibilityUnavailable =
    messages.length === 0 && input.core.eligible.excludedMessageIds.length > 0
  const messageById = new Map(messages.map((message) => [message.id, message]))
  const users = messages.filter((message) => message.role === 'user')
  const assistants = messages.filter((message) => message.role === 'assistant')
  const selectedModels = input.core.exchanges
    .map((exchange) => messageById.get(exchange.assistantMessage?.id ?? ''))
    .filter(
      (message): message is ReportMessage => message?.role === 'assistant'
    )
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
    eligibilityUnavailable ||
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
      : discloseCount(signal.assignedMessages, minimumCellSize),
    eligibleMessages: messagePopulationSuppressed
      ? null
      : discloseCount(signal.eligibleMessages, minimumCellSize),
    coverage: messagePopulationSuppressed
      ? null
      : signal.assignedMessages < minimumCellSize
        ? null
        : discloseRatio(
            signal.assignedMessages,
            signal.eligibleMessages,
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
 * The historical exporter's content flag must not become an output
 * authorization. ADR-0005 defines the boundary for any future governed path.
 */
export function assertLegacyMessageContentExportDisabled(
  includeMessageContent: boolean
) {
  if (includeMessageContent) {
    throw new Error(
      '--includeMessageContent is disabled; no content-bearing export exists. A governed restricted export remains future work under ADR-0005.'
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

export async function runAggregateReport(input: {
  provider: AnalysisRecordProvider
  purpose: AnalysisPurpose
  window: AnalysisWindow
  outDir: string
  filePrefix: string
  minimumCellSize?: number
  exploratorySignals?: ExploratorySignalInput[]
}) {
  const core = await runAnalysisCore(input.provider, {
    purpose: input.purpose,
    window: input.window,
  })
  const report = buildAggregateReport({
    core,
    messages: core.eligible.messages,
    purpose: input.purpose,
    window: input.window,
    minimumCellSize: input.minimumCellSize,
    exploratorySignals: input.exploratorySignals,
  })
  const files = await writeAggregateReportFiles({
    outDir: input.outDir,
    filePrefix: input.filePrefix,
    report,
  })
  return { core, report, files }
}
