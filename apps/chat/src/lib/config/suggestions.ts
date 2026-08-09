import { isKnownMode, type KnownMode } from './modes'

// Ids only — the user-visible label and the prompt text that actually gets
// sent both live in i18n (`chat.suggestions.<id>` / `chat.suggestions.<id>Prompt`)
// so a German student sees and sends German text. This config fixes the set of
// suggestions and their display order, while the literal union lets the
// i18n template-literal keys type-check against the generated `Messages` type.
export type ThreadSuggestionId =
  | 'practiceTopic'
  | 'workThroughProblem'
  | 'explainConcept'
  | 'summarizeTopic'

export interface ThreadSuggestion {
  id: ThreadSuggestionId
}

const THREAD_SUGGESTIONS_BY_MODE: Record<KnownMode, ThreadSuggestion[]> = {
  tutor: [{ id: 'practiceTopic' }, { id: 'workThroughProblem' }],
  explainer: [{ id: 'explainConcept' }, { id: 'summarizeTopic' }],
}

export function getThreadSuggestions(mode: string): ThreadSuggestion[] {
  return isKnownMode(mode)
    ? THREAD_SUGGESTIONS_BY_MODE[mode]
    : THREAD_SUGGESTIONS_BY_MODE.tutor
}
