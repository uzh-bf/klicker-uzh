import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  useChatStore,
  type ExtendedThreadMessageLike,
} from '../src/stores/chatStore'

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function successfulResponse() {
  return {
    ok: true,
    json: async () => ({ rating: 'UP' }),
  }
}

function failedResponse() {
  return {
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    text: async () => JSON.stringify({ error: 'boom' }),
  }
}

function assistantMessage(): ExtendedThreadMessageLike {
  return {
    id: 'message-1',
    role: 'assistant',
    content: [{ type: 'text', text: 'Answer' }],
    createdAt: new Date('2026-07-25T00:00:00.000Z'),
    rating: null,
  }
}

function currentRating(messageId = 'message-1') {
  return (
    useChatStore
      .getState()
      .threads[0]?.messages.find((message) => message.id === messageId)
      ?.rating ?? null
  )
}

function resetStore() {
  const message = assistantMessage()
  const secondMessage = { ...assistantMessage(), id: 'message-2' }
  useChatStore.setState({
    threads: [
      {
        id: 'thread-1',
        title: 'Thread',
        createdAt: new Date('2026-07-25T00:00:00.000Z'),
        updatedAt: new Date('2026-07-25T00:00:00.000Z'),
        isRunning: false,
        messages: [message, secondMessage],
        allMessages: [message, secondMessage],
      },
    ],
    activeThreadId: 'thread-1',
    isLoading: false,
    participationRequired: false,
    participationMessage: null,
    threadsLoadError: false,
  })
}

describe('chatStore message ratings', () => {
  beforeEach(() => {
    resetStore()
    vi.restoreAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  test('serializes an UP -> DOWN -> UP burst and ignores a stale failure', async () => {
    const first = deferred<ReturnType<typeof failedResponse>>()
    const second = deferred<ReturnType<typeof successfulResponse>>()
    const third = deferred<ReturnType<typeof successfulResponse>>()
    const fetchSpy = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockReturnValueOnce(third.promise)
    vi.stubGlobal('fetch', fetchSpy)

    const firstRating = useChatStore
      .getState()
      .rateMessage('chatbot-1', 'message-1', 'UP')
    const secondRating = useChatStore
      .getState()
      .rateMessage('chatbot-1', 'message-1', 'DOWN')
    const thirdRating = useChatStore
      .getState()
      .rateMessage('chatbot-1', 'message-1', 'UP')

    expect(currentRating()).toBe('UP')
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))

    first.resolve(failedResponse())
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    expect(currentRating()).toBe('UP')

    second.resolve(successfulResponse())
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3))
    third.resolve(successfulResponse())
    await Promise.all([firstRating, secondRating, thirdRating])

    expect(
      fetchSpy.mock.calls.map((call) => JSON.parse(call[1].body).rating)
    ).toEqual(['UP', 'DOWN', 'UP'])
    expect(currentRating()).toBe('UP')
  })

  test('rolls the latest failed rating back to the last confirmed rating', async () => {
    const first = deferred<ReturnType<typeof successfulResponse>>()
    const second = deferred<ReturnType<typeof failedResponse>>()
    const fetchSpy = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    vi.stubGlobal('fetch', fetchSpy)

    const firstRating = useChatStore
      .getState()
      .rateMessage('chatbot-1', 'message-1', 'UP')
    const secondRating = useChatStore
      .getState()
      .rateMessage('chatbot-1', 'message-1', 'DOWN')

    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    first.resolve(successfulResponse())
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    second.resolve(failedResponse())
    await Promise.all([firstRating, secondRating])

    expect(currentRating()).toBe('UP')
  })

  test('does not block ratings for different messages on one global queue', async () => {
    const first = deferred<ReturnType<typeof successfulResponse>>()
    const second = deferred<ReturnType<typeof successfulResponse>>()
    const fetchSpy = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    vi.stubGlobal('fetch', fetchSpy)

    const firstRating = useChatStore
      .getState()
      .rateMessage('chatbot-1', 'message-1', 'UP')
    const secondRating = useChatStore
      .getState()
      .rateMessage('chatbot-1', 'message-2', 'DOWN')

    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    expect(currentRating('message-1')).toBe('UP')
    expect(currentRating('message-2')).toBe('DOWN')

    first.resolve(successfulResponse())
    second.resolve(successfulResponse())
    await Promise.all([firstRating, secondRating])
  })
})
