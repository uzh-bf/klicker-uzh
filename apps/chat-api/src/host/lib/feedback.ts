/** Shared by the chat route and the message UI; no server imports. */
import { parseMessageDocuments } from './attachments/documentText.js'

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

/**
 * The content of a message in the model's conversation history: its text
 * parts plus the text of any valid feedback card, which carries the substance
 * of its turn so later turns can refer back to it. The client builds the
 * history with this and the server checks stored history against it, so both
 * must use this one projection.
 */
export function historyTextFromParts(parts: readonly unknown[]): string {
  return parts
    .map((part) => {
      const card = feedbackPartText(part, FEEDBACK_HISTORY_LABELS)
      if (card !== null) return `\n[Feedback card shown]\n${card}\n`
      const { type, text } = (part ?? {}) as { type?: unknown; text?: unknown }
      return type === 'text' && typeof text === 'string' ? text : ''
    })
    .join('')
}

/**
 * Quotes are compared after Unicode normalization and after unifying
 * whitespace, quotation marks, dashes and "ß"/"ss" (Swiss German spelling),
 * and with invisible characters such as soft hyphens from PDFs removed, so a
 * quote that differs only in these still counts as verbatim. Everything else,
 * including case, must match.
 */
export function normalizeForQuote(text: string): string {
  return unifyQuoteCharacters(text).replace(/\s+/g, ' ').trim()
}

/**
 * The per-character part of `normalizeForQuote`, without the whitespace
 * collapse, so the offset map below can apply it per cluster.
 */
function unifyQuoteCharacters(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„«»″]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\u00DF/g, 'ss')
}

/** A quote must name a passage, not just a letter or punctuation. */
export const MIN_QUOTE_WORD_CHARACTERS = 3

/**
 * The passages a quote may come from: each message's typed text and each
 * attached document on its own, without the markers around documents, so a
 * quote cannot span two passages or include a marker.
 */
export function learnerPassages(learnerMessages: readonly string[]): string[] {
  return learnerMessages.flatMap((message) => {
    const { question, documents } = parseMessageDocuments(message)
    return [question, ...documents.map((document) => document.text)]
  })
}

/**
 * Maps each character of `normalizeForQuote(raw)` back to the raw range it
 * came from, so a quote matched in normalized text can be marked in the text
 * as the learner wrote it. Characters are normalized per cluster (a base
 * character with its combining marks), which agrees with normalizing the
 * whole text except in rare compositions; a span that does not normalize back
 * to its quote is treated as not found.
 */
function normalizeWithOffsets(raw: string): {
  text: string
  starts: number[]
  ends: number[]
} {
  let text = ''
  let trailingSpace = false
  const starts: number[] = []
  const ends: number[] = []
  for (const match of raw.matchAll(/\P{M}\p{M}*|\p{M}+/gu)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    const piece = unifyQuoteCharacters(match[0])
    for (const char of piece) {
      const space = /\s/.test(char)
      // Leading whitespace is trimmed and runs collapse to one space.
      if (space && (text === '' || trailingSpace)) continue
      for (let unit = 0; unit < char.length; unit++) {
        starts.push(start)
        ends.push(end)
      }
      text += space ? ' ' : char
      trailingSpace = space
    }
  }
  if (trailingSpace) {
    text = text.slice(0, -1)
    starts.pop()
    ends.pop()
  }
  return { text, starts, ends }
}

/** A quote's place in a raw text, as UTF-16 offsets. */
export type QuoteSpan = { start: number; end: number }

/**
 * Where a quote occurs in a learner's text, using the same comparison as the
 * server's quote check, or null when it does not occur or is too short to
 * name a passage. The first occurrence wins.
 */
export function locateQuote(raw: string, quote: string): QuoteSpan | null {
  return locateInMapped(raw, normalizeWithOffsets(raw), quote)
}

function locateInMapped(
  raw: string,
  mapped: ReturnType<typeof normalizeWithOffsets>,
  quote: string
): QuoteSpan | null {
  const needle = normalizeForQuote(quote)
  if ((needle.match(/[\p{L}\p{N}]/gu)?.length ?? 0) < MIN_QUOTE_WORD_CHARACTERS)
    return null
  const index = mapped.text.indexOf(needle)
  if (index === -1) return null
  const start = mapped.starts[index]
  const end = mapped.ends[index + needle.length - 1]
  if (start === undefined || end === undefined) return null
  const span = { start, end }
  return normalizeForQuote(raw.slice(span.start, span.end)) === needle
    ? span
    : null
}

export type FeedbackItemKind = 'strength' | 'criterion' | 'improvement'

/** One remark of a feedback card, in the card's own order within its kind. */
export type FeedbackItem = {
  id: string
  kind: FeedbackItemKind
  /** Position within its kind, from 0. */
  index: number
  label: string
  comment: string
  quote: string
  status?: CriterionStatus
}

