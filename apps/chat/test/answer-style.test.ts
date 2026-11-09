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
    for (const style of ['balanced', 'bullets']) {
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
    const { useSettingsStore } = await import('../src/stores/settingsStore')

    expect(useSettingsStore.getState()).toMatchObject({
      answerStyle: DEFAULT_ANSWER_STYLE,
      answerTone: DEFAULT_ANSWER_TONE,
    })

    useSettingsStore.getState().setAnswerStyle('bullets')
    useSettingsStore.getState().setAnswerTone('friendly')
    expect(
      JSON.parse(items.get('settings-storage') ?? '{}').state
    ).toMatchObject({ answerStyle: 'bullets', answerTone: 'friendly' })

    items.set(
      'settings-storage',
      JSON.stringify({
        state: { answerStyle: 'bullets', answerTone: 'direct' },
        version: 0,
      })
    )
    await useSettingsStore.persist.rehydrate()
    expect(useSettingsStore.getState()).toMatchObject({
      answerStyle: 'bullets',
      answerTone: 'direct',
    })
  })
})
