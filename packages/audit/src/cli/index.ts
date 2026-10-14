#!/usr/bin/env node

import {
  createAzureAuditClients,
  readAzureAuditStorageConfig,
} from '../azure/credential.js'
import { AzureTableAuditReader } from '../azure/table-reader.js'
import {
  buildAuditExport,
  serializeAuditExport,
  writePrivateAtomicFile,
} from './export.js'

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ParsedArguments = {
  command: 'verify' | 'export'
  eventId?: string
  liveQuizId?: string
  lifecycleEpoch?: number
  participantId?: string
  output?: string
  force: boolean
}

function usage(): string {
  return [
    'Usage:',
    '  klicker-audit verify --event-id <uuid>',
    '  klicker-audit export --live-quiz-id <uuid> [--lifecycle-epoch <n>] [--participant-id <uuid>] --output <path> [--force]',
  ].join('\n')
}

function parseArguments(argv: string[]): ParsedArguments {
  const command = argv[0]
  if (command !== 'verify' && command !== 'export') {
    throw new Error(usage())
  }
  const values = new Map<string, string>()
  let force = false
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index]!
    if (argument === '--force') {
      force = true
      continue
    }
    if (!argument.startsWith('--')) {
      throw new Error(`Unexpected argument: ${argument}\n${usage()}`)
    }
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for ${argument}\n${usage()}`)
    }
    if (values.has(argument)) {
      throw new Error(`Duplicate argument: ${argument}`)
    }
    values.set(argument, value)
    index += 1
  }
  const allowed = new Set(
    command === 'verify'
      ? ['--event-id']
      : ['--live-quiz-id', '--lifecycle-epoch', '--participant-id', '--output']
  )
  for (const key of values.keys()) {
    if (!allowed.has(key)) {
      throw new Error(`Unknown argument for ${command}: ${key}`)
    }
  }
  if (command === 'verify' && force) {
    throw new Error('--force is only valid for export')
  }
  const eventId = values.get('--event-id')
  const liveQuizId = values.get('--live-quiz-id')
  const participantId = values.get('--participant-id')
  for (const [name, value] of [
    ['event ID', eventId],
    ['live quiz ID', liveQuizId],
    ['participant ID', participantId],
  ] as const) {
    if (value !== undefined && !UUID.test(value)) {
      throw new Error(`${name} must be a UUID`)
    }
  }
  const epochText = values.get('--lifecycle-epoch')
  const lifecycleEpoch =
    epochText === undefined ? undefined : Number.parseInt(epochText, 10)
  if (
    lifecycleEpoch !== undefined &&
    (!Number.isSafeInteger(lifecycleEpoch) ||
      lifecycleEpoch < 0 ||
      String(lifecycleEpoch) !== epochText)
  ) {
    throw new Error('lifecycle epoch must be a non-negative integer')
  }
  if (command === 'verify' && eventId === undefined) {
    throw new Error(`--event-id is required\n${usage()}`)
  }
  if (command === 'export') {
    if (liveQuizId === undefined || values.get('--output') === undefined) {
      throw new Error(`--live-quiz-id and --output are required\n${usage()}`)
    }
  }
  return {
    command,
    eventId,
    liveQuizId,
    lifecycleEpoch,
    participantId,
    output: values.get('--output'),
    force,
  }
}

async function main() {
  const args = parseArguments(process.argv.slice(2))
  const clients = createAzureAuditClients(readAzureAuditStorageConfig())
  const reader = new AzureTableAuditReader(clients.tables)
  if (args.command === 'verify') {
    const evidence = await reader.verifyEvent(args.eventId!)
    process.stdout.write(
      `${JSON.stringify({
        eventId: evidence.envelope.eventId,
        eventHash: evidence.envelope.eventHash,
        eventType: evidence.envelope.eventType,
        recordedAt: evidence.envelope.recordedAt,
        status: evidence.status,
        sealStatus: evidence.sealStatus,
      })}\n`
    )
    return
  }

  const document = await buildAuditExport({
    reader,
    liveQuizId: args.liveQuizId!,
    lifecycleEpoch: args.lifecycleEpoch,
    participantId: args.participantId,
  })
  const outputPath = await writePrivateAtomicFile({
    outputPath: args.output!,
    content: serializeAuditExport(document),
    force: args.force,
  })
  process.stdout.write(
    `${JSON.stringify({
      outputPath,
      eventCount: document.verification.eventCount,
      evidenceStatus: document.verification.evidenceStatus,
      baselineStatus: document.verification.baselineStatus,
      coverageStatus: document.verification.coverageStatus,
      participantStatus: document.verification.participantStatus,
      sealStatus: document.verification.sealStatus,
    })}\n`
  )
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  )
  process.exitCode = 1
})
