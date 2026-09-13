import { MAX_LIVE_QUIZ_CHOICES } from '@klicker-uzh/types'
import { describe, expect, it } from 'vitest'
import {
  getLiveQuizResponseValidationShape,
  validateStudentResponse,
} from '../helpers.js'

describe('live quiz response validation budgets', () => {
  it('bounds choice responses at the atomic Redis budget', () => {
    const choicesAtLimit = Array.from(
      { length: MAX_LIVE_QUIZ_CHOICES },
      (_, ix) => ({ ix, selected: ix === 0 })
    )

    expect(
      validateStudentResponse({
        type: 'MC',
        response: { choices: choicesAtLimit },
        choiceCount: MAX_LIVE_QUIZ_CHOICES,
      }).valid
    ).toBe(true)
    expect(
      validateStudentResponse({
        type: 'MC',
        response: {
          choices: [
            ...choicesAtLimit,
            { ix: MAX_LIVE_QUIZ_CHOICES, selected: true },
          ],
        },
        choiceCount: MAX_LIVE_QUIZ_CHOICES + 1,
      }).valid
    ).toBe(false)
  })

  it('requires selection responses to match the configured input shape', () => {
    const validationShape = {
      numberOfInputs: 2,
      selectionAnswerIds: [10, 20, 30],
    }

    expect(
      validateStudentResponse({
        type: 'SELECTION',
        response: { selection: [10, -1] },
        validationShape,
      }).valid
    ).toBe(true)
    expect(
      validateStudentResponse({
        type: 'SELECTION',
        response: { selection: [10] },
        validationShape,
      }).valid
    ).toBe(false)
    expect(
      validateStudentResponse({
        type: 'SELECTION',
        response: { selection: [10, 999] },
        validationShape,
      }).valid
    ).toBe(false)
  })

  it('requires case-study responses to match configured identifiers', () => {
    const validationShape = {
      caseStudy: {
        caseIds: ['case-1'],
        itemIds: [11, 12],
        criterionIds: ['criterion-1'],
      },
    }

    expect(
      validateStudentResponse({
        type: 'CASE_STUDY',
        response: {
          assessment: {
            'case-1': {
              11: { 'criterion-1': 1 },
              12: { 'criterion-1': 2 },
            },
          },
        },
        validationShape,
      }).valid
    ).toBe(true)
    expect(
      validateStudentResponse({
        type: 'CASE_STUDY',
        response: {
          assessment: {
            'case-1': {
              11: { 'unexpected-criterion': 1 },
              12: { 'criterion-1': 2 },
            },
          },
        },
        validationShape,
      }).valid
    ).toBe(false)
  })

  it('bounds legacy case-study blocks without cached shape metadata', () => {
    const oversizedAssessment = Object.fromEntries(
      Array.from({ length: 1001 }, (_, index) => [
        String(index + 1),
        { criterion: index },
      ])
    )

    expect(
      validateStudentResponse({
        type: 'CASE_STUDY',
        response: { assessment: { legacy: oversizedAssessment } },
      }).valid
    ).toBe(false)
  })

  it('parses validation metadata from the active instance cache', () => {
    expect(
      getLiveQuizResponseValidationShape({
        numberOfInputs: '2',
        selectionAnswerIds: '[10,20]',
        caseStudyResponseShape:
          '{"caseIds":["case-1"],"itemIds":[11],"criterionIds":["criterion-1"]}',
      })
    ).toEqual({
      numberOfInputs: 2,
      selectionAnswerIds: [10, 20],
      caseStudy: {
        caseIds: ['case-1'],
        itemIds: [11],
        criterionIds: ['criterion-1'],
      },
    })
  })
})
