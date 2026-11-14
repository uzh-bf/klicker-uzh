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

describe('chatStore exam conversation', () => {
  beforeEach(() => {
    resetStore()
    vi.restoreAllMocks()
  })

  function jsonResponse(body: unknown, status = 200) {
    return {
      ok: status < 400,
      status,
      statusText: '',
      json: async () => body,
      text: async () => JSON.stringify(body),
    }
  }

  test('switches to the existing thread when a create returns it', async () => {
    const timestamp = '2026-11-12T08:00:00.000Z'
    const fetchSpy = vi.fn(async (url: string) =>
      url.endsWith('/messages')
        ? jsonResponse([])
        : jsonResponse({
            id: 'thread-existing',
            title: 'Exam',
            createdAt: timestamp,
            updatedAt: timestamp,
            created: false,
          })
    )
    vi.stubGlobal('fetch', fetchSpy)

    const threadId = await useChatStore.getState().createThread('chatbot-1')

    const state = useChatStore.getState()
    expect(threadId).toBe('thread-existing')
    expect(state.activeThreadId).toBe('thread-existing')
    expect(state.threads.map((thread) => thread.id)).toEqual([
      'thread-existing',
    ])
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/threads/thread-existing/messages'),
      expect.anything()
    )
  })

  test('a 409 refusal does not raise the participation notice', async () => {
    const timestamp = new Date('2026-11-12T08:00:00.000Z')
    useChatStore.setState({
      threads: [
        {
          id: 'thread-1',
          messages: [],
          allMessages: [],
          isRunning: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      activeThreadId: 'thread-1',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'Not allowed' }, 409))
    )

    const deleted = await useChatStore
      .getState()
      .deleteThread('chatbot-1', 'thread-1')
    await useChatStore
      .getState()
      .updateThreadTitle('chatbot-1', 'thread-1', 'T')

    expect(deleted).toBe(false)
    expect(useChatStore.getState().participationRequired).toBe(false)
    expect(useChatStore.getState().threads).toHaveLength(1)
  })
})
