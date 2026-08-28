import { describe, expect, test } from 'vitest'
import { buildManageProposalReview } from '../src/services/manageProposalReview'
import type { ManageElementCreateProposal } from '../src/services/manageProposalSchema'

const baseFields = {
  basePoints: true,
  pointsMultiplier: 1,
  status: 'DRAFT' as const,
  tags: [] as string[],
}

describe('Manage proposal review', () => {
  test('projects choice correctness, answer feedback, and explanation', () => {
    const payload = {
      ...baseFields,
      content: 'Which process converts sugar into ethanol?',
      explanation: 'Yeast performs alcoholic fermentation.',
      name: 'Wine fermentation',
      options: {
        choices: [
          {
            correct: true,
            feedback: 'Correct: yeast produces ethanol and carbon dioxide.',
            value: 'Alcoholic fermentation',
          },
          {
            correct: false,
            feedback: 'This process changes malic acid after fermentation.',
            value: 'Malolactic fermentation',
          },
        ],
        displayMode: 'LIST',
        hasAnswerFeedbacks: true,
        hasSampleSolution: true,
      },
      type: 'SC',
    } satisfies ManageElementCreateProposal['payload']

    expect(buildManageProposalReview(payload)).toEqual({
      choices: [
        {
          correct: true,
          feedback: 'Correct: yeast produces ethanol and carbon dioxide.',
          value: 'Alcoholic fermentation',
        },
        {
          correct: false,
          feedback: 'This process changes malic acid after fermentation.',
          value: 'Malolactic fermentation',
        },
      ],
      content: 'Which process converts sugar into ethanol?',
      elementType: 'SC',
      explanation: 'Yeast performs alcoholic fermentation.',
      kind: 'choices',
    })
  })

  test('projects free-text solutions and response restriction', () => {
    const payload = {
      ...baseFields,
      content: 'Explain the central limit theorem.',
      explanation: 'A short conceptual explanation is sufficient.',
      name: 'Central limit theorem',
      options: {
        hasSampleSolution: true,
        restrictions: { maxLength: 500 },
        solutions: ['The sampling distribution approaches a normal shape.'],
      },
      type: 'FREE_TEXT',
    } satisfies ManageElementCreateProposal['payload']

    expect(buildManageProposalReview(payload)).toEqual({
      content: 'Explain the central limit theorem.',
      elementType: 'FREE_TEXT',
      explanation: 'A short conceptual explanation is sufficient.',
      kind: 'freeText',
      maxLength: 500,
      solutions: ['The sampling distribution approaches a normal shape.'],
    })
  })
})
