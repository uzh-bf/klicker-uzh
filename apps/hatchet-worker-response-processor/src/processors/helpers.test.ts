import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validateStudentResponse } from './helpers.js'

describe('validateStudentResponse', () => {
  it('accepts valid SC, MC and KPRIM responses', () => {
    assert.deepEqual(
      validateStudentResponse({
        type: 'SC',
        response: { choices: [{ ix: 0, selected: true }] },
      }),
      { valid: true }
    )
    assert.deepEqual(
      validateStudentResponse({
        type: 'MC',
        response: {
          choices: [
            { ix: 0, selected: true },
            { ix: 1, selected: false },
          ],
        },
      }),
      { valid: true }
    )
    assert.deepEqual(
      validateStudentResponse({
        type: 'KPRIM',
        response: {
          choices: [
            { ix: 0, selected: true },
            { ix: 1, selected: false },
            { ix: 2, selected: true },
            { ix: 3, selected: false },
          ],
        },
      }),
      { valid: true }
    )
  })

  it('accepts valid numerical, free-text, selection and content responses', () => {
    assert.deepEqual(
      validateStudentResponse({
        type: 'NUMERICAL',
        response: { value: '42.5' },
      }),
      { valid: true }
    )
    assert.deepEqual(
      validateStudentResponse({
        type: 'FREE_TEXT',
        response: { value: 'an answer' },
      }),
      { valid: true }
    )
    assert.deepEqual(
      validateStudentResponse({
        type: 'SELECTION',
        response: { selection: [0, 2, -1] },
      }),
      { valid: true }
    )
    assert.deepEqual(
      validateStudentResponse({
        type: 'CONTENT',
        response: { viewed: true },
      }),
      { valid: true }
    )
  })

  it('accepts the ordinary case-study payload shape', () => {
    // regression guard: the item level maps criterion ids directly to
    // numeric responses; the validator must not require another object level
    const result = validateStudentResponse({
      type: 'CASE_STUDY',
      response: {
        assessment: {
          'case-1': {
            42: { 'criterion-1': 3 },
          },
        },
      },
    })
    assert.deepEqual(result, { valid: true })
  })

  it('accepts a case study spanning multiple cases, items and criteria', () => {
    assert.deepEqual(
      validateStudentResponse({
        type: 'CASE_STUDY',
        response: {
          assessment: {
            'case-1': {
              1: { 'criterion-1': 1, 'criterion-2': 0 },
              2: { 'criterion-1': -2 },
            },
            'case-2': {
              3: { 'criterion-1': 4 },
            },
          },
        },
      }),
      { valid: true }
    )
  })

  it('accepts fractional criterion responses from step-configured ranges', () => {
    // criteria are numerical-range answers (e.g. 0-5 with step 0.5), so a
    // fractional slider value is a legitimate response
    assert.deepEqual(
      validateStudentResponse({
        type: 'CASE_STUDY',
        response: {
          assessment: { 'case-1': { 42: { 'criterion-1': 2.5 } } },
        },
      }),
      { valid: true }
    )
  })

  it('rejects non-finite and non-numeric criterion responses', () => {
    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(
        validateStudentResponse({
          type: 'CASE_STUDY',
          response: {
            assessment: { 'case-1': { 1: { 'criterion-1': invalid } } },
          },
        }).valid,
        false
      )
    }
    assert.equal(
      validateStudentResponse({
        type: 'CASE_STUDY',
        response: {
          assessment: {
            'case-1': {
              1: {
                // deliberately malformed runtime input: string criterion
                // @ts-expect-error
                'criterion-1': '3',
              },
            },
          },
        },
      }).valid,
      false
    )
  })

  it('rejects a case study with an extra object nesting level', () => {
    assert.equal(
      validateStudentResponse({
        type: 'CASE_STUDY',
        response: {
          assessment: {
            'case-1': {
              1: {
                // deliberately malformed runtime input: object where the
                // typed criterion response expects a number
                // @ts-expect-error
                'criterion-1': { value: 3 },
              },
            },
          },
        },
      }).valid,
      false
    )
  })

  it('rejects a case study with empty criteria, items or cases', () => {
    assert.equal(
      validateStudentResponse({
        type: 'CASE_STUDY',
        response: { assessment: { 'case-1': {} } },
      }).valid,
      false
    )
    assert.equal(
      validateStudentResponse({
        type: 'CASE_STUDY',
        response: { assessment: { 'case-1': { 1: {} } } },
      }).valid,
      false
    )
    assert.equal(
      validateStudentResponse({
        type: 'CASE_STUDY',
        response: { assessment: {} },
      }).valid,
      false
    )
  })

  it('rejects selection entries that collide with reserved aggregate field names', () => {
    const result = validateStudentResponse({
      type: 'SELECTION',
      response: {
        // deliberately malformed runtime input: a crafted string field name
        // @ts-expect-error
        selection: ['participants'],
      },
    })
    assert.equal(result.valid, false)

    // integer entries remain valid
    assert.equal(
      validateStudentResponse({
        type: 'SELECTION',
        response: { selection: [3, 7] },
      }).valid,
      true
    )
  })

  it('rejects fractional and non-numeric selection entries', () => {
    assert.equal(
      validateStudentResponse({
        type: 'SELECTION',
        response: { selection: [1.5] },
      }).valid,
      false
    )
    assert.equal(
      validateStudentResponse({
        type: 'SELECTION',
        response: {
          // deliberately malformed runtime input: null sentinel entry
          // @ts-expect-error
          selection: [null, -1],
        },
      }).valid,
      false
    )
  })

  it('rejects choice indices outside the question definition when known', () => {
    assert.equal(
      validateStudentResponse({
        type: 'SC',
        response: { choices: [{ ix: 4, selected: true }] },
        choiceCount: '4',
      }).valid,
      false
    )
    assert.equal(
      validateStudentResponse({
        type: 'SC',
        response: { choices: [{ ix: 3, selected: true }] },
        choiceCount: '4',
      }).valid,
      true
    )
  })

  it('rejects oversized collections', () => {
    const oversizedSelection = Array.from({ length: 1001 }, (_, ix) => ix)
    assert.equal(
      validateStudentResponse({
        type: 'SELECTION',
        response: { selection: oversizedSelection },
      }).valid,
      false
    )

    const oversizedChoices = Array.from({ length: 1001 }, (_, ix) => ({
      ix,
      selected: ix === 0,
    }))
    assert.equal(
      validateStudentResponse({
        type: 'MC',
        response: { choices: oversizedChoices },
      }).valid,
      false
    )
  })

  it('rejects numerical responses outside declared restrictions', () => {
    assert.equal(
      validateStudentResponse({
        type: 'NUMERICAL',
        response: { value: '15' },
        restrictions: { min: 0, max: 10 },
      }).valid,
      false
    )
  })
})
