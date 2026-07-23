import * as DB from '@klicker-uzh/prisma/client'
import { describe, expect, it } from 'vitest'
import validateAndProcessElementOptions from '../src/lib/validateAndProcessElementOptions.js'

describe('CODE element option validation', () => {
  const validOptions = {
    language: 'python',
    starterCode: 'def add(a, b):\n    pass',
    sampleSolution: 'def add(a, b):\n    return a + b',
    entrypoint: 'add',
    testCases: [
      {
        id: 'public-addition',
        name: 'adds positive numbers',
        args: [2, 3],
        expectedOutput: 5,
        visibility: 'public',
        weight: 1,
      },
    ],
    executionLimits: { perTestTimeoutSeconds: 30 },
    hasSampleSolution: true,
  } as const

  it('accepts a Python function with declarative tests and fixes the timeout', () => {
    const options = structuredClone(validOptions)

    expect(
      validateAndProcessElementOptions(
        'CODE' as DB.ElementType,
        options as never
      )
    ).toEqual({
      ...options,
      executionLimits: { perTestTimeoutSeconds: 5 },
    })
  })

  it.each([
    ['a non-Python language', { ...validOptions, language: 'javascript' }],
    ['an invalid entrypoint', { ...validOptions, entrypoint: 'add-values' }],
    ['a Python keyword entrypoint', { ...validOptions, entrypoint: 'return' }],
    ['no tests', { ...validOptions, testCases: [] }],
    [
      'more than 20 tests',
      {
        ...validOptions,
        testCases: Array.from({ length: 21 }, (_, index) => ({
          ...validOptions.testCases[0],
          id: `test-${index}`,
        })),
      },
    ],
    [
      'duplicate test ids',
      {
        ...validOptions,
        testCases: [
          validOptions.testCases[0],
          { ...validOptions.testCases[0], name: 'duplicate' },
        ],
      },
    ],
    [
      'a prototype-polluting test id',
      {
        ...validOptions,
        testCases: [{ ...validOptions.testCases[0], id: '__proto__' }],
      },
    ],
    [
      'a non-JSON argument',
      {
        ...validOptions,
        testCases: [
          { ...validOptions.testCases[0], args: [Number.POSITIVE_INFINITY] },
        ],
      },
    ],
    [
      'a non-positive weight',
      {
        ...validOptions,
        testCases: [{ ...validOptions.testCases[0], weight: 0 }],
      },
    ],
    [
      'an enabled but empty sample solution',
      {
        ...validOptions,
        sampleSolution: '   ',
      },
    ],
  ])('rejects %s', (_, options) => {
    expect(
      validateAndProcessElementOptions(
        'CODE' as DB.ElementType,
        options as never
      )
    ).toBeNull()
  })

  it('omits the sample solution when sample solutions are disabled', () => {
    expect(
      validateAndProcessElementOptions(
        'CODE' as DB.ElementType,
        {
          ...validOptions,
          hasSampleSolution: false,
        } as never
      )
    ).not.toHaveProperty('sampleSolution')
  })
})
