import { describe, expect, it } from 'vitest'
import { validateFeedback } from '@/src/services/feedbackTool'

const learnerText =
  'Diversification reduce the risk because returns doesnt move together.\nI think its fine.'

const point = {
  label: 'Agreement',
  quote: 'Diversification reduce the risk',
  comment: 'Check whether the verb agrees with its subject.',
  status: 'improve',
}
const valid = {
  format: 'feedback/1',
  title: '',
  summary: '',
  strengths: [],
  points: [point],
  nextStep: 'Revise the verb forms.',
}

describe('validateFeedback', () => {
  it('accepts quotes that differ only in whitespace or typographic quotes', () => {
    const result = validateFeedback(
      {
        ...valid,
        strengths: [
          { text: 'Clear claim.', quote: 'returns doesnt move\ntogether.' },
        ],
      },
      learnerText.replace('I think', '\u201cI think')
    )
    expect(result.kind).toBe('feedback')
  })

  it('rejects a quote the learner never wrote so the model can repair it', () => {
    const result = validateFeedback(
      {
        ...valid,
        points: [{ ...point, quote: 'Diversification reduces the risk' }],
      },
      learnerText
    )
    expect(result).toMatchObject({ kind: 'feedback-invalid' })
    expect(result.kind === 'feedback-invalid' && result.errors[0]).toMatch(
      /^points\.0\.quote:/
    )
  })

  it('treats an empty quote as none and needs every field', () => {
    expect(
      validateFeedback({ ...valid, points: [{ ...point, quote: '' }] }, '').kind
    ).toBe('feedback')
    const { strengths: _omitted, ...withoutStrengths } = valid
    expect(validateFeedback(withoutStrengths, learnerText).kind).toBe(
      'feedback-invalid'
    )
  })

  it('caps the points to work on at five but allows longer rubrics', () => {
    expect(
      validateFeedback({ ...valid, points: Array(6).fill(point) }, learnerText)
        .kind
    ).toBe('feedback-invalid')
    const criterion = { ...point, status: 'met' }
    expect(
      validateFeedback(
        { ...valid, points: Array(7).fill(criterion) },
        learnerText
      ).kind
    ).toBe('feedback')
  })
})
