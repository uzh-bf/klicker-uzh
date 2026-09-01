import { ElementType } from '@klicker-uzh/prisma/client'
import { describe, expect, it } from 'vitest'
import { normalizeAssessmentAnswer } from '../src/processors/assessmentAudit.js'
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

describe('assessment answer normalization', () => {
  it('sorts selected choice IDs and strips unselected choices', () => {
    expect(
      normalizeAssessmentAnswer({
        type: ElementType.MC,
        response: {
          choices: [
            { ix: 4, selected: true },
            { ix: 1, selected: false },
            { ix: 2, selected: true },
          ],
        },
      })
    ).toEqual({ kind: 'MC', selectedOptionIds: [2, 4] })
  })

  it('canonicalizes numerical answers to finite numbers with restrictions', () => {
    expect(
      normalizeAssessmentAnswer({
        type: ElementType.NUMERICAL,
        response: { value: '2.50' },
        restrictions: { min: 0, max: 10 },
      })
    ).toEqual({
      kind: 'NUMERICAL',
      value: 2.5,
      restriction: { minimum: 0, maximum: 10, precision: null },
    })
  })

  it('orders nested case-study answers deterministically', () => {
    expect(
      normalizeAssessmentAnswer({
        type: ElementType.CASE_STUDY,
        response: {
          assessment: {
            b: { 2: { z: 1, a: 0 } },
            a: { 1: { c: 2 } },
          },
        },
      })
    ).toEqual({
      kind: 'CASE_STUDY',
      cases: [
        {
          caseId: 'a',
          items: [{ itemId: 1, criteria: [{ criterionId: 'c', response: 2 }] }],
        },
        {
          caseId: 'b',
          items: [
            {
              itemId: 2,
              criteria: [
                { criterionId: 'a', response: 0 },
                { criterionId: 'z', response: 1 },
              ],
            },
          ],
        },
      ],
    })
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
