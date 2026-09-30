import { renderPromptTemplate } from '@/src/lib/server/promptTemplates'

/**
 * Appended to every chatbot system prompt so the response language follows
 * the user rather than the language of the persona or retrieved material.
 * This cannot live only in `DEFAULT_PROMPT`: standard-mode lecturer guidance
 * and custom personas are separate prompt layers, and neither owns platform
 * language policy.
 */
const LANGUAGE_STYLE_CONTRACT = renderPromptTemplate('language-style', {})

/**
 * Appends the conversation-language and Swiss Standard German contract to
 * `systemPrompt`. It is unconditional because it must survive every stored
 * lecturer prompt and does not depend on which tools are available.
 */
export function withLanguageStyleContract(systemPrompt: string): string {
  const trimmedBase = systemPrompt.trimEnd()
  return trimmedBase.length > 0
    ? `${trimmedBase}\n\n${LANGUAGE_STYLE_CONTRACT}`
    : LANGUAGE_STYLE_CONTRACT
}

export type ReplyLanguage = 'en' | 'de'

const REPLY_LANGUAGE_NAMES: Record<ReplyLanguage, string> = {
  en: 'English',
  de: 'German',
}

// High-frequency function words that are distinctive for one language. Words
// shared across both (e.g. "in", "was", "will", "an", "also") are omitted so a
// single borrowed term cannot flip the result.
const LANGUAGE_MARKERS: Record<ReplyLanguage, ReadonlySet<string>> = {
  en: new Set(
    'the and is are you your my i it this that what how why with for of to can could please thanks thank does do not be if or but have has would should which me we there answer question explain'.split(
      ' '
    )
  ),
  de: new Set(
    'der die das und ist nicht ich du dich dir mir mich mein meine dein deine mit für ein eine einen einem auf zu wie warum sind wird auch bei den dem des es kann kannst habe hast bitte danke noch oder aber wenn dass ob sie wir ihr von nach frage antwort stimmt richtig erkläre erklären bedeutet ja nein bin hat gibt welche welcher'.split(
      ' '
    )
  ),
}

const MIN_MARKERS = 2

/**
 * Detects English or German from one message, ignoring code and
 * double-quoted spans so quoted source text does not decide the language.
 * Returns null unless one language has at least two markers and twice the
 * other's count; callers then fall back to earlier messages or the prompt
 * policy alone.
 */
export function detectMessageLanguage(text: string): ReplyLanguage | null {
  const ownText = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/"[^"]*"|“[^”]*”|„[^“”]*[“”]|«[^»]*»/g, ' ')
    .replace(/^>.*$/gm, ' ')
    .toLowerCase()
  const words = ownText.match(/\p{L}+/gu) ?? []
  const counts = { en: 0, de: 0 }
  for (const word of words) {
    if (LANGUAGE_MARKERS.en.has(word)) counts.en += 1
    if (LANGUAGE_MARKERS.de.has(word)) counts.de += 1
    else if (/[äöüß]/.test(word)) counts.de += 1
  }
  if (counts.en >= MIN_MARKERS && counts.en >= 2 * counts.de) return 'en'
  if (counts.de >= MIN_MARKERS && counts.de >= 2 * counts.en) return 'de'
  return null
}

/**
 * Resolves the reply language from user messages, newest first, so a short
 * acknowledgement keeps the established conversation language.
 */
export function resolveReplyLanguage(
  userMessages: readonly string[]
): ReplyLanguage | null {
  for (let index = userMessages.length - 1; index >= 0; index -= 1) {
    const language = detectMessageLanguage(userMessages[index] ?? '')
    if (language) return language
  }
  return null
}

/**
 * Builds the per-request reply-language lock. The chat route appends it as the
 * last message of every model step, after retrieved passages and tool output,
 * because a rule that only lives in the system prompt loses to long
 * other-language material read just before the answer.
 */
export function replyLanguageLockMessage(language: ReplyLanguage): {
  role: 'system'
  content: string
} {
  return {
    role: 'system',
    content: renderPromptTemplate('reply-language-lock', {
      language: REPLY_LANGUAGE_NAMES[language],
    }),
  }
}
