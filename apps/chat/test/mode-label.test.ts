import { describe, expect, test } from 'vitest'
import {
  formatModeLabel,
  getComposerSubmitMode,
  getModeDescription,
  getModeIcon,
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

  test('gates generation actions when no chat mode is available', () => {
    expect(hasAvailableChatMode({})).toBe(false)
    expect(hasAvailableChatMode({ tutor: '' })).toBe(true)
    expect(getComposerSubmitMode(false)).toBe('none')
    expect(getComposerSubmitMode(true)).toBe('enter')
  })
})

test('uses localized standard-mode presentation for Writing Coach', () => {
  const syntheticT = ((key: string) =>
    `localized:${key}`) as unknown as Parameters<typeof formatModeLabel>[0]
  const mode = 'writing-coach'
  expect(isKnownMode(mode)).toBe(true)
  expect(formatModeLabel(syntheticT, mode)).toBe(`localized:chat.modes.${mode}`)
  expect(getModeDescription(syntheticT, mode, {})).toBe(
    `localized:chat.modes.${mode}Description`
  )
  expect(getModeIcon(mode)).not.toBe(getModeIcon('synthetic-custom'))
})
