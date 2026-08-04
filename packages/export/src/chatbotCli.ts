import { CliUsageError } from './cli.js'

export const CHATBOT_EXPORT_USAGE =
  'Usage: pnpm --filter @klicker-uzh/export export:chatbots -- --chatbotId <id> [--chatbotId <id2> ...] [--outputDir <path>]\n' +
  'Writes one nested, pseudonymized JSON file for AI evaluation. Message text and attachment descriptions remain unchanged.'

export class CliHelpError extends CliUsageError {
  constructor() {
    super(CHATBOT_EXPORT_USAGE)
    this.name = 'CliHelpError'
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

export function parseExportChatbotArgs(args: string[]): {
  chatbotIds: string[]
  outputDir: string
} {
  const chatbotIds = new Set<string>()
  let outputDir = './export-output'
  let outputDirSet = false

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!

    if (arg === '--') {
      continue
    }

    if (arg === '--chatbotId') {
      chatbotIds.add(readOptionValue(args, index, arg))
      index++
      continue
    }

    if (arg === '--outputDir') {
      if (outputDirSet) {
        throw new CliUsageError('Duplicate --outputDir')
      }
      outputDir = readOptionValue(args, index, arg)
      outputDirSet = true
      index++
      continue
    }

    if (arg === '--help' || arg === '-h') {
      throw new CliHelpError()
    }

    throw new CliUsageError(`Unknown argument: ${arg}`)
  }

  if (chatbotIds.size === 0) {
    throw new CliUsageError('At least one --chatbotId is required')
  }

  return { chatbotIds: [...chatbotIds].sort(), outputDir }
}
