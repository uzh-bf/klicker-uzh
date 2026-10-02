import { describe, expect, test } from 'vitest'

import {
  CALCULATOR_TOOL_NAME,
  evaluateExpression,
  stepReminder,
  withCalculatorTool,
} from '../src/lib/server/calculatorTool'
import { REPLY_LANGUAGE_REMINDER } from '../src/lib/server/languageInstructions'

describe('evaluateExpression', () => {
  test('follows operator precedence and parentheses', () => {
    expect(evaluateExpression('2 + 3 * 4')).toBe(14)
    expect(evaluateExpression('(2 + 3) * 4')).toBe(20)
    expect(evaluateExpression('10 / 4 - 1')).toBe(1.5)
  })

  test('treats powers as right-associative and binding tighter than minus', () => {
    expect(evaluateExpression('2 ^ 3 ^ 2')).toBe(512)
    expect(evaluateExpression('-2 ^ 2')).toBe(-4)
    expect(evaluateExpression('2 ^ -1')).toBe(0.5)
  })

  test('computes compound growth without intermediate rounding', () => {
    expect(evaluateExpression('8200 * 1.043 ^ 7')).toBeCloseTo(11010.42, 2)
  })

  test('rejects thousands separators and malformed input', () => {
    expect(() => evaluateExpression('1,000 * 2')).toThrow()
    expect(() => evaluateExpression('(1 + 2')).toThrow()
    expect(() => evaluateExpression('2 +')).toThrow()
    expect(() => evaluateExpression('1 / 0')).toThrow()
  })
})

describe('withCalculatorTool', () => {
  test('adds the calculator only in tutor and quizzer modes', () => {
    expect(withCalculatorTool('tutor', {})).toHaveProperty(CALCULATOR_TOOL_NAME)
    expect(withCalculatorTool('quizzer', {})).toHaveProperty(
      CALCULATOR_TOOL_NAME
    )
    expect(withCalculatorTool('explainer', {})).toEqual({})
  })
})

describe('calculate tool', () => {
  test('evaluates every expression and reports errors per expression', async () => {
    const execute = withCalculatorTool('tutor', {})[CALCULATOR_TOOL_NAME]
      ?.execute as (input: { expressions: string[] }) => Promise<unknown>
    const output = await execute({ expressions: ['24000 / 1.5699', '1,000'] })
    expect(output).toMatchObject({
      results: [
        { expression: '24000 / 1.5699', result: 15287.5979361743 },
        { expression: '1,000', error: expect.any(String) },
      ],
    })
  })
})

describe('stepReminder', () => {
  test('adds the precision rule before the language reminder in calculator modes', () => {
    const reminder = stepReminder('quizzer')
    expect(reminder.content).toMatch(/^Numeric precision:/)
    expect(reminder.content.endsWith(REPLY_LANGUAGE_REMINDER.content)).toBe(
      true
    )
  })

  test('keeps only the language reminder in other modes', () => {
    expect(stepReminder('explainer')).toBe(REPLY_LANGUAGE_REMINDER)
  })
})
