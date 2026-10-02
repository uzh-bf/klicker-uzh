import { stepReminder } from '@/src/lib/server/calculatorTool'
import { renderPromptTemplate } from '@/src/lib/server/promptTemplates'

type ConversationMessage = {
  role: 'user' | 'assistant'
  content: string
}

type SystemStepMessage = { role: 'system'; content: string }

// A run of six words rarely repeats by chance, but a pasted explanation
// repeats many such runs. The share threshold keeps a short quoted phrase
// inside an otherwise original answer from counting as copied work.
const SHARED_RUN_LENGTH = 6
const MIN_REUSED_WORDS = 12
const MIN_REUSED_SHARE = 0.3
// Values with fewer significant digits, such as 5% or a beta of 1.2, are
// too common to show that the user reused a computed result.
const MIN_SIGNIFICANT_DIGITS = 3
const MAX_LISTED_NUMBERS = 8

const WORD_PATTERN = /[\p{L}\p{N}]+/gu
const NUMBER_PATTERN = /\d{1,3}(?:[,'’]\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?/g

/**
 * Restates the feedback attribution rules at the end of every model step.
 * Like the reply-language reminder, they sit at the end of the step because
 * a rule only in the system prompt loses to the recent conversation it is
 * meant to assess. The Quizzer gets its own check so that attribution rules
 * cannot override its hint and retry rules.
 */
const FEEDBACK_CHECKS: Record<string, string> = {
  tutor: renderPromptTemplate('feedback-check', {}),
  quizzer: renderPromptTemplate('quiz-feedback-check', {}),
}

function words(text: string): string[] {
  return text.normalize('NFKC').toLowerCase().match(WORD_PATTERN) ?? []
}

/**
 * Converts a written number to one canonical form, so that 1,027.80,
 * 1'027.8 and 1027,80 compare equal. A lone comma followed by groups of
 * three digits is a thousands separator; otherwise it is a decimal comma.
 */
export function canonicalNumber(raw: string): string | null {
  let value = raw.replace(/['’]/g, '')
  if (value.includes(',') && value.includes('.')) {
    value = value.replace(/,/g, '')
  } else if (/^\d{1,3}(?:,\d{3})+$/.test(value)) {
    value = value.replace(/,/g, '')
  } else {
    value = value.replace(',', '.')
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  const canonical = String(parsed)
  const significantDigits = canonical.replace(/\D/g, '').replace(/^0+/, '')
  return significantDigits.length >= MIN_SIGNIFICANT_DIGITS ? canonical : null
}

function numbers(text: string): Set<string> {
  const found = new Set<string>()
  for (const match of text.match(NUMBER_PATTERN) ?? []) {
    const canonical = canonicalNumber(match)
    if (canonical) found.add(canonical)
  }
  return found
}

/**
 * Measures how much of the latest user message repeats earlier assistant
 * responses: the share of its words that fall inside shared six-word runs,
 * and the significant values it takes from those responses that no earlier
 * user message contained. Both measures are language-independent.
 */
export function measureReusedContent(messages: ConversationMessage[]): {
  reusedShare: number
  reusedNumbers: string[]
} {
  const latestIndex = messages.findLastIndex((m) => m.role === 'user')
  if (latestIndex <= 0) return { reusedShare: 0, reusedNumbers: [] }
  const earlier = messages.slice(0, latestIndex)
  const latest = messages[latestIndex]!.content

  const assistantRuns = new Set<string>()
  const assistantNumbers = new Set<string>()
  const userNumbers = new Set<string>()
  for (const message of earlier) {
    if (message.role === 'user') {
      for (const n of numbers(message.content)) userNumbers.add(n)
      continue
    }
    for (const n of numbers(message.content)) assistantNumbers.add(n)
    const tokens = words(message.content)
    for (let i = 0; i + SHARED_RUN_LENGTH <= tokens.length; i++) {
      assistantRuns.add(tokens.slice(i, i + SHARED_RUN_LENGTH).join(' '))
    }
  }

  const tokens = words(latest)
  const covered = new Array<boolean>(tokens.length).fill(false)
  for (let i = 0; i + SHARED_RUN_LENGTH <= tokens.length; i++) {
    if (assistantRuns.has(tokens.slice(i, i + SHARED_RUN_LENGTH).join(' '))) {
      covered.fill(true, i, i + SHARED_RUN_LENGTH)
    }
  }
  const coveredCount = covered.filter(Boolean).length
  const reusedShare =
    coveredCount >= MIN_REUSED_WORDS &&
    coveredCount / tokens.length >= MIN_REUSED_SHARE
      ? coveredCount / tokens.length
      : 0

  const reusedNumbers = [...numbers(latest)].filter(
    (n) => assistantNumbers.has(n) && !userNumbers.has(n)
  )
  return { reusedShare, reusedNumbers }
}

/**
 * Builds the single system message that ends every model step. Feedback
 * modes get the reuse evidence and their feedback check before the
 * calculator and reply-language reminders, which stay last in the same
 * message because separate trailing system messages weakened them in
 * evaluation runs.
 */
export function trailingStepMessage(
  chatMode: string,
  messages: ConversationMessage[]
): SystemStepMessage {
  const reminder = stepReminder(chatMode)
  const feedbackCheck = FEEDBACK_CHECKS[chatMode]
  if (!feedbackCheck) return reminder
  const parts: string[] = []
  const { reusedShare, reusedNumbers } = measureReusedContent(messages)
  if (reusedShare > 0 || reusedNumbers.length > 0) {
    parts.push(
      renderPromptTemplate('feedback-evidence', {
        reusedSharePercent: Math.round(reusedShare * 100),
        reusedNumbers: reusedNumbers.slice(0, MAX_LISTED_NUMBERS).join(', '),
      })
    )
  }
  parts.push(feedbackCheck, reminder.content)
  return { role: 'system', content: parts.join('\n\n') }
}
