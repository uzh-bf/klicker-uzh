import { describe, expect, test } from 'vitest'
import {
  formatModeLabel,
  hasAvailableChatMode,
  isKnownMode,
} from '../src/lib/config/modes'

// Stands in for next-intl's `t`, using the same shape the real English
// messages produce for the `chat.modes.*` keys this module reads.
const t = ((key: string) => {
  if (key === 'chat.modes.tutor') return 'Tutor'
  if (key === 'chat.modes.explainer') return 'Explainer'
  if (key === 'chat.modes.quizzer') return 'Quizzer'
  return key
}) as unknown as Parameters<typeof formatModeLabel>[0]

describe('formatModeLabel', () => {
  test('returns the localized label for a well-known mode', () => {
    expect(formatModeLabel(t, 'tutor')).toBe('Tutor')
    expect(formatModeLabel(t, 'explainer')).toBe('Explainer')
    expect(formatModeLabel(t, 'quizzer')).toBe('Quizzer')
  })

  test('falls back to the capitalized raw name for an unknown mode', () => {
    expect(formatModeLabel(t, 'socratic')).toBe('Socratic')
  })

  test('only capitalizes the first character of an unknown mode', () => {
    expect(formatModeLabel(t, 'examPrep')).toBe('ExamPrep')
  })

  test('does not treat inherited object keys as known modes', () => {
    expect(isKnownMode('toString')).toBe(false)
    expect(formatModeLabel(t, 'toString')).toBe('ToString')
  })

  test('reports whether the chatbot exposes a usable mode', () => {
    expect(hasAvailableChatMode({})).toBe(false)
    expect(hasAvailableChatMode({ tutor: '' })).toBe(true)
  })
})
