import { describe, expect, test } from 'vitest'

import {
  hideIncompleteMath,
  inspectStreamingMath,
  preprocessStreamingMath,
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
    ['escaped dollar', String.raw`Use \$5 without math`, 0],
    ['currency', 'The price is $5 today', 0],
    ['inline code', '`$x without a closing dollar`', 0],
    ['fenced code', '```\n$ x without math\n```', 0],
  ])('does not treat %s as math', (_, input, expectedStart) => {
    expect(inspectStreamingMath(input)).toEqual({
      hasMathOpener: false,
      incompleteMathStart: expectedStart === 0 ? null : expectedStart,
    })
    expect(hideIncompleteMath(input)).toBe(input)
  })

  test('keeps the streaming mask only for a running part', () => {
    const input = 'before \\[x'

    expect(preprocessStreamingMath(input, true)).toBe('before ')
    expect(preprocessStreamingMath(input, false)).toBe(input)
  })
})
