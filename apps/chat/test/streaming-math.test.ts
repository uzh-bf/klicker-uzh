import { describe, expect, test } from 'vitest'

import {
  hideIncompleteMath,
  inspectStreamingMath,
} from '../src/lib/markdown/streamingMath'

describe('streaming math scanner', () => {
  test.each([
    ['single-dollar', '$x', 'before '],
    ['double-dollar', '$$x', 'before '],
    ['backslash-paren', String.raw`\(x`, 'before '],
    ['backslash-bracket', String.raw`\[x`, 'before '],
    ['inline tag', '[/inline]x', 'before '],
    ['display tag', '[/math]x', 'before '],
  ])('hides an incomplete %s expression', (_, expression, prefix) => {
    expect(hideIncompleteMath(`${prefix}${expression}`)).toBe(prefix)
  })

  test.each([
    '$x$',
    '$$x$$',
    String.raw`\(x\)`,
    String.raw`\[x\]`,
    '[/inline]x[/inline]',
    '[/math]x[/math]',
  ])('keeps a complete expression unchanged: %s', (expression) => {
    expect(hideIncompleteMath(`before ${expression} after`)).toBe(
      `before ${expression} after`
    )
    expect(inspectStreamingMath(expression)).toEqual({
      hasMathOpener: true,
      incompleteMathStart: null,
    })
  })

  test('preserves completed math and prose before a later incomplete expression', () => {
    const input = 'before $x$ between \\[y'

    expect(hideIncompleteMath(input)).toBe('before $x$ between ')
    expect(inspectStreamingMath(input)).toEqual({
      hasMathOpener: true,
      incompleteMathStart: 19,
    })
  })

  test.each([
    ['escaped dollar', String.raw`Use \$5 without math`],
    ['currency', 'The price is $5 today'],
    ['inline code', '`$x without a closing dollar`'],
    ['fenced code', '```\n$ x without math\n```'],
  ])('does not treat %s as math', (_, input) => {
    expect(inspectStreamingMath(input)).toEqual({
      hasMathOpener: false,
      incompleteMathStart: null,
    })
    expect(hideIncompleteMath(input)).toBe(input)
  })
})
