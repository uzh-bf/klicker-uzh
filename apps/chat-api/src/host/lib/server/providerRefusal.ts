import type { Locale } from '@klicker-uzh/prisma/client'
import type {
  LanguageModelUsage,
  StreamTextTransform,
  TextStreamPart,
  ToolSet,
  UIMessage,
} from 'ai'

// Platform-owned replacement for a canned provider refusal. It neither
// confirms nor describes the protected instructions.
export const PROVIDER_REFUSAL_DEFLECTION: Record<Locale, string> = {
  en: "Let's stay with the current activity. How would you like to continue?",
  de: 'Bleiben wir bei der aktuellen Aufgabe. Wie möchtest du weitermachen?',
}

// A canned refusal is one short sentence. Text beyond this length is released
// so a genuine answer only waits for its first few words.
const MAX_HELD_TEXT_LENGTH = 120

// Short function words that rarely occur in the other language. The learner's
// message decides only when its markers clearly lean one way.
const GERMAN_MARKERS = new Set([
  'auch',
  'auf',
  'bitte',
  'das',
  'dass',
  'dem',
  'den',
  'der',
  'die',
  'du',
  'ein',
  'eine',
  'ich',
  'ist',
  'kannst',
  'mein',
  'meine',
  'mit',
  'nicht',
  'oder',
  'sich',
  'sie',
  'und',
  'von',
  'wie',
  'wir',
  'zu',
])
const ENGLISH_MARKERS = new Set([
  'also',
  'and',
  'can',
  'for',
  'how',
  'is',
  'it',
  'my',
  'not',
  'of',
  'or',
  'please',
  'that',
  'the',
  'this',
  'to',
  'we',
  'what',
  'with',
  'you',
])

/**
 * German or English when the text's function words clearly lean that way,
 * otherwise null. German letters count as one German marker.
 */
export function inferMessageLanguage(
  text: string | null | undefined
): Locale | null {
  if (!text) return null
  const words = text.toLowerCase().match(/[a-zäöüß]+/g) ?? []
  let german = /[äöüß]/i.test(text) ? 1 : 0
  let english = 0
  for (const word of words) {
    if (GERMAN_MARKERS.has(word)) german += 1
    if (ENGLISH_MARKERS.has(word)) english += 1
  }
  if (german >= 2 && german > english) return 'de'
  if (english >= 2 && english > german) return 'en'
  return null
}

/** Text of the latest message when the learner sent it, otherwise null. */
export function latestUserText(messages: readonly UIMessage[]): string | null {
  const latest = messages.at(-1)
  if (latest?.role !== 'user') return null
  return latest.parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join(' ')
}

/**
 * The deflection in the mode's locked reply language, otherwise in the
 * language of the learner's latest message, otherwise in the participant's
 * interface language, otherwise in English.
 */
export function providerRefusalDeflection(
  lockedLanguage: Locale | null,
  latestUserText: string | null,
  interfaceLocale: string | undefined
): string {
  if (lockedLanguage) return PROVIDER_REFUSAL_DEFLECTION[lockedLanguage]
  const messageLanguage = inferMessageLanguage(latestUserText)
  if (messageLanguage) return PROVIDER_REFUSAL_DEFLECTION[messageLanguage]
  return interfaceLocale === 'de'
    ? PROVIDER_REFUSAL_DEFLECTION.de
    : PROVIDER_REFUSAL_DEFLECTION.en
}

/**
 * A step that returned text while reporting exactly zero input and output tokens
 * never reached the model: inference always reads the prompt. A provider or
 * gateway safety layer answers some requests this way, with a generic
 * refusal sentence, before the mode instructions apply.
 */
export function isUnbilledProviderReply(usage: LanguageModelUsage): boolean {
  return usage.inputTokens === 0 && usage.outputTokens === 0
}

/**
 * Replaces a step's text with `deflection` when the step turns out to be an
 * unbilled provider reply, so a chat mode never shows the provider's generic
 * refusal and a persona never breaks role. Only a step's text is held, and
 * only until the step finishes, the model streams reasoning or calls a tool,
 * or the held text exceeds a canned sentence; each of those proves a genuine
 * answer and releases the text unchanged. Other parts pass through at once.
 */
export function providerRefusalTransform<TOOLS extends ToolSet>(
  deflection: string,
  onSubstitute?: (finish: {
    finishReason: string
    rawFinishReason: string | undefined
  }) => void
): StreamTextTransform<TOOLS> {
  return () => {
    let held: TextStreamPart<TOOLS>[] | null = null
    let heldTextLength = 0

    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(part, controller) {
        if (part.type === 'start-step') {
          held = []
          heldTextLength = 0
          controller.enqueue(part)
          return
        }
        if (held === null) {
          controller.enqueue(part)
          return
        }

        if (part.type === 'finish-step') {
          const parts = held
          held = null
          const hasText = parts.some(
            (p) => p.type === 'text-delta' && p.text.length > 0
          )
          if (hasText && isUnbilledProviderReply(part.usage)) {
            onSubstitute?.({
              finishReason: part.finishReason,
              rawFinishReason: part.rawFinishReason,
            })
            let replaced = false
            for (const p of parts) {
              if (p.type !== 'text-delta') {
                controller.enqueue(p)
              } else if (!replaced) {
                replaced = true
                controller.enqueue({ ...p, text: deflection })
              }
            }
          } else {
            for (const p of parts) controller.enqueue(p)
          }
          controller.enqueue(part)
          return
        }

        const isText =
          part.type === 'text-start' ||
          part.type === 'text-delta' ||
          part.type === 'text-end'
        if (!isText) {
          const provesGenuineAnswer =
            (part.type === 'reasoning-delta' && part.text.length > 0) ||
            part.type === 'tool-input-start' ||
            part.type === 'tool-call'
          if (provesGenuineAnswer) {
            for (const p of held) controller.enqueue(p)
            held = null
          }
          controller.enqueue(part)
          return
        }

        held.push(part)
        if (part.type === 'text-delta') heldTextLength += part.text.length
        if (heldTextLength > MAX_HELD_TEXT_LENGTH) {
          for (const p of held) controller.enqueue(p)
          held = null
        }
      },
      flush(controller) {
        if (held) for (const p of held) controller.enqueue(p)
      },
    })
  }
}
