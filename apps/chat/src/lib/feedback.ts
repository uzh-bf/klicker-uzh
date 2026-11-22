/** Shared by the chat route and the message UI; no server imports. */
export const SHOW_FEEDBACK_TOOL_NAME = 'show_feedback'
export const FEEDBACK_FORMAT = 'feedback/1'

/** Attempts per turn, counting the first call and two repairs. */
export const MAX_FEEDBACK_ATTEMPTS = 3

/**
 * `improve` marks something to work on; the others report a requirement the
 * learner or the task listed, such as a rubric item.
 */
export const FEEDBACK_STATUSES = [
  'improve',
  'met',
  'partial',
  'missing',
] as const
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]
export type CriterionStatus = Exclude<FeedbackStatus, 'improve'>

/** An empty quote means none. */
export type FeedbackStrength = { text: string; quote: string }

export type FeedbackPoint = {
  label: string
  comment: string
  quote: string
  status: FeedbackStatus
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
  points: FeedbackPoint[]
  nextStep: string
}

export function splitFeedbackPoints(points: FeedbackPoint[]) {
  return {
    criteria: points.filter(
      (point): point is FeedbackPoint & { status: CriterionStatus } =>
        point.status !== 'improve'
    ),
    improvements: points.filter((point) => point.status === 'improve'),
  }
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
  const kind = (v as { kind: unknown }).kind
  return kind === 'feedback' || kind === 'feedback-invalid'
    ? (v as FeedbackToolResult)
    : null
}

/**
 * Plain-text rendering of a feedback card for copying and other text
 * consumers, which otherwise see only the short reply around the card.
 */
export function feedbackToText(
  content: FeedbackContent,
  labels: {
    strengths: string
    criteria: string
    points: string
    nextStep: string
    status: Record<CriterionStatus, string>
  }
): string {
  const quoted = (quote: string) => (quote ? ` "${quote}"` : '')
  const { criteria, improvements } = splitFeedbackPoints(content.points)
  const lines: string[] = []
  if (content.title) lines.push(content.title)
  if (content.summary) lines.push(content.summary)
  if (content.strengths.length) {
    lines.push('', `${labels.strengths}:`)
    for (const strength of content.strengths)
      lines.push(`- ${strength.text}${quoted(strength.quote)}`)
  }
  if (criteria.length) {
    lines.push('', `${labels.criteria}:`)
    for (const criterion of criteria)
      lines.push(
        `- ${criterion.label} (${labels.status[criterion.status]}):${quoted(criterion.quote)} ${criterion.comment}`
      )
  }
  if (improvements.length) {
    lines.push('', `${labels.points}:`)
    improvements.forEach((point, index) => {
      lines.push(
        `${index + 1}. ${point.label}:${quoted(point.quote)} ${point.comment}`
      )
    })
  }
  lines.push('', `${labels.nextStep}: ${content.nextStep}`)
  return lines.join('\n').trim()
}
