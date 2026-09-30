import { describe, expect, test } from 'vitest'
import { parseNumberDraft } from '../src/components/resources/competenceTrees/numberDraft'

describe('parseNumberDraft', () => {
  test('reports an empty draft as required instead of coercing it', () => {
    expect(parseNumberDraft('')).toEqual({ ok: false, error: 'required' })
    expect(parseNumberDraft('  ')).toEqual({ ok: false, error: 'required' })
  })

  test('reports incomplete input as invalid', () => {
    expect(parseNumberDraft('-')).toEqual({ ok: false, error: 'invalid' })
    expect(parseNumberDraft('.')).toEqual({ ok: false, error: 'invalid' })
  })

  test('enforces the configured bounds', () => {
    expect(parseNumberDraft('1', { min: 2 })).toEqual({
      ok: false,
      error: 'min',
    })
    expect(parseNumberDraft('6', { min: 1, max: 5 })).toEqual({
      ok: false,
      error: 'max',
    })
  })

  test('parses valid drafts, including the bounds themselves', () => {
    expect(parseNumberDraft('2', { min: 2, max: 1000 })).toEqual({
      ok: true,
      value: 2,
    })
    expect(parseNumberDraft('0.5', { min: 0.001 })).toEqual({
      ok: true,
      value: 0.5,
    })
    expect(parseNumberDraft('5', { max: 5 })).toEqual({ ok: true, value: 5 })
  })
})
