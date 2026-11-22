/** Shared by the chat route and the message UI; no server imports. */
export const SHOW_FEEDBACK_TOOL_NAME = 'show_feedback'
export const FEEDBACK_FORMAT = 'feedback/1'

/** Attempts per turn, counting the first call and two repairs. */
export const MAX_FEEDBACK_ATTEMPTS = 3

export const CRITERION_STATUSES = ['met', 'partial', 'missing'] as const
export type CriterionStatus = (typeof CRITERION_STATUSES)[number]

/** An empty quote means none. */
export type FeedbackStrength = { text: string; quote: string }

/** A requirement from a list the learner or the task gives, such as a rubric. */
export type FeedbackCriterion = {
  label: string
  status: CriterionStatus
  comment: string
  quote: string
}

/** Something to work on, most important first. */
export type FeedbackImprovement = {
  label: string
  comment: string
  quote: string
}

/**
 * Mode-agnostic structured feedback on work the learner shared: a text, a
 * solution, a calculation or an answer. Each mode's prompt decides what the
 * comments may contain; this shape only fixes the layout. Every field is
 * always present, with empty strings or lists for "none", so the shape is the
 * same whether or not the provider enforces strict tool schemas.
 */
export type FeedbackContent = {
  format: typeof FEEDBACK_FORMAT
  title: string
  summary: string
  strengths: FeedbackStrength[]
  criteria: FeedbackCriterion[]
  improvements: FeedbackImprovement[]
  nextStep: string
}

export type FeedbackToolResult =
  | { kind: 'feedback'; content: FeedbackContent }
  | { kind: 'feedback-invalid'; errors: string[] }

export function asFeedbackResult(value: unknown): FeedbackToolResult | null {
  const v =
    value && typeof value === 'object' && 'result' in value
      ? (value as { result: unknown }).result
      : value
  if (!v || typeof v !== 'object' || !('kind' in v)) return null
  const result = v as {
    kind: unknown
    content?: Partial<Record<keyof FeedbackContent, unknown>>
  }
  if (result.kind === 'feedback-invalid') return v as FeedbackToolResult
  // Stored payloads of another shape or format version are not rendered as
  // this card.
  const content = result.content
  return result.kind === 'feedback' &&
    content?.format === FEEDBACK_FORMAT &&
    Array.isArray(content.strengths) &&
    Array.isArray(content.criteria) &&
    Array.isArray(content.improvements)
    ? (v as FeedbackToolResult)
    : null
}

export type FeedbackTextLabels = {
  strengths: string
  criteria: string
  improvements: string
  nextStep: string
  status: Record<CriterionStatus, string>
}

/** Labels for the model's own conversation history, which is not localized. */
export const FEEDBACK_HISTORY_LABELS: FeedbackTextLabels = {
  strengths: 'What already works',
  criteria: 'Criteria checked',
  improvements: 'Points to work on',
  nextStep: 'Next step',
  status: { met: 'met', partial: 'partly met', missing: 'missing' },
}

/**
 * Plain-text rendering of a feedback card for copying, the Markdown export
 * and the model's conversation history, which otherwise see only the short
 * reply around the card.
 */
export function feedbackToText(
  content: FeedbackContent,
  labels: FeedbackTextLabels
): string {
  const quoted = (quote: string) => (quote ? ` "${quote}"` : '')
  const lines: string[] = []
  if (content.title) lines.push(content.title)
  if (content.summary) lines.push(content.summary)
  if (content.strengths.length) {
    lines.push('', `${labels.strengths}:`)
    for (const strength of content.strengths)
      lines.push(`- ${strength.text}${quoted(strength.quote)}`)
  }
  if (content.criteria.length) {
    lines.push('', `${labels.criteria}:`)
    for (const criterion of content.criteria)
      lines.push(
        `- ${criterion.label} (${labels.status[criterion.status]}):${quoted(criterion.quote)} ${criterion.comment}`
      )
  }
  if (content.improvements.length) {
    lines.push('', `${labels.improvements}:`)
    content.improvements.forEach((point, index) => {
      lines.push(
        `${index + 1}. ${point.label}:${quoted(point.quote)} ${point.comment}`
      )
    })
  }
  if (content.nextStep)
    lines.push('', `${labels.nextStep}: ${content.nextStep}`)
  return lines.join('\n').trim()
}

/**
 * The text of a valid feedback card in a message part, or null for any other
 * part. Lets text-only consumers include the card.
 */
export function feedbackPartText(
  part: unknown,
  labels: FeedbackTextLabels
): string | null {
  if (!part || typeof part !== 'object') return null
  const { type, toolName, result } = part as {
    type?: unknown
    toolName?: unknown
    result?: unknown
  }
  if (type !== 'tool-call' || toolName !== SHOW_FEEDBACK_TOOL_NAME) return null
  const parsed = asFeedbackResult(result)
  return parsed?.kind === 'feedback'
    ? feedbackToText(parsed.content, labels)
    : null
}
