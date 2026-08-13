import { prisma } from '@klicker-uzh/prisma'

import type { AnalysisPurpose } from '../chatbot-analysis/core.js'
import { createPrismaAnalysisRecordProvider } from '../chatbot-analysis/prismaProvider.js'
import { runAggregateReport } from '../chatbot-analysis/reports.js'

type CliOptions = {
  courseId: string
  purpose: AnalysisPurpose
  from: Date
  to: Date
  outDir: string
  filePrefix: string
  minimumCellSize: number | undefined
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function usage() {
  return [
    'Usage:',
    '  pnpm --filter @klicker-uzh/prisma-data script:prod src/scripts/2026-08-13_chatbot_aggregate_report.ts --courseId <uuid> --from <date> --to <date> --outDir <path>',
    '',
    'Options:',
    '  --courseId <uuid>              Analyze chatbots for one course.',
    '  --purpose <learning-analytics> Purpose. Research is not enabled.',
    '  --from <date>                  Inclusive ISO date or timestamp.',
    '  --to <date>                    Inclusive ISO date or timestamp.',
    '  --outDir <path>                Destination for JSON and XLSX.',
    '  --filePrefix <name>            Default: chatbot-aggregate.',
    '  --minimumCellSize <n>          Default: 5.',
    '',
    'Database-backed runs currently produce a fully suppressed aggregate because authoritative effective-dated eligibility is not yet configured.',
  ].join('\n')
}

function getRequiredArg(args: string[], name: string) {
  const index = args.indexOf(name)
  const value = index >= 0 ? args[index + 1] : undefined
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}.`)
  }
  return value
}

function getOptionalArg(args: string[], name: string) {
  const index = args.indexOf(name)
  if (index < 0) return undefined
  const value = args[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}.`)
  }
  return value
}

function parseDate(value: string, name: string, endOfDay = false) {
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
      : value
  )
  if (Number.isNaN(date.getTime()))
    throw new Error(`Invalid ${name}: ${value}.`)
  return date
}

function parseArgs(args: string[]): CliOptions {
  if (args.includes('--help')) {
    console.log(usage())
    process.exit(0)
  }
  const known = new Set([
    '--courseId',
    '--purpose',
    '--from',
    '--to',
    '--outDir',
    '--filePrefix',
    '--minimumCellSize',
  ])
  for (const arg of args) {
    if (arg.startsWith('--') && !known.has(arg)) {
      throw new Error(`Unknown option: ${arg}.`)
    }
  }

  const courseId = getRequiredArg(args, '--courseId')
  if (!UUID_PATTERN.test(courseId)) throw new Error('Invalid --courseId UUID.')
  const purpose = getOptionalArg(args, '--purpose') ?? 'learning-analytics'
  if (purpose !== 'learning-analytics' && purpose !== 'research') {
    throw new Error('Invalid --purpose.')
  }
  if (purpose === 'research') {
    throw new Error('Only --purpose learning-analytics is currently enabled.')
  }
  const from = parseDate(getRequiredArg(args, '--from'), '--from')
  const to = parseDate(getRequiredArg(args, '--to'), '--to', true)
  if (from > to) throw new Error('--from must be before or equal to --to.')
  const minimumCellSizeValue = args.includes('--minimumCellSize')
    ? Number(getRequiredArg(args, '--minimumCellSize'))
    : undefined
  if (
    minimumCellSizeValue !== undefined &&
    (!Number.isInteger(minimumCellSizeValue) || minimumCellSizeValue < 2)
  ) {
    throw new Error('--minimumCellSize must be an integer greater than one.')
  }

  return {
    courseId,
    purpose,
    from,
    to,
    outDir: getRequiredArg(args, '--outDir'),
    filePrefix: args.includes('--filePrefix')
      ? getRequiredArg(args, '--filePrefix')
      : 'chatbot-aggregate',
    minimumCellSize: minimumCellSizeValue,
  }
}

try {
  const options = parseArgs(process.argv.slice(2))
  const result = await runAggregateReport({
    provider: createPrismaAnalysisRecordProvider(options.courseId),
    purpose: options.purpose,
    window: { from: options.from, to: options.to },
    outDir: options.outDir,
    filePrefix: options.filePrefix,
    minimumCellSize: options.minimumCellSize,
  })
  console.log(`JSON: ${result.files.jsonPath}`)
  console.log(`XLSX: ${result.files.workbookPath}`)
  console.log(
    `Eligibility: authoritative decisions are unavailable; ${result.core.eligible.excludedMessageIds.length} selected records were excluded fail closed.`
  )
} catch (error) {
  console.error(
    `ERROR: ${error instanceof Error ? error.message : String(error)}`
  )
  console.error('Run with --help for usage.')
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
