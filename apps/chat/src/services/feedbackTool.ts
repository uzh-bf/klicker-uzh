import { jsonSchema, tool } from 'ai'
import { z } from 'zod'
import { parseMessageDocuments } from '@/src/lib/attachments/documentText'
import {
  CRITERION_STATUSES,
  FEEDBACK_FORMAT,
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
const label = z.string().trim().min(1).max(80)
const comment = z.string().trim().min(1).max(480)

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
    criteria: z
      .array(
        z
          .object({ label, status: z.enum(CRITERION_STATUSES), comment, quote })
          .strict()
      )
      .max(12),
    improvements: z.array(z.object({ label, comment, quote }).strict()).max(5),
    nextStep: z.string().trim().max(320),
  })
  .strict()
  .refine(
    (value) =>
      value.strengths.length +
        value.criteria.length +
        value.improvements.length >
      0,
    {
      message: 'give at least one strength, criterion or improvement',
      path: ['improvements'],
    }
  )

/**
 * Quotes are compared after Unicode normalization and after unifying
 * whitespace, quotation marks, dashes and "ß"/"ss" (Swiss German spelling),
 * and with invisible characters such as soft hyphens from PDFs removed, so a
 * quote that differs only in these still counts as verbatim. Everything else,
 * including case, must match.
 */
export function normalizeForQuote(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„«»″]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim()
}

/** A quote must name a passage, not just a letter or punctuation. */
const MIN_QUOTE_WORD_CHARACTERS = 3

/**
 * The passages a quote may come from: each message's typed text and each
 * attached document on its own, without the markers around documents, so a
 * quote cannot span two passages or include a marker.
 */
function learnerPassages(learnerMessages: readonly string[]): string[] {
  return learnerMessages.flatMap((message) => {
    const { question, documents } = parseMessageDocuments(message)
    return [question, ...documents.map((document) => document.text)].map(
      normalizeForQuote
    )
  })
}

/**
 * Checks the shape and that every quote appears within one passage of the
 * learner's own messages. A quote the
 * learner never wrote is a misquote, which feedback must not show as their
 * words.
 */
export function validateFeedback(
  input: unknown,
  learnerMessages: readonly string[]
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
  const sources = learnerPassages(learnerMessages)
  const errors: string[] = []
  const check = (path: string, value: string) => {
    if (!value) return
    const normalized = normalizeForQuote(value)
    if (
      (normalized.match(/[\p{L}\p{N}]/gu)?.length ?? 0) <
      MIN_QUOTE_WORD_CHARACTERS
    )
      errors.push(
        `${path}: the quote "${value}" is too short to identify a passage; quote a longer passage or use ""`
      )
    else if (!sources.some((source) => source.includes(normalized)))
      errors.push(
        `${path}: the quote "${value}" does not appear verbatim in the learner's messages; copy it exactly or use ""`
      )
  }
  for (const [i, s] of content.strengths.entries())
    check(`strengths.${i}.quote`, s.quote)
  for (const [i, c] of content.criteria.entries())
    check(`criteria.${i}.quote`, c.quote)
  for (const [i, p] of content.improvements.entries())
    check(`improvements.${i}.quote`, p.quote)
  return errors.length > 0
    ? { kind: 'feedback-invalid', errors }
    : { kind: 'feedback', content }
}

export function createShowFeedbackTool({
  learnerMessages,
}: {
  learnerMessages: readonly string[]
}) {
  return tool({
    description: renderPromptTemplate('feedback-card-tool', {}),
    // Not validated by the SDK: `validateFeedback` is the gate and reports
    // errors the model can repair.
    inputSchema: jsonSchema<Record<string, unknown>>(feedbackInputSchema()),
    execute: async (content): Promise<FeedbackToolResult> =>
      validateFeedback(content, learnerMessages),
    toModelOutput: ({ output }) => ({
      type: 'text' as const,
      value:
        output.kind === 'feedback'
          ? 'The feedback is shown to the learner. Do not repeat its content; add at most one short sentence.'
          : `The feedback was not shown. Fix every error and call ${SHOW_FEEDBACK_TOOL_NAME} again with the complete object:\n${output.errors.join('\n')}`,
    }),
  })
}

/** The dialect marker is not part of a tool input schema. */
function feedbackInputSchema(): Parameters<typeof jsonSchema>[0] {
  const { $schema: _dialect, ...schema } = z.toJSONSchema(feedbackSchema)
  return schema as Parameters<typeof jsonSchema>[0]
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
