import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useSettingsStore } from '../src/stores/settingsStore'

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function modesResponse(mode: string) {
  return {
    ok: true,
    json: async () => ({
      systemPrompts: { [mode]: { description: `${mode} mode` } },
    }),
  }
}

describe('settingsStore mode loading', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useSettingsStore.setState({
      modeOptions: {},
      modeOptionsChatbotId: null,
      selectedMode: 'tutor',
    })
  })

  test('clears persisted mode context until the current chatbot is loaded', async () => {
    const pending = deferred<ReturnType<typeof modesResponse>>()
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(pending.promise))

    const load = useSettingsStore.getState().loadModeOptions('chatbot-1')

    expect(useSettingsStore.getState().modeOptions).toEqual({})
    expect(useSettingsStore.getState().modeOptionsChatbotId).toBeNull()

    pending.resolve(modesResponse('explainer'))
    await load

    expect(useSettingsStore.getState().modeOptionsChatbotId).toBe('chatbot-1')
  })

  test('ignores a stale response from a previous chatbot', async () => {
    const first = deferred<ReturnType<typeof modesResponse>>()
    const second = deferred<ReturnType<typeof modesResponse>>()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
    )

    const firstLoad = useSettingsStore.getState().loadModeOptions('chatbot-1')
    const secondLoad = useSettingsStore.getState().loadModeOptions('chatbot-2')

    second.resolve(modesResponse('explainer'))
    await secondLoad
    first.resolve(modesResponse('tutor'))
    await firstLoad

    expect(useSettingsStore.getState().modeOptionsChatbotId).toBe('chatbot-2')
    expect(useSettingsStore.getState().modeOptions).toEqual({
      explainer: 'explainer mode',
    })
  })

  test('keeps a selected mode whose description is empty', async () => {
    useSettingsStore.setState({ selectedMode: 'custom' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          systemPrompts: {
            tutor: { description: 'Tutor mode' },
            custom: { description: '' },
          },
        }),
      })
    )

    await useSettingsStore.getState().loadModeOptions('chatbot-1')

    expect(useSettingsStore.getState().selectedMode).toBe('custom')
    expect(useSettingsStore.getState().modeOptions).toEqual({
      tutor: 'Tutor mode',
      custom: '',
    })
  })

  test('keeps initial chatbot modes when the mode refresh fails', async () => {
    useSettingsStore.setState({ selectedMode: 'explainer' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    await useSettingsStore.getState().loadModeOptions('chatbot-1', {
      explainer: 'Explainer mode',
    })

    expect(useSettingsStore.getState().selectedMode).toBe('explainer')
    expect(useSettingsStore.getState().modeOptions).toEqual({
      explainer: 'Explainer mode',
    })
  })

  test('keeps initial chatbot modes on a non-ok mode refresh', async () => {
    useSettingsStore.setState({ selectedMode: 'custom' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      })
    )

    await useSettingsStore.getState().loadModeOptions('chatbot-1', {
      custom: 'Custom mode',
    })

    expect(useSettingsStore.getState().selectedMode).toBe('custom')
    expect(useSettingsStore.getState().modeOptions).toEqual({
      custom: 'Custom mode',
    })
  })
})
