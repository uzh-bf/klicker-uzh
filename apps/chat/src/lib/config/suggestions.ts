// Ids only — the user-visible label and the prompt text that actually gets
// sent both live in i18n (`chat.suggestions.<id>` / `chat.suggestions.<id>Prompt`)
// so a German student sees and sends German text. This config only fixes the
// set of suggestions, their display order, and (via the literal union below)
// lets the i18n template-literal keys type-check against the generated
// `Messages` type.
export type ThreadSuggestionId = 'explainConcept' | 'examPrep'

export interface ThreadSuggestion {
  id: ThreadSuggestionId
}

export const THREAD_SUGGESTIONS: ThreadSuggestion[] = [
  { id: 'explainConcept' },
  { id: 'examPrep' },
]

export function getThreadSuggestions(): ThreadSuggestion[] {
  return THREAD_SUGGESTIONS
}
