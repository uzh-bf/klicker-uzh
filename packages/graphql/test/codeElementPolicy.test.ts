import * as DB from '@klicker-uzh/prisma/client'
import { describe, expect, it } from 'vitest'
import {
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
})
