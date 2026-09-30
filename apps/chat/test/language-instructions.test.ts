import { describe, expect, test } from 'vitest'

import {
  detectMessageLanguage,
  replyLanguageLockMessage,
  resolveReplyLanguage,
  withLanguageStyleContract,
} from '../src/lib/server/languageInstructions'

describe('withLanguageStyleContract', () => {
  test('appends the contract to a non-empty base prompt', () => {
    const base = 'You are a helpful tutor.'
    const result = withLanguageStyleContract(base)
    expect(result.startsWith(base)).toBe(true)
    expect(result).not.toBe(base)
  })

  test('locks the reply language to the user instead of retrieved material', () => {
    const result = withLanguageStyleContract('Base prompt.')
    expect(result).toContain("user's latest non-trivial message")
    expect(result).toContain('short acknowledgement')
    expect(result).toContain('Do not choose the reply language')
    expect(result).toContain('attached images or their descriptions')
    expect(result).toContain('retrieved passages')
    expect(result).toContain('Use one reply language throughout')
    expect(result).toContain('Translate or paraphrase relevant tool material')
  })

  test('demands Swiss orthography: ss over ß and real umlauts', () => {
    const result = withLanguageStyleContract('Base prompt.')
    expect(result).toContain('"ss" instead of "ß"')
    expect(result).toContain('ä, ö, ü')
    expect(result).toContain('ae, oe or ue')
  })

  // Lecturer guidance and custom personas do not own language policy, so the
  // contract must hold without any cooperation from earlier prompt layers.
  test('applies to an arbitrary lecturer prompt without conditions', () => {
    const lecturerPrompt = 'Du bist ein strenger Quizmaster für MAT182.'
    const result = withLanguageStyleContract(lecturerPrompt)
    expect(result).toContain(lecturerPrompt)
    expect(result).toContain('Swiss Standard German')
  })

  test.each([
    ['empty', ''],
    ['whitespace-only', '   \n  '],
  ])('handles a %s base prompt without leading blank lines', (_label, base) => {
    const result = withLanguageStyleContract(base)
    expect(result.trim()).toBe(result)
    expect(result).toContain('Swiss Standard German')
  })
})

describe('reply language resolution', () => {
  test.each([
    ['en', 'Could you check my answer to the bond question, please?'],
    ['de', 'Kannst du mir bitte erklären, wie ich den Barwert berechne?'],
    ['en', 'What does Barwert mean in this course?'],
    ['de', 'Stimmt meine Rechnung für die present value?'],
  ] as const)('detects %s from the user text', (expected, text) => {
    expect(detectMessageLanguage(text)).toBe(expected)
  })

  test('ignores quoted and code text when detecting', () => {
    expect(
      detectMessageLanguage(
        'Is this correct? "Der Barwert ist die Summe der abgezinsten Zahlungen und nicht der Endwert." `die der das`'
      )
    ).toBe('en')
  })

  test('returns null without a clear signal', () => {
    expect(detectMessageLanguage('Danke.')).toBeNull()
    expect(detectMessageLanguage('B')).toBeNull()
  })

  test('falls back to the latest earlier message with a clear signal', () => {
    expect(
      resolveReplyLanguage([
        'Ich habe eine Frage zur Abzinsung.',
        'Can you give me a hint for the next step?',
        'OK',
      ])
    ).toBe('en')
    expect(resolveReplyLanguage(['OK', '42'])).toBeNull()
  })

  test('builds a system message for the resolved language', () => {
    const lock = replyLanguageLockMessage('de')
    expect(lock.role).toBe('system')
    expect(lock.content.length).toBeGreaterThan(0)
  })
})
