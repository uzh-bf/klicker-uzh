import { ElementType } from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'
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
  type Context = Parameters<typeof resolveTriggeringHatchetEventId>[1]
  type ListEvents = Context['v1']['events']['list']
  const workflowRunId = '10000000-0000-4000-8000-000000000007'
  const message = {
    submissionId: '10000000-0000-4000-8000-000000000006',
  } as Parameters<typeof resolveTriggeringHatchetEventId>[0]

  it('resolves the actual event associated with the workflow run', async () => {
    const list = vi.fn(async (query: Parameters<ListEvents>[0]) => ({
      // Hatchet filters workflowIds by workflow definition, not run ID.
      rows:
        query?.workflowIds === undefined &&
        query?.keys === undefined &&
        query?.additionalMetadata?.includes(
          `submissionId:${message.submissionId}`
        )
          ? [
              {
                key: 'stg_response-received:assessment',
                metadata: { id: 'hatchet-event-id' },
                triggeredRuns: [{ workflowRunId }],
              },
            ]
          : [],
    }))
    const context = {
      additionalMetadata: () => ({ submissionId: message.submissionId }),
      workflowRunId: () => workflowRunId,
      v1: {
        events: {
          list,
        },
      },
    } as Parameters<typeof resolveTriggeringHatchetEventId>[1]

    await expect(
      resolveTriggeringHatchetEventId(message, context)
    ).resolves.toBe('hatchet-event-id')
    expect(list).toHaveBeenCalledWith({
      limit: 100,
      offset: 0,
      additionalMetadata: [`submissionId:${message.submissionId}`],
    })
  })

  function contextWithEvents(list: unknown): Context {
    return {
      additionalMetadata: () => ({ submissionId: message.submissionId }),
      workflowRunId: () => workflowRunId,
      v1: { events: { list } },
    } as Context
  }

  const event = (id: string, runId = workflowRunId) => ({
    metadata: { id },
    triggeredRuns: [{ workflowRunId: runId }],
  })

  it('finds the exact run after a page of resends with the same submission', async () => {
    const list = vi.fn(async (query: Parameters<ListEvents>[0]) => ({
      rows:
        query?.offset === 0
          ? Array.from({ length: 100 }, (_, index) =>
              event(`resend-${index}`, `other-run-${index}`)
            )
          : [event('original-event')],
    }))

    await expect(
      resolveTriggeringHatchetEventId(message, contextWithEvents(list))
    ).resolves.toBe('original-event')
    expect(list.mock.calls.map(([query]) => query?.offset)).toEqual([0, 100])
  })

  it('retries when the event association is not visible yet', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ metadata: { id: 'event-id' } }] })
      .mockResolvedValueOnce({ rows: [event('event-id')] })

    await expect(
      resolveTriggeringHatchetEventId(message, contextWithEvents(list))
    ).resolves.toBe('event-id')
    expect(list).toHaveBeenCalledTimes(3)
  })

  it('does not substitute another resend event or the workflow run ID', async () => {
    const list = vi.fn().mockResolvedValue({
      rows: [event('other-event', 'other-run'), event('')],
    })

    await expect(
      resolveTriggeringHatchetEventId(message, contextWithEvents(list))
    ).rejects.toThrow('Hatchet triggering event is not yet available')
    expect(list).toHaveBeenCalledTimes(3)
  })

  it('rejects ambiguous triggering events across pages', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          event('first-match'),
          ...Array.from({ length: 99 }, (_, index) =>
            event(`resend-${index}`, `other-run-${index}`)
          ),
        ],
      })
      .mockResolvedValueOnce({ rows: [event('second-match')] })

    await expect(
      resolveTriggeringHatchetEventId(message, contextWithEvents(list))
    ).rejects.toThrow('Hatchet workflow run has multiple triggering events')
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
