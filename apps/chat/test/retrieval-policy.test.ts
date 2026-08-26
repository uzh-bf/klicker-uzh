import { describe, expect, test } from 'vitest'
import { isCardGenerationRequest } from '../src/lib/server/personalElements/cardGeneration'
import {
  isSocialMessage,
  shouldRequireCourseRetrieval,
} from '../src/lib/server/retrievalPolicy'

describe('retrieval policy', () => {
  test.each([
    'Hi',
    'Guten Morgen!',
    'Thanks a lot.',
    'Danke schön',
    'Alles klar',
    '👋',
  ])('allows a short social message without forced retrieval: %s', (message) => {
    expect(isSocialMessage(message)).toBe(true)
    expect(shouldRequireCourseRetrieval(message)).toBe(false)
  })

  test.each([
    'What is CAPM?',
    'Explain the difference between formative and summative assessment.',
    'Hallo, can you explain CAPM?',
    'Was bedeutet der Beta-Faktor?',
    'Can you search the course material for the exam requirements?',
  ])('requires retrieval for a substantive message: %s', (message) => {
    expect(isSocialMessage(message)).toBe(false)
    expect(shouldRequireCourseRetrieval(message)).toBe(true)
  })

  test('requires retrieval for an image-only message', () => {
    expect(shouldRequireCourseRetrieval('', true)).toBe(true)
    expect(shouldRequireCourseRetrieval('   ', true)).toBe(true)
  })

  test.each([
    'Can you generate some flashcards for me?',
    'Make practice cards about CAPM',
    'Write flashcards about CAPM',
    'Flashcards about CAPM',
    'Erstelle mir Lernkarten zum Beta-Faktor',
    'Bitte generiere Karteikarten zur Prüfung',
    'Lernkarten zum CAPM',
    'Karteikarten zur Prüfung',
    'Create flashcards explaining CAPM',
    'Generate flashcards that explain beta',
  ])('recognizes a card-generation request: %s', (message) => {
    expect(isCardGenerationRequest(message)).toBe(true)
    expect(shouldRequireCourseRetrieval(message)).toBe(true)
  })

  test.each([
    'What are flashcards?',
    'Explain how practice cards work.',
    'Can you explain how flashcards work?',
    'Show me my saved flashcards.',
    'I saved my flashcards.',
    'Tell me about flashcards.',
    'Do I need flashcards?',
    'Show me my flashcards.',
    'Ich möchte verstehen, wie Lernkarten funktionieren.',
    'Are flashcards for CAPM effective?',
    'Was sind Lernkarten zum CAPM?',
    'Wie funktionieren Lernkarten zum CAPM?',
    'Explain flashcards about CAPM.',
    'Can you explain why flashcards for CAPM are useful?',
    'Explain how flashcards for CAPM help learning.',
  ])('does not treat a card explanation as generation: %s', (message) => {
    expect(isCardGenerationRequest(message)).toBe(false)
  })
})
