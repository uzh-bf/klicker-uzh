import * as DB from '@klicker-uzh/prisma/client'
import { describe, expect, it } from 'vitest'
import {
  getCodeActivityStackViolation,
  isAsynchronousActivityElementValid,
  isTemplateElementTypeSupported,
} from '../src/lib/codeElementPolicy.js'

describe('CODE element activity policy', () => {
  it('keeps CODE instances valid without requiring a sample solution', () => {
    expect(isAsynchronousActivityElementValid(DB.ElementType.CODE, false)).toBe(
      true
    )
  })

  it('rejects CODE elements from activity templates in v1', () => {
    expect(isTemplateElementTypeSupported(DB.ElementType.CODE)).toBe(false)
    expect(isTemplateElementTypeSupported(DB.ElementType.NUMERICAL)).toBe(true)
  })

  it('accepts regular stacks for every activity type', () => {
    expect(
      getCodeActivityStackViolation(
        [DB.ElementType.NUMERICAL, DB.ElementType.FREE_TEXT],
        false
      )
    ).toBeNull()
  })

  it('accepts a CODE-only stack in supported activity types', () => {
    expect(
      getCodeActivityStackViolation([DB.ElementType.CODE], true)
    ).toBeNull()
  })

  it('rejects CODE in unsupported activity types', () => {
    expect(getCodeActivityStackViolation([DB.ElementType.CODE], false)).toBe(
      'UNSUPPORTED_ACTIVITY'
    )
  })

  it('rejects CODE in mixed or multi-element stacks', () => {
    expect(
      getCodeActivityStackViolation(
        [DB.ElementType.CODE, DB.ElementType.NUMERICAL],
        true
      )
    ).toBe('CODE_MUST_BE_ONLY_ELEMENT')

    expect(
      getCodeActivityStackViolation(
        [DB.ElementType.CODE, DB.ElementType.CODE],
        true
      )
    ).toBe('CODE_MUST_BE_ONLY_ELEMENT')
  })
})
