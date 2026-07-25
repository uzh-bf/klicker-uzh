import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useSettingsStore } from '../src/stores/settingsStore'

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function creditsResponse(current: number) {
  return {
    ok: true,
    json: async () => ({
      current,
      total: 100,
      nextResetAt: null,
      availableModels: [],
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

  test('clears loaded state while refreshing and after a failed refresh', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(creditsResponse(30)))
    await useSettingsStore.getState().loadCredits('chatbot-1')
    expect(useSettingsStore.getState().creditsLoaded).toBe(true)

    const failed = deferred<{
      ok: false
      statusText: string
    }>()
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(failed.promise))
    const refresh = useSettingsStore.getState().loadCredits('chatbot-1')

    expect(useSettingsStore.getState().creditsLoaded).toBe(false)
    failed.resolve({ ok: false, statusText: 'Unavailable' })
    await refresh
    expect(useSettingsStore.getState().creditsLoaded).toBe(false)
  })
})
