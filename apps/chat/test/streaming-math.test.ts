import { describe, expect, test } from 'vitest'

import {
  escapeNonMathDollars,
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
    ['trailing single-dollar', '$', 'before '],
  ])('hides an incomplete %s expression', (_, expression, prefix) => {
    expect(hideIncompleteMath(`${prefix}${expression}`)).toBe(prefix)
  })

  test.each([
    ['backslash', '\\'],
    ['double-backslash', '\\\\'],
    ['inline-tag prefix', '[/in'],
    ['display-tag prefix', '[/ma'],
  ])('hides a trailing %s opener prefix', (_, expression) => {
    const input = `before ${expression}`

    expect(hideIncompleteMath(input)).toBe('before ')
    expect(inspectStreamingMath(input)).toEqual({
      hasMathOpener: true,
      incompleteMathStart: 'before '.length,
    })
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

  test('hides partial chemistry until its existing math delimiter completes', () => {
    const partial = String.raw`before $$\ce{H2O}`
    const complete = `${partial}$$ after`

    expect(hideIncompleteMath(partial)).toBe('before ')
    expect(inspectStreamingMath(partial)).toEqual({
      hasMathOpener: true,
      incompleteMathStart: 'before '.length,
    })
    expect(hideIncompleteMath(complete)).toBe(complete)
    expect(inspectStreamingMath(complete)).toEqual({
      hasMathOpener: true,
      incompleteMathStart: null,
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

  test.each([
    ' ',
    '  ',
    '   ',
  ])('recognizes a closing fence with %s indentation before later math', (indentation) => {
    const input = `\`\`\`\ncode\n${indentation}\`\`\`\n\\[y`
    const mathStart = input.indexOf(String.raw`\[y`)

    expect(inspectStreamingMath(input)).toEqual({
      hasMathOpener: true,
      incompleteMathStart: mathStart,
    })
    expect(hideIncompleteMath(input)).toBe(input.slice(0, mathStart))
  })
})

describe('non-math dollar escaping', () => {
  test.each([
    ['two amounts', 'returned $90,000, leaving $10,000.'],
    ['a range', 'between $5-$10 per unit'],
    ['a single amount', 'The price is $5 today'],
  ])('escapes currency in %s', (_, input) => {
    expect(escapeNonMathDollars(input)).toBe(input.replaceAll('$', '\\$'))
  })

  test.each([
    ['a symbol', '$x$'],
    ['an equation', '$3 + 4 = 7$'],
    ['two formulas', '$NPV = -I_0 + CF_1$ and $k$'],
    ['display math', '$$\nx^2\n$$'],
    ['an escaped dollar', 'Use \\$5 already escaped'],
    ['inline code', '`$5 and $10`'],
    ['fenced code', '```\n$5 and $10\n```'],
  ])('leaves %s unchanged', (_, input) => {
    expect(escapeNonMathDollars(input)).toBe(input)
  })

  test('keeps a formula and escapes the amount in the same paragraph', () => {
    expect(escapeNonMathDollars('With $k = 0.09$, it costs $100.')).toBe(
      'With $k = 0.09$, it costs \\$100.'
    )
  })

  test('escapes amounts in prose after a fenced code block', () => {
    expect(escapeNonMathDollars('```\n$5\n```\nIt costs $5 and $10.')).toBe(
      '```\n$5\n```\nIt costs \\$5 and \\$10.'
    )
  })
})
