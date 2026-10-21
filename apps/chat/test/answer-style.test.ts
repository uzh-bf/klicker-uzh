import { describe, expect, test, vi } from 'vitest'
import {
  DEFAULT_ANSWER_STYLE,
  DEFAULT_ANSWER_TONE,
} from '../src/lib/config/answerStyles'
import {
  answerStyleSchema,
  answerToneSchema,
} from '../src/lib/server/answerStyleInstructions'

describe('answer preference request fields', () => {
  test('accepts every style and tone', () => {
    for (const style of ['balanced', 'detailed', 'brief', 'bullets']) {
      expect(answerStyleSchema.parse(style)).toBe(style)
    }
    for (const tone of ['neutral', 'friendly', 'direct']) {
      expect(answerToneSchema.parse(tone)).toBe(tone)
    }
  })

  test('falls back to the defaults for missing or unknown values', () => {
    for (const value of [undefined, null, '', 'shouty', 3, { style: 'x' }]) {
      expect(answerStyleSchema.parse(value)).toBe(DEFAULT_ANSWER_STYLE)
      expect(answerToneSchema.parse(value)).toBe(DEFAULT_ANSWER_TONE)
    }
  })
})

describe('answer preference settings', () => {
  test('default to balanced and neutral and persist across rehydration', async () => {
    // zustand's persist middleware reads `window.localStorage` once, when the
    // store is created, so the node environment needs an in-memory stand-in
    // before the store module is imported.
    const items = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => items.get(key) ?? null,
        setItem: (key: string, value: string) => void items.set(key, value),
        removeItem: (key: string) => void items.delete(key),
      },
    })
    const { answerStyleForChatbot, useSettingsStore } = await import(
      '../src/stores/settingsStore'
    )
    const styleOf = (chatbotId: string) =>
      answerStyleForChatbot(useSettingsStore.getState(), chatbotId)

    expect(styleOf('chatbot-a')).toBe(DEFAULT_ANSWER_STYLE)
    expect(useSettingsStore.getState().answerTone).toBe(DEFAULT_ANSWER_TONE)

    // The style is kept per chatbot; the tone applies to every chatbot.
    useSettingsStore.getState().setAnswerStyle('chatbot-a', 'bullets')
    useSettingsStore.getState().setAnswerTone('friendly')
    expect(styleOf('chatbot-a')).toBe('bullets')
    expect(styleOf('chatbot-b')).toBe(DEFAULT_ANSWER_STYLE)
    expect(
      JSON.parse(items.get('settings-storage') ?? '{}').state
    ).toMatchObject({
      answerStyles: { 'chatbot-a': 'bullets' },
      answerTone: 'friendly',
    })

    // Choosing the default again removes the stored entry.
    useSettingsStore
      .getState()
      .setAnswerStyle('chatbot-a', DEFAULT_ANSWER_STYLE)
    expect(useSettingsStore.getState().answerStyles).toEqual({})

    items.set(
      'settings-storage',
      JSON.stringify({
        state: {
          answerStyles: { 'chatbot-b': 'detailed' },
          answerTone: 'direct',
        },
        version: 0,
      })
    )
    await useSettingsStore.persist.rehydrate()
    expect(styleOf('chatbot-b')).toBe('detailed')
    expect(styleOf('chatbot-a')).toBe(DEFAULT_ANSWER_STYLE)
    expect(useSettingsStore.getState().answerTone).toBe('direct')
  })
})
