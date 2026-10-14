import type { ModelMessage } from 'ai'

type ChatTurnRequestInput<Message extends ModelMessage> = {
  /** Everything fixed per chatbot, mode or thread, in prefix order. */
  stableSections: string[]
  /** Data that may change on every turn (page context, snapshots, candidates). */
  turnContextSections: string[]
  /** Prior turns followed by the new user message. */
  history: Message[]
}

/**
 * Lays out one chat request so consecutive turns of a thread share a
 * byte-identical prefix.
 *
 * The stable text goes in `instructions`. Per-turn context becomes a single
 * system-role message directly before the new user message; the provider
 * serialises it as an input message (a `developer` item for reasoning models).
 * It is built fresh each turn and never persisted, so history replays only the
 * prior user and assistant text.
 */
export function buildChatTurnRequest<Message extends ModelMessage>({
  stableSections,
  turnContextSections,
  history,
}: ChatTurnRequestInput<Message>) {
  const instructions = stableSections.filter(Boolean).join('\n\n')
  const turnContext = turnContextSections.filter(Boolean).join('\n\n')
  if (!turnContext || history.length === 0) {
    return { instructions, messages: history as ModelMessage[] }
  }

  const contextMessage: ModelMessage = { role: 'system', content: turnContext }
  return {
    instructions,
    messages: [
      ...history.slice(0, -1),
      contextMessage,
      history[history.length - 1],
    ] as ModelMessage[],
  }
}
