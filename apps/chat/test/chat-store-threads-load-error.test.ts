import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useChatStore } from '../src/stores/chatStore'

function resetStore() {
  useChatStore.setState({
    threads: [],
    activeThreadId: null,
    isLoading: false,
    participationRequired: false,
    participationMessage: null,
    threadsLoadError: false,
  })
}

describe('chatStore loadThreads error handling', () => {
  beforeEach(() => {
    resetStore()
    vi.restoreAllMocks()
  })

  test('sets threadsLoadError on a non-403 failure and clears it on the next successful attempt', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => JSON.stringify({ error: 'boom' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      })
    vi.stubGlobal('fetch', fetchSpy)

    await useChatStore.getState().loadThreads('chatbot-1')

    expect(useChatStore.getState().threadsLoadError).toBe(true)
    expect(useChatStore.getState().participationRequired).toBe(false)

    // Retry (e.g. the user pressing the retry button) clears the error again
    // at the start of the attempt, and success clears it for good.
    await useChatStore.getState().loadThreads('chatbot-1')

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(useChatStore.getState().threadsLoadError).toBe(false)
  })

  test('a stale failing request cannot overwrite a newer successful load', async () => {
    // First request hangs until we resolve it manually; second request
    // (started later) succeeds immediately. The first then fails AFTER the
    // second finished — its error must not stomp the newer success.
    let rejectFirst: (reason: unknown) => void = () => {}
    const fetchSpy = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectFirst = reject
          })
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      })
    vi.stubGlobal('fetch', fetchSpy)

    const first = useChatStore.getState().loadThreads('chatbot-1')
    const second = useChatStore.getState().loadThreads('chatbot-1')
    await second

    expect(useChatStore.getState().threadsLoadError).toBe(false)
    expect(useChatStore.getState().isLoading).toBe(false)

    rejectFirst(new TypeError('network down'))
    await first

    expect(useChatStore.getState().threadsLoadError).toBe(false)
    expect(useChatStore.getState().isLoading).toBe(false)
  })

  test('does not set threadsLoadError for the 403 participation case', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () =>
        JSON.stringify({
          error: 'No valid participation found for this chatbot',
        }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    await useChatStore.getState().loadThreads('chatbot-1')

    expect(useChatStore.getState().threadsLoadError).toBe(false)
    expect(useChatStore.getState().participationRequired).toBe(true)
  })
})
