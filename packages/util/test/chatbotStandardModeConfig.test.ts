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
        quizzerEnabled: true,
        courseName: '  Economics  ',
        subjectDomain: '  Finance ',
        languageOfInstruction: Locale.de,
        scopeNote: '  First line\r\nSecond line  ',
      })
    ).toEqual({
      tutorEnabled: true,
      explainerEnabled: false,
      quizzerEnabled: true,
      courseName: 'Economics',
      subjectDomain: 'Finance',
      languageOfInstruction: Locale.de,
      scopeNote: 'First line\nSecond line',
    })
  })

  it('keeps Tutor or Explainer enabled even when Quizzer is enabled', () => {
    expect(() =>
      parseChatbotStandardModeConfigInput({
        tutorEnabled: false,
        explainerEnabled: false,
        quizzerEnabled: true,
      })
    ).toThrow('Tutor or Explainer must remain enabled')
  })

  it('requires Quizzer in strict mutation input', () => {
    expect(() =>
      parseChatbotStandardModeConfigInput({
        tutorEnabled: true,
        explainerEnabled: true,
      })
    ).toThrow('quizzerEnabled must be a boolean')
  })

  it('rejects multiline single-line fields and overlong scope notes', () => {
    expect(() =>
      parseChatbotStandardModeConfigInput({
        tutorEnabled: true,
        explainerEnabled: false,
        quizzerEnabled: true,
        courseName: 'Economics\n101',
      })
    ).toThrow('courseName must be a single line')

    expect(() =>
      parseChatbotStandardModeConfigInput({
        tutorEnabled: true,
        explainerEnabled: false,
        quizzerEnabled: true,
        scopeNote: 'x'.repeat(1001),
      })
    ).toThrow('scopeNote must be at most 1000 characters long')
  })

  it('treats null and malformed persisted values as legacy defaults', () => {
    expect(normalizeChatbotStandardModeConfig(null)).toEqual({
      tutorEnabled: true,
      explainerEnabled: true,
      quizzerEnabled: true,
      courseName: null,
      subjectDomain: null,
      languageOfInstruction: null,
      scopeNote: null,
    })
    expect(
      normalizeChatbotStandardModeConfig({
        tutorEnabled: false,
        explainerEnabled: false,
      })
    ).toMatchObject({
      tutorEnabled: true,
      explainerEnabled: true,
      quizzerEnabled: true,
    })
    expect(
      normalizeChatbotStandardModeConfig({
        tutorEnabled: true,
        explainerEnabled: false,
        courseName: 'Tutor',
      })
    ).toMatchObject({
      tutorEnabled: true,
      explainerEnabled: false,
      quizzerEnabled: true,
    })
  })

  it('preserves valid two-flag persisted values and derives Quizzer from legacy opt-out', () => {
    expect(
      normalizeChatbotStandardModeConfig(
        {
          tutorEnabled: true,
          explainerEnabled: false,
          courseName: 'Course',
          subjectDomain: 'Domain',
          languageOfInstruction: Locale.en,
          scopeNote: 'Scope',
        },
        { quizzer: { enabled: false } }
      )
    ).toEqual({
      tutorEnabled: true,
      explainerEnabled: false,
      quizzerEnabled: false,
      courseName: 'Course',
      subjectDomain: 'Domain',
      languageOfInstruction: Locale.en,
      scopeNote: 'Scope',
    })
  })

  it('derives all flags from legacy opt-outs for null or malformed persisted values', () => {
    expect(
      normalizeChatbotStandardModeConfig(
        { tutorEnabled: 'yes' },
        {
          tutor: { enabled: false },
          explainer: { enabled: true },
          quizzer: { enabled: false },
        }
      )
    ).toMatchObject({
      tutorEnabled: false,
      explainerEnabled: true,
      quizzerEnabled: false,
    })
  })
})
