import { tool } from 'ai'
import { describe, expect, test, vi } from 'vitest'
import { z } from 'zod'
import { createHostToolDispatcher } from '../src/runtime/mcp.js'

function fixture() {
  const execute = vi.fn(async ({ query }: { query: string }) => ({
    visible: query,
  }))
  const close = vi.fn(async () => undefined)
  return {
    execute,
    close,
    prepared: {
      tools: {
        search: tool({
          inputSchema: z.object({ query: z.string().min(1) }).strict(),
          execute,
          toModelOutput: ({ output }) => ({
            type: 'text' as const,
            value: JSON.stringify({ guidance: output.visible }),
          }),
        }),
      },
      promptToolNames: ['search'],
      promptContext: '',
      close,
    },
  }
}

describe('admitted-turn host tool capabilities', () => {
  test('denies missing, foreign and expired capabilities without execution', async () => {
    let now = 1
    const dispatcher = createHostToolDispatcher(() => now)
    const { prepared, execute, close } = fixture()
    const session = await dispatcher.register({
      tools: prepared,
      signal: new AbortController().signal,
    })
    const body = {
      serverId: 'klicker-host',
      toolName: 'search',
      input: { query: 'synthetic' },
    }
    expect(
      await dispatcher.execute(undefined, body, new AbortController().signal)
    ).toBeNull()
    expect(
      await dispatcher.execute('foreign', body, new AbortController().signal)
    ).toBeNull()
    now += 300_000
    expect(dispatcher.isAuthorized(session.executionToken)).toBe(false)
    expect(
      await dispatcher.execute(
        session.executionToken,
        body,
        new AbortController().signal
      )
    ).toBeNull()
    expect(execute).not.toHaveBeenCalled()
    await session.close()
    expect(close).toHaveBeenCalledTimes(1)
  })

  test('binds names and servers, validates input, and separates model projections from originals', async () => {
    const dispatcher = createHostToolDispatcher()
    const { prepared, execute, close } = fixture()
    const session = await dispatcher.register({
      tools: prepared,
      signal: new AbortController().signal,
    })
    const signal = new AbortController().signal
    for (const body of [
      {
        serverId: 'foreign',
        toolName: 'search',
        input: { query: 'synthetic' },
      },
      {
        serverId: 'klicker-host',
        toolName: 'foreign',
        input: { query: 'synthetic' },
      },
      {
        serverId: 'klicker-host',
        toolName: 'search',
        input: { query: '', participantId: 'foreign' },
      },
    ])
      await expect(
        dispatcher.execute(session.executionToken, body, signal)
      ).rejects.toThrow()
    expect(execute).not.toHaveBeenCalled()
    const output = await dispatcher.execute(
      session.executionToken,
      {
        contractVersion: 'v2',
        serverId: 'klicker-host',
        toolName: 'search',
        input: { query: 'synthetic' },
      },
      signal
    )
    expect(output).toEqual({
      output: { visible: 'synthetic' },
      modelOutput: {
        type: 'text',
        value: JSON.stringify({ guidance: 'synthetic' }),
      },
    })
    expect(execute).toHaveBeenCalledTimes(1)
    await Promise.all([session.close(), session.close()])
    expect(close).toHaveBeenCalledTimes(1)
    expect(
      await dispatcher.execute(session.executionToken, {}, signal)
    ).toBeNull()
  })

  test('propagates request cancellation and revokes the turn before closing clients', async () => {
    const dispatcher = createHostToolDispatcher()
    const request = new AbortController()
    let toolSignal: AbortSignal | undefined
    let started!: () => void
    const ready = new Promise<void>((resolve) => {
      started = resolve
    })
    const close = vi.fn(async () => undefined)
    const session = await dispatcher.register({
      signal: request.signal,
      tools: {
        promptContext: '',
        promptToolNames: ['wait'],
        close,
        tools: {
          wait: tool({
            inputSchema: z.object({}),
            execute: async (_input, options) => {
              toolSignal = options.abortSignal
              started()
              return new Promise((_resolve, reject) =>
                options.abortSignal?.addEventListener(
                  'abort',
                  () => reject(options.abortSignal?.reason),
                  { once: true }
                )
              )
            },
          }),
        },
      },
    })
    const operation = dispatcher.execute(
      session.executionToken,
      { serverId: 'klicker-host', toolName: 'wait', input: {} },
      new AbortController().signal
    )
    await ready
    request.abort()
    await expect(operation).rejects.toThrow()
    await session.close()
    expect(toolSignal?.aborted).toBe(true)
    expect(dispatcher.isAuthorized(session.executionToken)).toBe(false)
    expect(close).toHaveBeenCalledTimes(1)
  })
})
