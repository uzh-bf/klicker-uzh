import { Locale } from '@klicker-uzh/prisma/client'
import { describe, expect, it } from 'vitest'
import {
  CHATBOT_STANDARD_MODE_SCOPE_NOTE_MAX_LENGTH,
  getEffectiveChatbotStandardModeFlags,
  isChatbotStandardModeKey,
  normalizeChatbotStandardModeConfig,
  parseChatbotStandardModeConfigForStorage,
  parseChatbotStandardModeConfigInput,
  parseStoredChatbotStandardModeConfig,
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

  it('accepts Quizzer-only and all-off owner input with an explicit storage marker', () => {
    const quizzerOnly = {
      tutorEnabled: false,
      explainerEnabled: false,
      quizzerEnabled: true,
    }
    expect(parseChatbotStandardModeConfigInput(quizzerOnly)).toMatchObject(
      quizzerOnly
    )
    expect(parseChatbotStandardModeConfigForStorage(quizzerOnly)).toEqual({
      ...quizzerOnly,
      writingCoachEnabled: false,
      courseName: null,
      subjectDomain: null,
      languageOfInstruction: null,
      scopeNote: null,
      explicitModeSelection: true,
    })

    const allOff = { ...quizzerOnly, quizzerEnabled: false }
    expect(parseChatbotStandardModeConfigForStorage(allOff)).toMatchObject({
      ...allOff,
      explicitModeSelection: true,
    })
    expect(
      parseChatbotStandardModeConfigForStorage({
        ...allOff,
        tutorEnabled: true,
      })
    ).not.toHaveProperty('explicitModeSelection')
  })

  it('never accepts the private marker through public mutation input', () => {
    expect(() =>
      parseChatbotStandardModeConfigInput({
        tutorEnabled: false,
        explainerEnabled: false,
        quizzerEnabled: true,
        explicitModeSelection: true,
      })
    ).toThrow('explicitModeSelection is internal')
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

  it('distinguishes marked Quizzer-only storage from the same legacy all-off flags', () => {
    const quizzerOnly = {
      tutorEnabled: false,
      explainerEnabled: false,
      quizzerEnabled: true,
      writingCoachEnabled: false,
    }
    const legacyShape = {
      ...quizzerOnly,
      courseName: null,
      subjectDomain: null,
      languageOfInstruction: null,
      scopeNote: null,
    }

    expect(
      parseStoredChatbotStandardModeConfig({
        ...legacyShape,
        explicitModeSelection: true,
      })
    ).toEqual(legacyShape)
    expect(normalizeChatbotStandardModeConfig(legacyShape)).toMatchObject({
      tutorEnabled: true,
      explainerEnabled: true,
      quizzerEnabled: true,
      writingCoachEnabled: false,
    })
    expect(
      getEffectiveChatbotStandardModeFlags({
        ...legacyShape,
        explicitModeSelection: true,
      })
    ).toEqual({
      tutorEnabled: false,
      explainerEnabled: false,
      quizzerEnabled: true,
      writingCoachEnabled: false,
    })
  })

  it.each([
    { explicitModeSelection: false },
    { explicitModeSelection: 'true' },
    { explicitModeSelection: true, tutorEnabled: true },
    { explicitModeSelection: true, writingCoachEnabled: undefined },
    { explicitModeSelection: true, quizzerEnabled: undefined },
  ])('rejects an invalid all-off storage marker %#', (marker) => {
    const value = {
      tutorEnabled: false,
      explainerEnabled: false,
      quizzerEnabled: false,
      writingCoachEnabled: false,
      courseName: null,
      subjectDomain: null,
      languageOfInstruction: null,
      scopeNote: null,
      ...marker,
    }

    expect(() => parseStoredChatbotStandardModeConfig(value)).toThrow()
    expect(normalizeChatbotStandardModeConfig(value)).toMatchObject({
      tutorEnabled: true,
      explainerEnabled: true,
      quizzerEnabled: true,
      writingCoachEnabled: false,
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

  it('recognizes the standard modes case-sensitively', () => {
    expect(isChatbotStandardModeKey('quizzer')).toBe(true)
    expect(isChatbotStandardModeKey('Quizzer')).toBe(false)
    expect(isChatbotStandardModeKey('case-interview')).toBe(false)
  })
})