export function feedbackItems(content: FeedbackContent): FeedbackItem[] {
  return [
    ...content.improvements.map((point, index) => ({
      id: `improvement-${index}`,
      kind: 'improvement' as const,
      index,
      label: point.label,
      comment: point.comment,
      quote: point.quote,
    })),
    ...content.criteria.map((criterion, index) => ({
      id: `criterion-${index}`,
      kind: 'criterion' as const,
      index,
      label: criterion.label,
      comment: criterion.comment,
      quote: criterion.quote,
      status: criterion.status,
    })),
    ...content.strengths.map((strength, index) => ({
      id: `strength-${index}`,
      kind: 'strength' as const,
      index,
      label: '',
      comment: strength.text,
      quote: strength.quote,
    })),
  ]
}

/** A stretch of the learner's text and the remarks that cover it. */
export type AnnotatedSegment = { text: string; itemIds: string[] }

/** A run of adjacent paragraphs shown from the reviewed text. */
export type AnnotatedBlock = {
  /** Whether paragraphs of the text are left out before this block. */
  gapBefore: boolean
  segments: AnnotatedSegment[]
}

export type FeedbackAnnotation = {
  blocks: AnnotatedBlock[]
  /** Whether paragraphs are left out after the last block. */
  gapAfter: boolean
  /**
   * Remarks with a quote found in the text, in text order. Remarks that quote
   * the same passage form one group, which is selected and stepped as one.
   */
  anchored: string[][]
  /** Remarks without a quote or with one not found, in card order. */
  unanchored: string[]
}

/**
 * Places the card's quotes in the learner's text: the passage (a typed
 * message or an attached document, see `learnerPassages`) that contains most
 * quotes, the latest on a tie. Only paragraphs with a quote are shown, so instructions or a rubric
 * around the work stay out. Returns null when no quote is found, which leaves
 * the card in its list layout.
 */
export function annotateFeedback(
  items: readonly FeedbackItem[],
  passages: readonly string[]
): FeedbackAnnotation | null {
  const quoted = items.filter((item) => item.quote)
  if (quoted.length === 0) return null
  let best: { passage: string; spans: Map<string, QuoteSpan> } | null = null
  for (const passage of passages) {
    const mapped = normalizeWithOffsets(passage)
    const spans = new Map<string, QuoteSpan>()
    for (const item of quoted) {
      const span = locateInMapped(passage, mapped, item.quote)
      if (span) spans.set(item.id, span)
    }
    if (spans.size > 0 && spans.size >= (best?.spans.size ?? 0))
      best = { passage, spans }
  }
  if (!best) return null
  const { passage, spans } = best

  // Paragraphs are separated by blank lines. A quote that runs across one
  // marks both paragraphs, which then join into one block.
  const paragraphs: QuoteSpan[] = []
  let from = 0
  for (const match of passage.matchAll(/\n[^\S\n]*\n\s*/g)) {
    paragraphs.push({ start: from, end: match.index ?? 0 })
    from = (match.index ?? 0) + match[0].length
  }
  paragraphs.push({ start: from, end: passage.length })
  // Blank lines around the text are not text left out.
  const hasText = (paragraph: QuoteSpan) =>
    passage.slice(paragraph.start, paragraph.end).trim() !== ''
  const ranges: Array<QuoteSpan & { first: number; last: number }> = []
  paragraphs.forEach((paragraph, index) => {
    const marked = Array.from(spans.values()).some(
      (span) => span.start < paragraph.end && span.end > paragraph.start
    )
    if (!marked) return
    const previous = ranges[ranges.length - 1]
    if (previous?.last === index - 1) {
      previous.end = paragraph.end
      previous.last = index
    } else ranges.push({ ...paragraph, first: index, last: index })
  })

  const blocks = ranges.map((range) => {
    const inside = Array.from(spans.entries()).filter(
      ([, span]) => span.start >= range.start && span.end <= range.end
    )
    const cuts = new Set([range.start, range.end])
    for (const [, span] of inside) {
      cuts.add(span.start)
      cuts.add(span.end)
    }
    const points = Array.from(cuts).sort((a, b) => a - b)
    const segments: AnnotatedSegment[] = []
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i]!
      const end = points[i + 1]!
      const itemIds = inside
        .filter(([, span]) => span.start <= start && span.end >= end)
        .map(([id]) => id)
      const text = passage.slice(start, end)
      const last = segments[segments.length - 1]
      if (last && last.itemIds.join() === itemIds.join()) last.text += text
      else if (text) segments.push({ text, itemIds })
    }
    return {
      gapBefore: paragraphs
        .slice(0, range.first)
        .some((paragraph) => hasText(paragraph)),
      segments,
    }
  })

  const anchored: string[][] = []
  let previousSpan: QuoteSpan | null = null
  for (const [id, span] of Array.from(spans.entries()).sort(
    ([, a], [, b]) => a.start - b.start || b.end - a.end
  )) {
    const last = anchored.at(-1)
    if (
      last &&
      previousSpan?.start === span.start &&
      previousSpan.end === span.end
    )
      last.push(id)
    else anchored.push([id])
    previousSpan = span
  }
  return {
    blocks,
    gapAfter: paragraphs
      .slice((ranges[ranges.length - 1]?.last ?? 0) + 1)
      .some((paragraph) => hasText(paragraph)),
    anchored,
    unanchored: items
      .filter((item) => !spans.has(item.id))
      .map((item) => item.id),
  }
}
