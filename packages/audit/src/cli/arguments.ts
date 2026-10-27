// Argument parsing for the owner audit CLI, kept free of side effects so it
// can be tested without running the CLI.
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ParsedArguments = {
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

export function parseArguments(argv: string[]): ParsedArguments {
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
  // Stored evidence keys and filters use lowercase UUIDs; normalize so an
  // uppercase argument cannot silently report "no evidence".
  const eventId = values.get('--event-id')?.toLowerCase()
  const liveQuizId = values.get('--live-quiz-id')?.toLowerCase()
  const participantId = values.get('--participant-id')?.toLowerCase()
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
