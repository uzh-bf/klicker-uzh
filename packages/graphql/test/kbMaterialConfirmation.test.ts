import { createHash } from 'node:crypto'
import type { GraphQLError } from 'graphql'
import { describe, expect, it } from 'vitest'
import {
  assertKbMaterialConfirmation,
  getKbMaterialScopeFingerprint,
  KB_MATERIAL_NOTICE_VERSION,
  KB_MATERIAL_PURPOSE,
  type KbMaterialConfirmationInput,
} from '../src/lib/kbMaterialConfirmation.js'

describe('KB material confirmation', () => {
  it('exports the approved notice version and purpose', () => {
    expect(KB_MATERIAL_NOTICE_VERSION).toBe('2026-09-09')
    expect(KB_MATERIAL_PURPOSE).toBe('KB_PREPARATION_AND_CHATBOT_ANSWERS')
  })

  it('accepts both explicit confirmations with the current notice', () => {
    const input: KbMaterialConfirmationInput = {
      rightsConfirmed: true,
      personalDataConfirmed: true,
      noticeVersion: KB_MATERIAL_NOTICE_VERSION,
    }

    expect(() => assertKbMaterialConfirmation(input)).not.toThrow()
  })

  it.each([
    { rightsConfirmed: false, personalDataConfirmed: true },
    { rightsConfirmed: true, personalDataConfirmed: false },
    { rightsConfirmed: null, personalDataConfirmed: true },
    { rightsConfirmed: true, personalDataConfirmed: null },
    { rightsConfirmed: undefined, personalDataConfirmed: true },
    { rightsConfirmed: true, personalDataConfirmed: undefined },
  ])('requires both confirmations to be explicitly true', (confirmation) => {
    expect(() =>
      assertKbMaterialConfirmation({
        ...confirmation,
        noticeVersion: KB_MATERIAL_NOTICE_VERSION,
      })
    ).toThrowError(
      expect.objectContaining<Partial<GraphQLError>>({
        extensions: { code: 'KB_MATERIAL_CONFIRMATION_REQUIRED' },
      })
    )
  })

  it.each([
    undefined,
    null,
    '2026-09-08',
  ])('rejects a missing or stale notice version (%s)', (noticeVersion) => {
    expect(() =>
      assertKbMaterialConfirmation({
        rightsConfirmed: true,
        personalDataConfirmed: true,
        noticeVersion,
      })
    ).toThrowError(
      expect.objectContaining<Partial<GraphQLError>>({
        extensions: { code: 'KB_MATERIAL_NOTICE_STALE' },
      })
    )
  })
})

describe('KB material scope fingerprint', () => {
  it('accepts an empty scope', () => {
    expect(getKbMaterialScopeFingerprint([])).toMatch(/^[a-f0-9]{64}$/)
  })

  it('is invariant to order and duplicate bindings', () => {
    const first = getKbMaterialScopeFingerprint([
      { chatbotId: 'chatbot-b', courseId: 'course-b' },
      { chatbotId: 'chatbot-a', courseId: null },
      { chatbotId: 'chatbot-b', courseId: 'course-b' },
    ])
    const second = getKbMaterialScopeFingerprint([
      { chatbotId: 'chatbot-a', courseId: null },
      { chatbotId: 'chatbot-b', courseId: 'course-b' },
    ])

    expect(first).toBe(second)
  })

  it('hashes the fixed purpose and canonical sorted bindings', () => {
    const expected = createHash('sha256')
      .update(
        JSON.stringify({
          purpose: KB_MATERIAL_PURPOSE,
          bindings: [
            { chatbotId: 'chatbot-a', courseId: null },
            { chatbotId: 'chatbot-b', courseId: 'course-b' },
          ],
        })
      )
      .digest('hex')

    expect(
      getKbMaterialScopeFingerprint([
        { chatbotId: 'chatbot-b', courseId: 'course-b' },
        { chatbotId: 'chatbot-a', courseId: null },
      ])
    ).toBe(expected)
  })

  it('rejects conflicting course bindings for one chatbot', () => {
    expect(() =>
      getKbMaterialScopeFingerprint([
        { chatbotId: 'chatbot-a', courseId: null },
        { chatbotId: 'chatbot-a', courseId: 'course-a' },
      ])
    ).toThrow()
  })
})
