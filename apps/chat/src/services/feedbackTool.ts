import { jsonSchema, tool } from 'ai'
import { z } from 'zod'
import {
  FEEDBACK_FORMAT,
  FEEDBACK_STATUSES,
  type FeedbackContent,
  type FeedbackToolResult,
  MAX_FEEDBACK_ATTEMPTS,
  SHOW_FEEDBACK_TOOL_NAME,
} from '@/src/lib/feedback'
import { renderPromptTemplate } from '@/src/lib/server/promptTemplates'

/** Standard modes in which learners ask for feedback on their own work. */
const FEEDBACK_MODES = new Set(['tutor', 'quizzer', 'writing-coach'])

export function isFeedbackToolEnabled(chatMode: string): boolean {
  return process.env.CHAT_FEEDBACK_TOOL === '1' && FEEDBACK_MODES.has(chatMode)
}

const quote = z.string().trim().max(200)

const feedbackSchema = z
  .object({
    format: z.literal(FEEDBACK_FORMAT),
    title: z.string().trim().max(80),
    summary: z.string().trim().max(400),
    strengths: z
      .array(
        z.object({ text: z.string().trim().min(1).max(240), quote }).strict()
      )
      .max(3),
    points: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(48),
            comment: z.string().trim().min(1).max(480),
            quote,
            status: z.enum(FEEDBACK_STATUSES),
          })
          .strict()
      )
      .min(1)
      .max(8),
    nextStep: z.string().trim().min(1).max(320),
  })
  .strict()
  .refine(
    (value) =>
      value.points.filter((point) => point.status === 'improve').length <= 5,
    { message: 'give at most 5 points with status "improve"', path: ['points'] }
  )

/**
 * Quotes are compared after unifying whitespace and quotation marks, so a
 * quote that only differs in line breaks or typographic quotes still counts
 * as verbatim. Everything else, including case, must match.
 */
function normalizeForQuote(text: string): string {
  return text
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„«»″]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Checks the shape and that every quote appears in the learner's own
 * messages. A quote the learner never wrote is a misquote, which feedback
 * must not show as their words.
 */
export function validateFeedback(
  input: unknown,
  learnerText: string
): FeedbackToolResult {
  const parsed = feedbackSchema.safeParse(input)
  if (!parsed.success) {
    return {
      kind: 'feedback-invalid',
      errors: parsed.error.issues
        .slice(0, 10)
        .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`),
    }
  }
  const content = parsed.data as FeedbackContent
  const source = normalizeForQuote(learnerText)
  const errors: string[] = []
  const check = (path: string, value?: string) => {
    if (value && !source.includes(normalizeForQuote(value)))
      errors.push(
        `${path}: the quote "${value}" does not appear verbatim in the learner's messages; copy it exactly or leave it out`
      )
  }
  for (const [i, s] of content.strengths.entries())
    check(`strengths.${i}.quote`, s.quote)
  for (const [i, p] of content.points.entries())
    check(`points.${i}.quote`, p.quote)
  return errors.length > 0
    ? { kind: 'feedback-invalid', errors }
    : { kind: 'feedback', content }
}

export function createShowFeedbackTool({
  learnerText,
}: {
  learnerText: string
}) {
  return tool({
    description: renderPromptTemplate('feedback-card-tool', {}),
    // Not validated by the SDK: `validateFeedback` is the gate and reports
    // errors the model can repair.
    inputSchema: jsonSchema<Record<string, unknown>>(
      z.toJSONSchema(feedbackSchema) as Parameters<typeof jsonSchema>[0]
    ),
    execute: async (content): Promise<FeedbackToolResult> =>
      validateFeedback(content, learnerText),
    toModelOutput: ({ output }) => ({
      type: 'text' as const,
      value:
        output.kind === 'feedback'
          ? 'The feedback is shown to the learner. Do not repeat its content; add at most one short sentence.'
          : `The feedback was not shown. Fix every error and call ${SHOW_FEEDBACK_TOOL_NAME} again with the complete object:\n${output.errors.join('\n')}`,
    }),
  })
}

type StepPart = { type: string; toolName?: string; output?: unknown }

/**
 * After the cap the tool is withdrawn, so a model that cannot reach valid
 * feedback answers in text.
 */
export function feedbackAttemptsLeft(
  steps: ReadonlyArray<{ content: ReadonlyArray<StepPart> }>
): boolean {
  let failed = 0
  for (const step of steps)
    for (const part of step.content) {
      if (part.toolName !== SHOW_FEEDBACK_TOOL_NAME) continue
      if (
        part.type === 'tool-error' ||
        (part.type === 'tool-result' &&
          (part.output as { kind?: string } | undefined)?.kind ===
            'feedback-invalid')
      )
        failed++
    }
  return failed < MAX_FEEDBACK_ATTEMPTS
}
