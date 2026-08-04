import { describe, expect, it } from 'vitest'

import {
  CHATBOT_EXPORT_USAGE,
  parseExportChatbotArgs,
} from '../src/chatbotCli.js'
import { CliUsageError } from '../src/cli.js'

describe('chatbot export CLI', () => {
  it('parses, de-duplicates, and sorts repeated chatbot ids', () => {
    expect(
      parseExportChatbotArgs([
        '--',
        '--chatbotId',
        'chatbot-b',
        '--chatbotId',
        'chatbot-a',
        '--chatbotId',
        'chatbot-b',
        '--outputDir',
        '/tmp/export',
      ])
    ).toEqual({
      chatbotIds: ['chatbot-a', 'chatbot-b'],
      outputDir: '/tmp/export',
    })
  })

  it('uses the safe default output directory', () => {
    expect(parseExportChatbotArgs(['--chatbotId', 'chatbot-a'])).toEqual({
      chatbotIds: ['chatbot-a'],
      outputDir: './export-output',
    })
  })

  it.each([
    [[]],
    [['--chatbotId']],
    [['--chatbotId', '--outputDir']],
    [['--unknown']],
    [['--chatbotId', 'chatbot-a', '--outputDir', 'a', '--outputDir', 'b']],
  ])('rejects malformed arguments: %j', (args) => {
    expect(() => parseExportChatbotArgs(args)).toThrow(CliUsageError)
  })

  it('uses the chatbot usage text for help', () => {
    expect(() => parseExportChatbotArgs(['--help'])).toThrow(
      CHATBOT_EXPORT_USAGE
    )
  })
})
