import type {
  StudentMcpPracticeElement as PracticeElement,
  StudentMcpPracticeQuiz as PracticeQuiz,
  StudentMcpPracticeStack as PracticeStack,
  StudentMcpQuestionRefPayload as QuestionRefPayload,
} from '@klicker-uzh/types'
import { describe, expect, it } from 'vitest'
import {
  isSupportedStack,
  rankPracticeStacks,
  toSafeStackRenderPayload,
  validateCompleteStackSubmission,
} from '../src/practice.js'

function stack(
  id: number,
  content: string,
  elementType: PracticeElement['elementType'] = 'SC',
  extraOptions: Record<string, unknown> = {}
): PracticeStack {
  return {
    id,
    displayName: `Stack ${id}`,
    elements: [
      {
        id: id * 10,
        elementType,
        elementData: {
          name: `Question ${id}`,
          type: elementType,
          content,
          explanation: 'This is the hidden explanation.',
          options: extraOptions,
        },
      },
    ],
  }
}

describe('practice stack ranking', () => {
  it('ranks topic relevance ahead of spaced-repetition order', () => {
    const practiceQuiz: PracticeQuiz = {
      id: 'course-1',
      displayName: 'Course practice',
      stacks: [
        stack(1, 'Photosynthesis in chloroplast membranes'),
        stack(2, 'Bayes theorem and posterior probability updates'),
      ],
    }
    const refs: QuestionRefPayload[] = []

    const candidates = rankPracticeStacks({
      chatbotId: 'chatbot-1',
      courseId: 'course-1',
      createQuestionRef: (payload) => {
        refs.push(payload)
        return `ref-${payload.stackId}`
      },
      getQuestionRefExpiresAt: () => '2026-05-08T18:00:00.000Z',
      limit: 2,
      participantId: 'participant-1',
      practiceQuiz,
      query: 'Please help me understand Bayes posterior probability',
    })

    expect(candidates.map((candidate) => candidate.stackTitle)).toEqual([
      'Stack 2',
      'Stack 1',
    ])
    expect(candidates[0]?.relevanceScore).toBeGreaterThan(
      candidates[1]?.relevanceScore ?? 0
    )
    expect(refs[0]).toMatchObject({
      chatbotId: 'chatbot-1',
      participantId: 'participant-1',
    })
  })

  it('excludes the whole stack when any element type is unsupported', () => {
    expect(isSupportedStack(stack(1, 'Read this passage', 'CONTENT'))).toBe(
      false
    )

    const mixedStack: PracticeStack = {
      id: 3,
      displayName: 'Mixed',
      elements: [
        stack(3, 'Supported', 'SC').elements![0]!,
        stack(4, 'Unsupported', 'SELECTION').elements![0]!,
      ],
    }
    expect(isSupportedStack(mixedStack)).toBe(false)
  })
})

describe('answer-safe render payloads', () => {
  it('removes solution-adjacent fields before returning quiz render data', () => {
    const unsafe = stack(1, 'Choose one option.', 'SC', {
      hasSampleSolution: true,
      displayMode: 'LIST',
      choices: [
        { ix: 0, value: 'A', correct: true, feedback: 'Correct.' },
        { ix: 1, value: 'B', correct: false, feedback: 'No.' },
      ],
      exactSolutions: [42],
      solutionRanges: [{ min: 40, max: 44 }],
      solutions: ['sample answer'],
    })

    const safe = toSafeStackRenderPayload(unsafe)
    const serialized = JSON.stringify(safe)

    expect(serialized).not.toContain('correct')
    expect(serialized).not.toContain('feedback')
    expect(serialized).not.toContain('exactSolutions')
    expect(serialized).not.toContain('solutionRanges')
    expect(serialized).not.toContain('sample answer')
    expect(safe.elements[0]).toMatchObject({
      id: 10,
      elementType: 'SC',
      elementData: {
        __typename: 'ChoicesElementData',
        content: 'Choose one option.',
        options: {
          hasSampleSolution: true,
          displayMode: 'LIST',
          choices: [
            { ix: 0, value: 'A' },
            { ix: 1, value: 'B' },
          ],
        },
      },
    })
    expect(safe.elements[0]?.elementData).not.toHaveProperty('explanation')
  })

  it('preserves backend element order in multi-element stacks', () => {
    const first = stack(1, 'First question', 'SC').elements![0]!
    const second = stack(2, 'Second question', 'NUMERICAL').elements![0]!
    const safe = toSafeStackRenderPayload({
      id: 1,
      displayName: 'Ordered',
      elements: [second, first],
    })

    expect(safe.elements.map((element) => element.id)).toEqual([20, 10])
  })
})

describe('complete stack submission validation', () => {
  it('rejects incomplete stack answers', () => {
    const ref: QuestionRefPayload = {
      participantId: 'participant-1',
      chatbotId: 'chatbot-1',
      courseId: 'course-1',
      stackId: 1,
      orderedElements: [
        { instanceId: 10, type: 'SC' },
        { instanceId: 20, type: 'NUMERICAL' },
      ],
    }

    expect(() =>
      validateCompleteStackSubmission(ref, [
        {
          instanceId: 10,
          type: 'SC',
          choicesResponse: [{ ix: 0, selected: true }],
        },
      ])
    ).toThrow(/complete stack/i)
  })
})
