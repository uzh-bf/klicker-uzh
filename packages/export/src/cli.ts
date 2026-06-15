export const EXPORT_COURSE_USAGE =
  'Usage: pnpm --filter @klicker-uzh/export export -- --courseId <id> [--courseId <id2> ...] [--outputDir <path>] [--pseudonymize]\n' +
  'Scope: live-quiz responses, participants, invitations, point corrections only (no practice-quiz / microlearning / group-activity responses).\n' +
  '--pseudonymize replaces direct identifiers (email, sso id, matriculation) with per-run HMAC hashes and redacts free-text answers.'

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CliUsageError'
  }
}

function readOptionValue(
  args: string[],
  index: number,
  option: string
): string {
  const value = args[index + 1]
  if (value == null || value.startsWith('--') || value.trim() === '') {
    throw new CliUsageError(`Missing value for ${option}`)
  }
  return value
}

export function parseExportCourseArgs(args: string[]): {
  courseIds: string[]
  outputDir: string
  pseudonymize: boolean
} {
  const courseIds: string[] = []
  let outputDir = './export-output'
  let outputDirSet = false
  let pseudonymize = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!

    if (arg === '--') {
      continue
    }

    if (arg === '--pseudonymize') {
      pseudonymize = true
      continue
    }

    if (arg === '--courseId') {
      courseIds.push(readOptionValue(args, i, arg))
      i++
      continue
    }

    if (arg === '--outputDir') {
      if (outputDirSet) {
        throw new CliUsageError('Duplicate --outputDir')
      }
      outputDir = readOptionValue(args, i, arg)
      outputDirSet = true
      i++
      continue
    }

    if (arg === '--help' || arg === '-h') {
      throw new CliUsageError(EXPORT_COURSE_USAGE)
    }

    throw new CliUsageError(`Unknown argument: ${arg}`)
  }

  if (courseIds.length === 0) {
    throw new CliUsageError('At least one --courseId is required')
  }

  return { courseIds, outputDir, pseudonymize }
}
