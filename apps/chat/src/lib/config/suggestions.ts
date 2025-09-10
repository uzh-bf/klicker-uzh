export interface ThreadSuggestion {
  id: string
  text?: string // optional, use prompt if not provided
  prompt: string
}

export const THREAD_SUGGESTIONS: ThreadSuggestion[] = [
  {
    id: 'suggestion-1',
    text: 'Explain a random concept from the script',
    prompt:
      'Take a random concept from the course script and explain it in simple terms.',
  },
  {
    id: 'suggestion-2',
    text: 'Help me prepare for the exam',
    prompt:
      'Create a study plan for the upcoming exam covering all key topics based on the lecture materials.',
  },
]

export function getThreadSuggestions(): ThreadSuggestion[] {
  return THREAD_SUGGESTIONS.map((suggestion) => ({
    ...suggestion,
    text: suggestion.text || suggestion.prompt,
  }))
}
