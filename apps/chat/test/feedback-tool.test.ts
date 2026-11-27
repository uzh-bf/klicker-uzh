import { describe, expect, it } from 'vitest'
import { buildDocumentBlock } from '@/src/lib/attachments/documentText'
import { SHOW_FEEDBACK_TOOL_NAME } from '@/src/lib/feedback'
import { threadToMarkdown } from '@/src/lib/thread-markdown'
import { validateFeedback } from '@/src/services/feedbackTool'

const learnerMessages = [
  'Diversification reduce the risk because returns doesnt move together.',
  'I think its fine.',
]

const improvement = {
  label: 'Agreement',
  quote: 'Diversification reduce the risk',
  comment: 'Check whether the verb agrees with its subject.',
}
const valid = {
  format: 'feedback/1',
  title: '',
  summary: '',
  strengths: [],
  criteria: [],
  improvements: [improvement],
  nextStep: 'Revise the verb forms.',
}

const kindOf = (input: unknown, messages = learnerMessages) =>
  validateFeedback(input, messages).kind

describe('validateFeedback', () => {
  it('accepts quotes that differ only in whitespace, quotation marks, dashes, soft hyphens or ß', () => {
    const messages = [
      '“I think” the risk is große – very large.\nDiversi­fication helps.',
    ]
    const strengths = [
      { text: 'Clear claim.', quote: '"I think" the risk is grosse - very' },
      { text: 'Names the remedy.', quote: 'large. Diversification helps.' },
    ]
    expect(kindOf({ ...valid, improvements: [], strengths }, messages)).toBe(
      'feedback'
    )
  })

  it('rejects a misquote, a quote spanning two messages and a too short quote', () => {
    const misquote = validateFeedback(
      {
        ...valid,
        improvements: [
          { ...improvement, quote: 'Diversification reduces the risk' },
        ],
      },
      learnerMessages
    )
    expect(misquote.kind === 'feedback-invalid' && misquote.errors[0]).toMatch(
      /^improvements\.0\.quote:/
    )
    const spanning = 'move together. I think'
    expect(
      kindOf({ ...valid, improvements: [{ ...improvement, quote: spanning }] })
    ).toBe('feedback-invalid')
    expect(
      kindOf({ ...valid, improvements: [{ ...improvement, quote: 'I' }] })
    ).toBe('feedback-invalid')
  })

  it('accepts quotes from an attached document but not its markers', () => {
    const message = `Please check this.\n\n${buildDocumentBlock({
      name: 'draft.pdf',
      text: 'Markets are efficient.',
      pages: 1,
      shortened: false,
    })}`
    const withQuote = (quote: string) => ({
      ...valid,
      improvements: [{ ...improvement, quote }],
    })
    expect(kindOf(withQuote('Markets are efficient.'), [message])).toBe(
      'feedback'
    )
    expect(kindOf(withQuote('Attached document: draft.pdf'), [message])).toBe(
      'feedback-invalid'
    )
  })

  it('allows sound work with only strengths but needs some feedback and every field', () => {
    const strengthsOnly = {
      ...valid,
      strengths: [{ text: 'The argument is complete.', quote: '' }],
      improvements: [],
      nextStep: '',
    }
    expect(kindOf(strengthsOnly)).toBe('feedback')
    expect(kindOf({ ...strengthsOnly, strengths: [] })).toBe('feedback-invalid')
    const { criteria: _omitted, ...withoutCriteria } = valid
    expect(kindOf(withoutCriteria)).toBe('feedback-invalid')
  })

  it('caps improvements at five while allowing longer rubrics', () => {
    expect(kindOf({ ...valid, improvements: Array(6).fill(improvement) })).toBe(
      'feedback-invalid'
    )
    const criterion = { ...improvement, status: 'met' }
    expect(
      kindOf({
        ...valid,
        improvements: [],
        criteria: Array(10).fill(criterion),
      })
    ).toBe('feedback')
  })
})

describe('feedback cards in text consumers', () => {
  it('keeps the card content in the Markdown export', () => {
    const content = { ...valid, format: 'feedback/1' as const }
    const markdown = threadToMarkdown({
      title: 'Thread',
      labels: { user: 'You', assistant: 'Bot', sources: 'Sources' },
      messages: [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: SHOW_FEEDBACK_TOOL_NAME,
              args: content,
              result: { kind: 'feedback', content },
            },
          ],
        } as never,
      ],
    })
    expect(markdown).toContain(improvement.quote)
    expect(markdown).toContain(improvement.comment)
  })
})
