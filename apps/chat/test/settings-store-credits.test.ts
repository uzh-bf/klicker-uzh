import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useSettingsStore } from '../src/stores/settingsStore'

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function creditsResponse(
  current: number,
  options: {
    availableModels?: unknown[]
    automaticModelId?: string
  } = {}
) {
  return {
    ok: true,
    json: async () => ({
      current,
      total: 100,
      nextResetAt: null,
      availableModels: options.availableModels ?? [],
      automaticModelId: options.automaticModelId,
    }),
  }
}

describe('settingsStore credits loading', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    useSettingsStore.setState({
      credits: { current: 0, total: 0, nextResetAt: null },
      creditsLoaded: false,
      modelOptions: [],
      modeOptions: {},
      modeOptionsChatbotId: null,
    })
  })

  test('ignores a stale response from a previous chatbot request', async () => {
    const first = deferred<ReturnType<typeof creditsResponse>>()
    const second = deferred<ReturnType<typeof creditsResponse>>()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
    )

    const firstLoad = useSettingsStore.getState().loadCredits('chatbot-1')
    const secondLoad = useSettingsStore.getState().loadCredits('chatbot-2')

    second.resolve(creditsResponse(20))
    await secondLoad
    first.resolve(creditsResponse(99))
    await firstLoad

    expect(useSettingsStore.getState().credits.current).toBe(20)
    expect(useSettingsStore.getState().creditsLoaded).toBe(true)
  })

  test('keeps the last known balance visible across a failed refresh', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(creditsResponse(30)))
    await useSettingsStore.getState().loadCredits('chatbot-1')
    expect(useSettingsStore.getState().creditsLoaded).toBe(true)

    const failed = deferred<{
      ok: false
      statusText: string
    }>()
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(failed.promise))
    const refresh = useSettingsStore.getState().loadCredits('chatbot-1')

    expect(useSettingsStore.getState().creditsLoaded).toBe(true)
    failed.resolve({ ok: false, statusText: 'Unavailable' })
    await refresh
    expect(useSettingsStore.getState().creditsLoaded).toBe(true)
    expect(useSettingsStore.getState().credits.current).toBe(30)
  })

  test('hides the footer instead of pinning the previous chatbot balance when a cross-chatbot load fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(creditsResponse(40)))
    await useSettingsStore.getState().loadCredits('chatbot-a')
    expect(useSettingsStore.getState().creditsLoaded).toBe(true)

    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')))
    await useSettingsStore.getState().loadCredits('chatbot-b')

    expect(useSettingsStore.getState().creditsLoaded).toBe(false)
  })

  test('stays unloaded when the very first load fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')))
    await useSettingsStore.getState().loadCredits('chatbot-1')

    expect(useSettingsStore.getState().creditsLoaded).toBe(false)
  })

  test('replaces a persisted unavailable model with the credit-safe fallback', async () => {
    useSettingsStore.setState({
      modelSelectionEnabled: true,
      selectedModel: 'gpt-5.6-luna',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        creditsResponse(0, {
          automaticModelId: 'gpt-4.1-mini',
          availableModels: [
            {
              id: 'gpt-4.1-mini',
              name: 'GPT-4.1 Mini',
              description: 'fallback',
              fallback: true,
              supportsReasoning: false,
              allowedReasoningEfforts: [],
              supportsImageAttachments: true,
            },
          ],
        })
      )
    )

    await useSettingsStore.getState().loadCredits('chatbot-fallback')

    expect(useSettingsStore.getState().selectedModel).toBe('gpt-4.1-mini')
    expect(useSettingsStore.getState().modelOptions).toHaveLength(1)
  })
})
