import { describe, expect, test, vi } from 'vitest'
import { DEFAULT_ANSWER_STYLE } from '../src/lib/config/answerStyles'
import { answerStyleSchema } from '../src/lib/server/answerStyleInstructions'

describe('answer style request field', () => {
  test('accepts every preset', () => {
    for (const style of ['balanced', 'brief', 'bullets', 'detailed']) {
      expect(answerStyleSchema.parse(style)).toBe(style)
    }
  })

  test('falls back to the default for missing or unknown values', () => {
    for (const value of [undefined, null, '', 'shouty', 3, { style: 'x' }]) {
      expect(answerStyleSchema.parse(value)).toBe(DEFAULT_ANSWER_STYLE)
    }
  })
})

describe('answer style setting', () => {
  test('defaults to balanced and persists a choice across rehydration', async () => {
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

    expect(useSettingsStore.getState().answerStyle).toBe(DEFAULT_ANSWER_STYLE)

    useSettingsStore.getState().setAnswerStyle('bullets')
    expect(
      JSON.parse(items.get('settings-storage') ?? '{}').state
    ).toMatchObject({ answerStyle: 'bullets' })

    items.set(
      'settings-storage',
      JSON.stringify({ state: { answerStyle: 'detailed' }, version: 0 })
    )
    await useSettingsStore.persist.rehydrate()
    expect(useSettingsStore.getState().answerStyle).toBe('detailed')
  })
})
