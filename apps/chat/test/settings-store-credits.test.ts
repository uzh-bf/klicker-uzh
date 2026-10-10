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

  test('shares pending bootstrap and returns only the loaded selection', async () => {
    const modes = deferred<Pick<Response, 'ok' | 'json'>>()
    const fetch = vi
      .fn()
      .mockReturnValueOnce(modes.promise)
      .mockResolvedValueOnce(
        creditsResponse(20, {
          automaticModelId: 'base-a',
          availableModels: [
            {
              id: 'base-a',
              supportsReasoning: false,
              allowedReasoningEfforts: [],
            },
          ],
        })
      )
    vi.stubGlobal('fetch', fetch)
    const first = useSettingsStore
      .getState()
      .ensureModelSelection('bootstrap-shared')
    const second = useSettingsStore
      .getState()
      .ensureModelSelection('bootstrap-shared')
    expect(fetch).toHaveBeenCalledTimes(1)
    modes.resolve({
      ok: true,
      json: async () => ({
        modelSelection: false,
        modeOptions: { tutor: { description: '' } },
      }),
    })

    await expect(first).resolves.toEqual({
      modelId: 'base-a',
      reasoningEffort: 'none',
    })
    await expect(second).resolves.toEqual({
      modelId: 'base-a',
      reasoningEffort: 'none',
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  test('rejects failed mode bootstrap and retries it on the next submission', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          modelSelection: false,
          modeOptions: { tutor: { description: '' } },
        }),
      })
      .mockResolvedValueOnce(
        creditsResponse(20, {
          automaticModelId: 'base-b',
          availableModels: [
            {
              id: 'base-b',
              supportsReasoning: false,
              allowedReasoningEfforts: [],
            },
          ],
        })
      )
    vi.stubGlobal('fetch', fetch)
    await expect(
      useSettingsStore.getState().ensureModelSelection('bootstrap-retry')
    ).rejects.toThrow()
    expect(fetch).toHaveBeenCalledTimes(1)
    await expect(
      useSettingsStore.getState().ensureModelSelection('bootstrap-retry')
    ).resolves.toEqual({ modelId: 'base-b', reasoningEffort: 'none' })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  test('rejects failed credits despite a prior same-bot load and permits a fresh attempt', async () => {
    const model = {
      id: 'base-c',
      supportsReasoning: false,
      allowedReasoningEfforts: [],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        creditsResponse(20, {
          automaticModelId: 'base-c',
          availableModels: [model],
        })
      )
    )
    await useSettingsStore.getState().loadCredits('bootstrap-credit-retry')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            modelSelection: false,
            modeOptions: { tutor: { description: '' } },
          }),
        })
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce(
          creditsResponse(20, {
            automaticModelId: 'base-c',
            availableModels: [model],
          })
        )
    )
    await expect(
      useSettingsStore.getState().ensureModelSelection('bootstrap-credit-retry')
    ).rejects.toThrow()
    await expect(
      useSettingsStore.getState().ensureModelSelection('bootstrap-credit-retry')
    ).resolves.toEqual({ modelId: 'base-c', reasoningEffort: 'none' })
  })

  test('rejects bootstrap superseded by another chatbot', async () => {
    const oldModes = deferred<Pick<Response, 'ok' | 'json'>>()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockReturnValueOnce(oldModes.promise)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            modelSelection: false,
            modeOptions: { tutor: { description: '' } },
          }),
        })
    )
    const oldAttempt = useSettingsStore
      .getState()
      .ensureModelSelection('bootstrap-old')
    await useSettingsStore.getState().loadModeOptions('bootstrap-new')
    oldModes.resolve({
      ok: true,
      json: async () => ({
        modelSelection: false,
        modeOptions: { tutor: { description: '' } },
      }),
    })
    await expect(oldAttempt).rejects.toThrow()
    expect(useSettingsStore.getState().modeOptionsChatbotId).toBe(
      'bootstrap-new'
    )
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

  test('preserves the selected usage class when participant credits are exhausted', async () => {
    useSettingsStore.setState({
      modelSelectionEnabled: true,
      selectedModel: 'gpt-4.1',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        creditsResponse(0, {
          automaticModelId: 'gpt-6-luna',
          availableModels: [
            {
              id: 'gpt-4.1',
              name: 'GPT-4.1',
              description: 'advanced',
              fallback: false,
              supportsReasoning: false,
              allowedReasoningEfforts: [],
              supportsImageAttachments: true,
            },
            {
              id: 'gpt-6-luna',
              name: 'GPT-6 Luna',
              description: 'base fallback',
              fallback: true,
              supportsReasoning: true,
              allowedReasoningEfforts: ['medium'],
              supportsImageAttachments: true,
            },
          ],
        })
      )
    )

    await useSettingsStore.getState().loadCredits('chatbot-fallback')

    expect(useSettingsStore.getState().selectedModel).toBe('gpt-4.1')
    expect(useSettingsStore.getState().modelOptions).toHaveLength(2)
  })

  test('uses the configured primary on first load instead of an incidental Auto selection', async () => {
    useSettingsStore.setState({
      ...useSettingsStore.getInitialState(),
      modelSelectionEnabled: true,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        creditsResponse(20, {
          automaticModelId: 'base-a',
          availableModels: ['auto', 'base-a'].map((id) => ({
            id,
            supportsReasoning: false,
            allowedReasoningEfforts: [],
          })),
        })
      )
    )

    await useSettingsStore.getState().loadCredits('chatbot-initial-selection')

    expect(useSettingsStore.getState().selectedModel).toBe('base-a')
  })

  test.each([
    ['gpt-5.5', 'auto'],
    ['gpt-6-luna', 'gpt-6-luna'],
  ])('reconciles saved selection %s to %s', async (saved, expected) => {
    useSettingsStore.setState({
      modelSelectionEnabled: true,
      selectedModel: saved,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        creditsResponse(20, {
          automaticModelId: 'auto',
          availableModels: ['gpt-6-luna', 'auto'].map((id) => ({
            id,
            supportsReasoning: false,
            allowedReasoningEfforts: [],
          })),
        })
      )
    )

    await useSettingsStore.getState().loadCredits('chatbot-model-selection')

    expect(useSettingsStore.getState().selectedModel).toBe(expected)
  })
})
