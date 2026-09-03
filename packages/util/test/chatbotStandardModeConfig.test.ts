import { Locale } from '@klicker-uzh/prisma/client'
import { describe, expect, it } from 'vitest'
import {
  normalizeChatbotStandardModeConfig,
  parseChatbotStandardModeConfigInput,
} from '../src/chatbotStandardModeConfig.js'

describe('chatbot standard mode configuration', () => {
  it('canonicalizes bounded full replacements', () => {
    expect(
      parseChatbotStandardModeConfigInput({
        tutorEnabled: true,
        explainerEnabled: false,
        courseName: '  Economics  ',
        subjectDomain: '  Finance ',
        languageOfInstruction: Locale.de,
        scopeNote: '  First line\r\nSecond line  ',
      })
    ).toEqual({
      tutorEnabled: true,
      explainerEnabled: false,
      courseName: 'Economics',
      subjectDomain: 'Finance',
      languageOfInstruction: Locale.de,
      scopeNote: 'First line\nSecond line',
    })
  })

  it('rejects a replacement that disables every standard mode', () => {
    expect(() =>
      parseChatbotStandardModeConfigInput({
        tutorEnabled: false,
        explainerEnabled: false,
      })
    ).toThrow('At least one standard mode must be enabled')
  })

  it('rejects multiline single-line fields and overlong scope notes', () => {
    expect(() =>
      parseChatbotStandardModeConfigInput({
        tutorEnabled: true,
        explainerEnabled: false,
        courseName: 'Economics\n101',
      })
    ).toThrow('courseName must be a single line')

    expect(() =>
      parseChatbotStandardModeConfigInput({
        tutorEnabled: true,
        explainerEnabled: false,
        scopeNote: 'x'.repeat(1001),
      })
    ).toThrow('scopeNote must be at most 1000 characters long')
  })

  it('treats null and malformed persisted values as legacy defaults', () => {
    expect(normalizeChatbotStandardModeConfig(null)).toBeNull()
    expect(
      normalizeChatbotStandardModeConfig({
        tutorEnabled: false,
        explainerEnabled: false,
      })
    ).toBeNull()
    expect(
      normalizeChatbotStandardModeConfig({
        tutorEnabled: true,
        explainerEnabled: false,
        courseName: 'Tutor',
      })
    ).toMatchObject({ tutorEnabled: true, explainerEnabled: false })
  })
})
