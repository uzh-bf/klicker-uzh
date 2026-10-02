import { describe, expect, test } from 'vitest'

import {
  canonicalNumber,
  measureReusedContent,
  trailingStepMessage,
} from '../src/lib/server/feedbackEvidence'
import { REPLY_LANGUAGE_REMINDER } from '../src/lib/server/languageInstructions'

const explanation =
  'Discount each cash flow at the market yield. The coupon is 50 CHF per ' +
  'year and the final payment is 1,050 CHF. Adding the present values ' +
  'gives a price of 1,027.75 CHF, which is above par because the coupon ' +
  'rate exceeds the yield.'

describe('canonicalNumber', () => {
  test('treats thousands separators and decimal commas as the same value', () => {
    expect(canonicalNumber('1,027.80')).toBe('1027.8')
    expect(canonicalNumber("1'027.8")).toBe('1027.8')
    expect(canonicalNumber('1027,80')).toBe('1027.8')
    expect(canonicalNumber('5,800')).toBe('5800')
  })

  test('ignores values too short to identify a computed result', () => {
    expect(canonicalNumber('5')).toBeNull()
    expect(canonicalNumber('1,5')).toBeNull()
    expect(canonicalNumber('0.8')).toBeNull()
  })
})

describe('measureReusedContent', () => {
  test('detects an explanation pasted back by the user', () => {
    const result = measureReusedContent([
      { role: 'user', content: 'How do I price this bond?' },
      { role: 'assistant', content: explanation },
      { role: 'user', content: `${explanation} I wrote this myself.` },
    ])
    expect(result.reusedShare).toBeGreaterThan(0.8)
    expect(result.reusedNumbers).toEqual(['1050', '1027.75'])
  })

  test('lists computed values reused without copied wording', () => {
    const result = measureReusedContent([
      { role: 'user', content: 'Price a bond with a 1,000 CHF face value.' },
      { role: 'assistant', content: explanation },
      { role: 'user', content: 'Ich komme selbst auf 1027,75 CHF bei 1000.' },
    ])
    expect(result.reusedShare).toBe(0)
    expect(result.reusedNumbers).toEqual(['1027.75'])
  })

  test('does not flag original work or values the user supplied first', () => {
    const result = measureReusedContent([
      { role: 'user', content: 'Check 2,400 CHF at 3.5% over four years.' },
      { role: 'assistant', content: 'Start with the first year.' },
      { role: 'user', content: '2,400 times 1.035 gives 2,484 CHF.' },
    ])
    expect(result).toEqual({ reusedShare: 0, reusedNumbers: [] })
  })
})

describe('trailingStepMessage', () => {
  test('puts the evidence note first and the language reminder last', () => {
    const message = trailingStepMessage('tutor', [
      { role: 'user', content: 'How do I price this bond?' },
      { role: 'assistant', content: explanation },
      { role: 'user', content: explanation },
    ])
    expect(message.role).toBe('system')
    expect(message.content.startsWith('Attribution evidence')).toBe(true)
    expect(message.content).toContain('1027.75')
    expect(message.content.endsWith(REPLY_LANGUAGE_REMINDER.content)).toBe(true)
  })

  test('omits the evidence note when nothing is reused', () => {
    const message = trailingStepMessage('quizzer', [
      { role: 'user', content: 'Quiz me.' },
    ])
    expect(message.content).not.toContain('Attribution evidence')
    expect(message.content.endsWith(REPLY_LANGUAGE_REMINDER.content)).toBe(true)
  })

  test('gives the quizzer its own feedback check', () => {
    const quizzer = trailingStepMessage('quizzer', [
      { role: 'user', content: 'B' },
    ])
    const tutor = trailingStepMessage('tutor', [{ role: 'user', content: 'B' }])
    expect(quizzer.content).toMatch(/^Quiz feedback check:/)
    expect(tutor.content).toMatch(/^Feedback check:/)
  })

  test('returns only the language reminder in the explainer mode', () => {
    expect(
      trailingStepMessage('explainer', [{ role: 'user', content: 'Explain.' }])
    ).toBe(REPLY_LANGUAGE_REMINDER)
  })
})
