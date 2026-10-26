/**
 * Bounded continuation parameters of an askUZH-to-Klicker handoff link: the
 * student's question (q) and the origin (src) that attributes the visit.
 */
export const HANDOFF_TOPIC_LIMIT = 500
export const HANDOFF_SOURCES = ['askuzh'] as const

export type HandoffSource = (typeof HANDOFF_SOURCES)[number]

// biome-ignore lint/suspicious/noControlCharactersInRegex: the topic comes from a link a student can edit, so control characters are stripped deliberately.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g

/** Keeps a topic only when it is non-empty and within the length cap. */
export function parseHandoffTopic(
  value: string | null | undefined
): string | undefined {
  const topic = value?.replace(CONTROL_CHARACTERS, '') ?? ''

  return topic.length > 0 && topic.length <= HANDOFF_TOPIC_LIMIT
    ? topic
    : undefined
}

/** Keeps an origin only when it is one we know about. */
export function parseHandoffSource(
  value: string | null | undefined
): HandoffSource | undefined {
  return HANDOFF_SOURCES.find((source) => source === value)
}

const firstValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

/**
 * Collects the parameters that have to survive the chatbot trampoline's login
 * and chat redirects: "embed" and any valid handoff parameter. Everything else
 * is dropped rather than forwarded.
 */
export function buildChatbotRedirectParams(
  query: Record<string, string | string[] | undefined>,
  embedded: boolean
): URLSearchParams {
  const parameters = new URLSearchParams()

  if (embedded) {
    parameters.set('embed', 'true')
  }

  const topic = parseHandoffTopic(firstValue(query.q))
  if (topic) {
    parameters.set('q', topic)
  }

  const source = parseHandoffSource(firstValue(query.src))
  if (source) {
    parameters.set('src', source)
  }

  return parameters
}
