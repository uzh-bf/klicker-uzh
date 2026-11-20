import type {
  ElementOptionsNumerical,
  NumericalParametrization,
} from '@klicker-uzh/types'
import { describe, expect, it } from 'vitest'
import {
  compileFormula,
  computeNumericalValues,
  formatNumericalValue,
  renderNumericalElementData,
  validateNumericalParametrization,
} from '../src/lib/numericalParametrization.js'

const parametrization: NumericalParametrization = {
  variables: [
    { name: 'A', kind: 'INTEGER', min: 80, max: 120, step: 1000 },
    { name: 'q', kind: 'PICK', values: [8, 10, 12] },
    { name: 'r', kind: 'RANGE', min: 0.03, max: 0.05, step: 0.001 },
  ],
  derived: [{ name: 'target', formula: 'A * q / 100', decimals: 0 }],
  solution: { formula: 'target - A * r', tolerance: 1 },
}

const options: ElementOptionsNumerical = {
  parametrization,
  mistakes: [
    {
      key: 'whole',
      label: 'Whole requirement instead of the gap',
      feedback: 'Subtract the capital the bank already has.',
      formula: 'target',
      tolerance: 1,
    },
    {
      key: 'same',
      label: 'Equals the solution',
      feedback: 'never shown',
      formula: 'target - A * r',
      tolerance: 1,
    },
  ],
}

const data = {
  content: 'Assets of {{A}} and a quota of {{q}}%: what is missing?',
  explanation: 'The target is {{target}}.',
  options,
}

describe('numerical parametrization', () => {
  it('rejects formulas outside the arithmetic allowlist', () => {
    const symbols = new Set(['A'])
    for (const formula of [
      'x = 1',
      'A.constructor',
      '[1, 2]',
      '"text"',
      'import({}, {})',
      'evaluate("1+1")',
      'f(x) = x',
      'A ? 1 : 2',
      'A == 1',
      'B + 1',
      '1:3',
      'A!',
    ]) {
      expect(() => compileFormula(formula, symbols), formula).toThrow()
    }
    expect(
      compileFormula('max(A, 2) ^ 2 / -pi', symbols).evaluate({ A: 3 })
    ).toBeCloseTo(-9 / Math.PI)
  })

  it('rejects non-finite results', () => {
    expect(() =>
      compileFormula('A / 0', new Set(['A'])).evaluate({ A: 1 })
    ).toThrow()
  })

  it('draws the same values for the same attempt and different ones for others', () => {
    const first = computeNumericalValues(parametrization, 'attempt-1:el')
    expect(computeNumericalValues(parametrization, 'attempt-1:el')).toEqual(
      first
    )
    const others = Array.from({ length: 10 }, (_, i) =>
      JSON.stringify(
        computeNumericalValues(parametrization, `attempt-${i + 2}:el`)
      )
    )
    expect(new Set([JSON.stringify(first), ...others]).size).toBeGreaterThan(5)
  })

  it('keeps values when variables are reordered', () => {
    const reordered = {
      ...parametrization,
      variables: [...parametrization.variables].reverse(),
    }
    expect(computeNumericalValues(reordered, 'attempt-1:el')).toEqual(
      computeNumericalValues(parametrization, 'attempt-1:el')
    )
  })

  it('renders placeholders, the solution range and drops overlapping mistakes', () => {
    const rendered = renderNumericalElementData(data, 'attempt-1:el')
    const values = computeNumericalValues(parametrization, 'attempt-1:el')
    const solution = values.target! - values.A! * values.r!

    expect(rendered.content).toContain(formatNumericalValue(values.A!, 0))
    expect(rendered.content).not.toContain('{{')
    expect(rendered.explanation).toContain(
      formatNumericalValue(values.target!, 0)
    )
    expect(rendered.options.solutionRanges).toEqual([
      { min: solution - 1, max: solution + 1 },
    ])
    expect(rendered.options.exactSolutions).toBeUndefined()
    expect(rendered.options.mistakeRanges).toEqual([
      { key: 'whole', min: values.target! - 1, max: values.target! + 1 },
    ])
    expect(rendered.options.parametrization).toEqual(parametrization)

    // rendering an already rendered instance draws from the templates again
    const again = renderNumericalElementData(rendered, 'attempt-2:el')
    expect(again).toEqual(renderNumericalElementData(data, 'attempt-2:el'))
  })

  it('computes mistake ranges for elements without variables', () => {
    const rendered = renderNumericalElementData(
      {
        content: 'Fixed',
        options: <ElementOptionsNumerical>{
          solutionRanges: [{ min: 9, max: 11 }],
          mistakes: [
            {
              key: 'sign',
              label: 'Sign',
              feedback: 'Check the sign.',
              formula: '-10',
              tolerance: 0.5,
            },
          ],
        },
      },
      'any'
    )
    expect(rendered.content).toBe('Fixed')
    expect(rendered.options.mistakeRanges).toEqual([
      { key: 'sign', min: -10.5, max: -9.5 },
    ])
  })

  it('formats values with the chosen thousands separator', () => {
    expect(formatNumericalValue(-1234567.891, 2)).toBe("-1'234'567.89")
    expect(formatNumericalValue(1234.5, 0, 'COMMA')).toBe('1,235')
    expect(formatNumericalValue(-0.001, 1)).toBe('0.0')
  })

  it('validates names, placeholders and formulas on save', () => {
    expect(validateNumericalParametrization(data)).toEqual([])
    const errors = validateNumericalParametrization({
      content: 'Value {{missing}}',
      options: {
        parametrization: {
          variables: [
            { name: 'pi', kind: 'RANGE', min: 2, max: 1 },
            { name: 'B', kind: 'PICK', values: [] },
          ],
          solution: { formula: 'B.toString()', tolerance: -1 },
        },
        mistakes: [
          { key: 'k', label: '', feedback: '', formula: 'C', tolerance: 0 },
        ],
      },
    })
    expect(errors.length).toBeGreaterThanOrEqual(6)
  })
})
