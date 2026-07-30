import { ElementType } from '@klicker-uzh/prisma/client'
import type { CodeElementData } from '@klicker-uzh/types'
import { describe, expect, it } from 'vitest'
import {
  getInitialInstanceResults,
  processElementData,
  sanitizeElementDataForParticipant,
} from '../src/elements.js'

function createCodeElementData(): CodeElementData {
  return {
    id: '42-v1',
    elementId: 42,
    type: ElementType.CODE,
    name: 'Add two values',
    content: 'Implement add.',
    explanation: null,
    basePoints: true,
    pointsMultiplier: 1,
    options: {
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
        {
          id: 'hidden-zero',
          name: 'handles zero',
          args: [0, 0],
          expectedOutput: 0,
          visibility: 'hidden',
          weight: 2,
        },
      ],
      executionLimits: { perTestTimeoutSeconds: 5 },
      hasSampleSolution: true,
    },
  } as CodeElementData
}

describe('CODE participant element data', () => {
  it('contains public tests but no hidden test metadata', () => {
    const elementData = createCodeElementData()

    expect(sanitizeElementDataForParticipant(elementData)).toEqual({
      ...elementData,
      options: {
        language: 'python',
        starterCode: 'def add(a, b):\n    pass',
        entrypoint: 'add',
        executionLimits: { perTestTimeoutSeconds: 5 },
        testCases: [
          {
            id: 'public-addition',
            name: 'adds positive numbers',
            args: [2, 3],
            expectedOutput: 5,
          },
        ],
      },
    })
  })

  it('copies the full authoring contract into an instance and initializes test aggregates', () => {
    const elementData = createCodeElementData()
    const processed = processElementData({
      id: 42,
      version: 1,
      type: ElementType.CODE,
      name: elementData.name,
      content: elementData.content,
      explanation: elementData.explanation,
      basePoints: elementData.basePoints,
      pointsMultiplier: elementData.pointsMultiplier,
      options: elementData.options,
    } as never)

    expect(processed).toEqual(elementData)
    expect(getInitialInstanceResults(processed)).toEqual({
      tests: {
        'public-addition': { passed: 0, total: 0 },
        'hidden-zero': { passed: 0, total: 0 },
      },
      total: 0,
    })
  })
})
