import { Locale } from '@klicker-uzh/prisma/client'
import { describe, expect, it } from 'vitest'
import {
  CHATBOT_STANDARD_MODE_SCOPE_NOTE_MAX_LENGTH,
  getWritingCoachUnavailableReason,
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
      writingCoachEnabled: false,
      courseName: 'Economics',
      subjectDomain: 'Finance',
      languageOfInstruction: Locale.de,
      scopeNote: 'First line\nSecond line',
    })
  })

  it('rejects Quizzer as the only conversational mode', () => {
    expect(() =>
      parseChatbotStandardModeConfigInput({
        tutorEnabled: false,
        explainerEnabled: false,
        quizzerEnabled: true,
      })
    ).toThrow()
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
    ).toThrow()
  })

  it('treats null and malformed persisted values as legacy defaults', () => {
    expect(normalizeChatbotStandardModeConfig(null)).toEqual({
      tutorEnabled: true,
      explainerEnabled: true,
      quizzerEnabled: true,
      writingCoachEnabled: false,
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
      writingCoachEnabled: false,
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

  it('accepts the full context limit and a standalone Writing Coach', () => {
    const scopeNote = 'x'.repeat(CHATBOT_STANDARD_MODE_SCOPE_NOTE_MAX_LENGTH)
    const config = {
      tutorEnabled: false,
      explainerEnabled: false,
      quizzerEnabled: false,
      writingCoachEnabled: true,
      scopeNote,
    }
    expect(parseChatbotStandardModeConfigInput(config)).toMatchObject(config)
    expect(normalizeChatbotStandardModeConfig(config)).toMatchObject(config)
  })

  it.each([
    null,
    {},
    { tutorEnabled: true, explainerEnabled: false, quizzerEnabled: false },
  ])('keeps Writing Coach off for historical configuration %j', (config) => {
    expect(normalizeChatbotStandardModeConfig(config).writingCoachEnabled).toBe(
      false
    )
  })

  it('rejects a non-boolean Writing Coach flag', () => {
    expect(() =>
      parseChatbotStandardModeConfigInput({
        tutorEnabled: true,
        explainerEnabled: false,
        quizzerEnabled: false,
        writingCoachEnabled: 'true',
      })
    ).toThrow()
  })

  it('explains custom collisions and required-tool exclusions without inheriting tools', () => {
    const requiredTutor = { chatMode: 'tutor', parameters: { required: true } }
    expect(getWritingCoachUnavailableReason(null)).toBeNull()
    expect(
      getWritingCoachUnavailableReason({ 'writing-coach': { enabled: false } })
    ).toBe('CUSTOM_MODE_COLLISION')
    expect(getWritingCoachUnavailableReason(null, [requiredTutor])).toBe(
      'REQUIRED_TOOL_BINDING'
    )
    expect(
      getWritingCoachUnavailableReason(null, [
        { ...requiredTutor, isEnabled: false },
      ])
    ).toBeNull()
    expect(
      getWritingCoachUnavailableReason(null, [
        requiredTutor,
        { chatMode: 'writing-coach' },
      ])
    ).toBe('REQUIRED_TOOL_BINDING')
    expect(
      getWritingCoachUnavailableReason(null, [
        requiredTutor,
        { ...requiredTutor, chatMode: 'writing-coach' },
      ])
    ).toBeNull()
  })
})
