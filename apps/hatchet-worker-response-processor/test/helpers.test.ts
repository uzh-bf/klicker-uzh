import { describe, expect, it } from 'vitest'
import { resolveTriggeringHatchetEventId } from '../src/processors/assessmentProcessor.js'
import { validateStudentResponse } from '../src/processors/helpers.js'

describe('assessment response validation', () => {
  it.each([
    ['SC', { choices: [{ ix: 0, selected: true }] }],
    [
      'MC',
      {
        choices: [
          { ix: 0, selected: true },
          { ix: 1, selected: false },
        ],
      },
    ],
    [
      'KPRIM',
      {
        choices: [0, 1, 2, 3].map((ix) => ({ ix, selected: ix === 0 })),
      },
    ],
    ['NUMERICAL', { value: '2.5' }],
    ['FREE_TEXT', { value: 'answer' }],
    ['SELECTION', { selection: [17] }],
    ['CASE_STUDY', { assessment: { case: { 1: { criterion: 2 } } } }],
    ['CONTENT', { viewed: true }],
  ] as const)('accepts a valid %s response', (type, response) => {
    expect(
      validateStudentResponse({ type, response, restrictions: undefined })
    ).toEqual({ valid: true })
  })

  it.each([
    [
      'SC',
      { choices: [{ ix: 0, selected: false }] },
      'SINGLE_CHOICE_SELECTION_INVALID',
    ],
    [
      'MC',
      { choices: [{ ix: 0, selected: false }] },
      'MULTIPLE_CHOICE_SELECTION_INVALID',
    ],
    [
      'KPRIM',
      { choices: [{ ix: 0, selected: true }] },
      'KPRIM_CHOICE_COUNT_INVALID',
    ],
    ['NUMERICAL', { value: 'not-a-number' }, 'NUMERICAL_FORMAT_INVALID'],
    ['FREE_TEXT', { value: '' }, 'FREE_TEXT_FORMAT_INVALID'],
    ['SELECTION', { selection: [-1] }, 'SELECTION_FORMAT_INVALID'],
    ['CASE_STUDY', { assessment: {} }, 'CASE_STUDY_FORMAT_INVALID'],
    ['CONTENT', { viewed: false }, 'CONTENT_RESPONSE_INVALID'],
  ] as const)('rejects an invalid %s response with a stable reason', (type, response, reasonCode) => {
    expect(validateStudentResponse({ type, response })).toMatchObject({
      valid: false,
      reasonCode,
    })
  })

  it('returns a stable reason without embedding the raw answer', () => {
    const rawAnswer = 'sensitive-answer-value'
    const result = validateStudentResponse({
      type: 'SC',
      response: { value: rawAnswer },
    })

    expect(result).toEqual({
      valid: false,
      reasonCode: 'CHOICES_FORMAT_INVALID',
      message: 'Invalid response submitted for choices question',
    })
    expect(JSON.stringify(result)).not.toContain(rawAnswer)
  })
})

describe('Hatchet receipt resolution', () => {
  const message = {
    submissionId: '10000000-0000-4000-8000-000000000006',
  } as Parameters<typeof resolveTriggeringHatchetEventId>[0]

  it('resolves the actual event associated with the workflow run', async () => {
    const context = {
      additionalMetadata: () => ({ submissionId: message.submissionId }),
      workflowRunId: () => '10000000-0000-4000-8000-000000000007',
      v1: {
        events: {
          list: async () => ({
            rows: [
              {
                metadata: { id: 'hatchet-event-id' },
                triggeredRuns: [
                  {
                    workflowRunId: '10000000-0000-4000-8000-000000000007',
                  },
                ],
              },
            ],
          }),
        },
      },
    } as Parameters<typeof resolveTriggeringHatchetEventId>[1]

    await expect(
      resolveTriggeringHatchetEventId(message, context)
    ).resolves.toBe('hatchet-event-id')
  })

  it('rejects a workflow whose metadata is bound to another submission', async () => {
    const context = {
      additionalMetadata: () => ({ submissionId: 'another-submission' }),
    } as Parameters<typeof resolveTriggeringHatchetEventId>[1]

    await expect(
      resolveTriggeringHatchetEventId(message, context)
    ).rejects.toThrow('SUBMISSION_METADATA_MISMATCH')
  })
})
