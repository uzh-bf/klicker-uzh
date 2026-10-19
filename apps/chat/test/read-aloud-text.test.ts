import { describe, expect, test } from 'vitest'
import { toSpeakableText } from '../src/lib/speech/readAloudText'

const speak = (markdown: string) =>
  toSpeakableText(markdown, { formulaLabel: 'FORMULA' })

describe('toSpeakableText', () => {
  test('drops citation markers and the spacing before them', () => {
    expect(speak('Diversify [1]. Risk falls [2–4] and [3-5].')).toBe(
      'Diversify. Risk falls and.'
    )
  })

  test('replaces every display-math spelling with the spoken label', () => {
    expect(speak('A\n\n$$\nx^2 + [1]\n$$\n\nB')).toBe('A\n\nFORMULA\n\nB')
    expect(speak('A \\[ x^2 \\] B')).toBe('A FORMULA B')
    expect(speak('A \\\\[ x^2 \\\\] B')).toBe('A FORMULA B')
    expect(speak('A [/math]x^2[/math] B')).toBe('A FORMULA B')
  })

  test('skips fenced code, including an unclosed fence', () => {
    expect(speak('Before\n```python\nprint("$5 [1]")\n```\nAfter')).toBe(
      'Before\n\nAfter'
    )
    expect(speak('Before\n~~~\ncode\n~~~\nAfter')).toBe('Before\n\nAfter')
    expect(speak('Before\n```js\nstill streaming')).toBe('Before')
  })

  test('keeps inline code and inline math content without delimiters', () => {
    expect(speak('Use `mean()` for $\\mu$ and \\(x\\).')).toBe(
      'Use mean() for \\mu and x.'
    )
  })

  test('leaves currency amounts intact', () => {
    expect(speak('It costs $5 and $10.')).toBe('It costs $5 and $10.')
  })
})
