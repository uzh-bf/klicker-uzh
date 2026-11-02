import {
  CHAT_ENGINE_CONTRACT_V2,
  CHAT_ENGINE_MAX_V2_DISPATCHER_CACHE_BYTES,
  CHAT_ENGINE_MAX_V2_TOOL_CACHE_BYTES,
  CHAT_ENGINE_MAX_V2_TOOL_PROJECTION_BYTES,
  CHAT_ENGINE_MAX_V2_TOOL_PROJECTION_REQUESTS,
  CHAT_ENGINE_MAX_V2_TOOL_RESULT_BYTES,
  type EngineToolExecutionV2Request,
} from '@klicker-uzh/chat-engine-contract'
import { jsonSchema, tool } from 'ai'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { z } from 'zod'
import { mapAssistantStepContent } from '../src/host/lib/server/persistedAssistantContent.js'
import {
  normalizeSourcesFromParts,
  sourceCitationIndices,
} from '../src/host/lib/sources/normalizeSources.js'
import {
  createHostToolDispatcher,
  type HostToolSession,
} from '../src/runtime/mcp.js'

const sessions: HostToolSession[] = []
const signal = () => new AbortController().signal
const request = (
  toolCallId: string,
  input: EngineToolExecutionV2Request['input'] = { query: 'synthetic' },
  toolName = 'search'
): EngineToolExecutionV2Request => ({
  contractVersion: CHAT_ENGINE_CONTRACT_V2,
  toolCallId,
  serverId: 'klicker-host',
  toolName,
  input,
})
const projection = (...toolCallIds: string[]) => ({
  contractVersion: CHAT_ENGINE_CONTRACT_V2,
  toolCallIds,
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
async function register(
  dispatcher: ReturnType<typeof createHostToolDispatcher>,
  input: Parameters<typeof dispatcher.register>[0]
) {
  const session = await dispatcher.register(input)
  sessions.push(session)
  return session
}
afterEach(async () => {
  await Promise.all(sessions.splice(0).map((session) => session.close()))
})

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
    const session = await register(dispatcher, {
      tools: prepared,
      signal: new AbortController().signal,
    })
    const body = {
      contractVersion: CHAT_ENGINE_CONTRACT_V2,
      toolCallId: 'call-1',
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
    expect(
      await dispatcher.project(undefined, projection('call-1'), signal())
    ).toBeNull()
    expect(
      await dispatcher.project('foreign', projection('call-1'), signal())
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
    expect(
      await dispatcher.project(
        session.executionToken,
        projection('call-1'),
        signal()
      )
    ).toBeNull()
    expect(execute).not.toHaveBeenCalled()
    await session.close()
    expect(close).toHaveBeenCalledTimes(1)
  })

  test('binds names and servers, validates input, and separates model projections from originals', async () => {
    const dispatcher = createHostToolDispatcher()
    const { prepared, execute, close } = fixture()
    const session = await register(dispatcher, {
      tools: prepared,
      signal: new AbortController().signal,
    })
    const signal = new AbortController().signal
    for (const [index, body] of [
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
    ].entries())
      await expect(
        dispatcher.execute(
          session.executionToken,
          { ...request(`invalid-${index}`), ...body },
          signal
        )
      ).rejects.toThrow()
    expect(execute).not.toHaveBeenCalled()
    const output = await dispatcher.execute(
      session.executionToken,
      {
        contractVersion: 'v2',
        toolCallId: 'call-1',
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
    expect(
      await dispatcher.project(
        session.executionToken,
        projection('call-1'),
        signal
      )
    ).toEqual({
      contractVersion: CHAT_ENGINE_CONTRACT_V2,
      outputs: [{ toolCallId: 'call-1', modelOutput: output?.modelOutput }],
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
    const cancellation = new AbortController()
    let toolSignal: AbortSignal | undefined
    let started!: () => void
    const ready = new Promise<void>((resolve) => {
      started = resolve
    })
    const close = vi.fn(async () => undefined)
    const session = await register(dispatcher, {
      signal: cancellation.signal,
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
      request('call-1', {}, 'wait'),
      new AbortController().signal
    )
    await ready
    cancellation.abort()
    await expect(operation).rejects.toThrow()
    await session.close()
    expect(toolSignal?.aborted).toBe(true)
    expect(dispatcher.isAuthorized(session.executionToken)).toBe(false)
    expect(close).toHaveBeenCalledTimes(1)
  })

  test('reserves identity before async validation and shares in-flight and terminal execution', async () => {
    const dispatcher = createHostToolDispatcher()
    const validating = deferred<void>()
    const release = deferred<void>()
    const validate = vi.fn(async () => {
      validating.resolve()
      await release.promise
    })
    const execute = vi.fn(
      async (input: { query: string }, options: { toolCallId: string }) => ({
        query: input.query,
        toolCallId: options.toolCallId,
      })
    )
    const session = await register(dispatcher, {
      signal: signal(),
      tools: {
        ...fixture().prepared,
        tools: {
          search: tool({
            inputSchema: z.object({ query: z.string() }).superRefine(validate),
            execute,
          }),
        },
      },
    })
    const body = request('engine-call')
    const first = dispatcher.execute(session.executionToken, body, signal())
    await validating.promise
    const duplicate = dispatcher.execute(
      session.executionToken,
      structuredClone(body),
      signal()
    )
    for (const changed of [
      { ...body, serverId: 'foreign' },
      { ...body, toolName: 'other' },
      { ...body, input: { query: 'changed' } },
    ]) {
      await expect(
        dispatcher.execute(session.executionToken, changed, signal())
      ).rejects.toThrow()
    }
    expect(validate).toHaveBeenCalledTimes(1)
    expect(execute).not.toHaveBeenCalled()
    release.resolve()
    const [left, right] = await Promise.all([first, duplicate])
    expect(left).toEqual(right)
    expect(left?.output).toEqual({
      query: 'synthetic',
      toolCallId: 'engine-call',
    })
    expect(execute).toHaveBeenCalledTimes(1)
    const mutable = left!.output as { query: string }
    mutable.query = 'caller-mutation'
    expect(
      await dispatcher.execute(session.executionToken, body, signal())
    ).toEqual(right)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  test('reserves all 64 slots while validation is pending', async () => {
    const dispatcher = createHostToolDispatcher()
    const release = deferred<void>()
    const validate = vi.fn(async () => {
      await release.promise
    })
    const execute = vi.fn(async () => null)
    const session = await register(dispatcher, {
      signal: signal(),
      tools: {
        ...fixture().prepared,
        tools: {
          search: tool({
            inputSchema: z.object({ query: z.string() }).superRefine(validate),
            execute,
          }),
        },
      },
    })
    const operations = Array.from({ length: 64 }, (_, index) =>
      dispatcher.execute(
        session.executionToken,
        request(`call-${index}`),
        signal()
      )
    )
    await expect(
      dispatcher.execute(session.executionToken, request('overflow'), signal())
    ).rejects.toThrow()
    expect(validate).toHaveBeenCalledTimes(64)
    expect(execute).not.toHaveBeenCalled()
    release.resolve()
    await Promise.all(operations)
    await dispatcher.execute(
      session.executionToken,
      request('call-0'),
      signal()
    )
    expect(execute).toHaveBeenCalledTimes(64)
  })

  test('caches failures and rejects invalid envelopes without upstream work', async () => {
    const dispatcher = createHostToolDispatcher()
    const { prepared, execute } = fixture()
    const session = await register(dispatcher, {
      tools: prepared,
      signal: signal(),
    })
    for (const body of [
      { ...request('invalid'), contractVersion: 'v1' },
      { ...request('invalid'), toolCallId: '' },
      { ...request('invalid'), toolCallId: undefined },
      { ...request('invalid'), input: undefined },
      { ...request('invalid'), foreign: true },
    ]) {
      await expect(
        dispatcher.execute(session.executionToken, body, signal())
      ).rejects.toThrow()
    }
    expect(execute).not.toHaveBeenCalled()
    execute.mockRejectedValueOnce(new Error('synthetic-upstream-failure'))
    const first = await dispatcher
      .execute(session.executionToken, request('failure'), signal())
      .catch((error: unknown) => error)
    const duplicate = await dispatcher
      .execute(session.executionToken, request('failure'), signal())
      .catch((error: unknown) => error)
    expect(first).toBeInstanceOf(Error)
    expect(duplicate).toBe(first)
    expect(execute).toHaveBeenCalledTimes(1)
    await expect(
      dispatcher.project(
        session.executionToken,
        projection('failure'),
        signal()
      )
    ).rejects.toThrow()
  })

  test('stops a canceled call after validation and never retries that identity', async () => {
    const dispatcher = createHostToolDispatcher()
    const validating = deferred<void>()
    const release = deferred<void>()
    const execute = vi.fn(async () => null)
    const session = await register(dispatcher, {
      signal: signal(),
      tools: {
        ...fixture().prepared,
        tools: {
          search: tool({
            inputSchema: z
              .object({ query: z.string() })
              .superRefine(async () => {
                validating.resolve()
                await release.promise
              }),
            execute,
          }),
        },
      },
    })
    const caller = new AbortController()
    const operation = dispatcher.execute(
      session.executionToken,
      request('canceled'),
      caller.signal
    )
    await validating.promise
    caller.abort()
    release.resolve()
    await expect(operation).rejects.toThrow()
    await expect(
      dispatcher.execute(session.executionToken, request('canceled'), signal())
    ).rejects.toThrow()
    expect(execute).not.toHaveBeenCalled()
    const canceledProjection = new AbortController()
    canceledProjection.abort()
    await expect(
      dispatcher.project(
        session.executionToken,
        projection('canceled'),
        canceledProjection.signal
      )
    ).rejects.toThrow()
  })

  test.each([
    'reverse-completion',
    'reverse-arrival',
  ] as const)('projects interleaved sources in canonical input order after %s', async (order) => {
    const dispatcher = createHostToolDispatcher()
    const started = { first: deferred<void>(), second: deferred<void>() }
    const completed = { first: deferred<void>(), second: deferred<void>() }
    const shared = {
      file_name: 'shared.pdf',
      source_url: 'https://example.test/shared.pdf',
      page_number: 2,
    }
    const payloads = {
      first: {
        sources: [
          {
            file_name: 'same.pdf',
            source_url: 'https://example.test/first.pdf',
            page_number: 1,
          },
          shared,
        ],
      },
      second: {
        sources: [
          {
            file_name: 'same.pdf',
            source_url: 'https://example.test/second.pdf',
            page_number: 1,
          },
          shared,
        ],
      },
    }
    const execute = vi.fn(async ({ query }: { query: 'first' | 'second' }) => {
      started[query].resolve()
      await completed[query].promise
      return payloads[query]
    })
    const session = await register(dispatcher, {
      signal: signal(),
      tools: {
        ...fixture().prepared,
        tools: {
          ...fixture().prepared.tools,
          KB_doc_query: tool({
            inputSchema: z.object({ query: z.enum(['first', 'second']) }),
            execute,
            toModelOutput: ({ output }) => ({
              type: 'text',
              value: JSON.stringify(output),
            }),
          }),
        },
      },
    })
    const canonical = ['first', 'helper', 'second']
    const arrival =
      order === 'reverse-arrival' ? [...canonical].reverse() : canonical
    const operations = new Map(
      arrival.map((id) => [
        id,
        dispatcher.execute(
          session.executionToken,
          request(
            id,
            { query: id === 'helper' ? 'synthetic' : id },
            id === 'helper' ? 'search' : 'KB_doc_query'
          ),
          signal()
        ),
      ])
    )
    await Promise.all(Object.values(started).map((state) => state.promise))
    completed.second.resolve()
    const second = await operations.get('second')!
    completed.first.resolve()
    const first = await operations.get('first')!
    const helper = await operations.get('helper')!
    const rawBefore = JSON.stringify({ first, second, helper })
    const events = [
      { type: 'tool-call', toolCallId: 'first', toolName: 'KB_doc_query' },
      { type: 'text', text: 'synthetic-interleaving' },
      { type: 'tool-call', toolCallId: 'helper', toolName: 'search' },
      { type: 'tool-call', toolCallId: 'second', toolName: 'KB_doc_query' },
      {
        type: 'tool-result',
        toolCallId: 'second',
        toolName: 'KB_doc_query',
        output: second!.output,
      },
      {
        type: 'tool-result',
        toolCallId: 'helper',
        toolName: 'search',
        output: helper!.output,
      },
      {
        type: 'tool-result',
        toolCallId: 'first',
        toolName: 'KB_doc_query',
        output: first!.output,
      },
    ]
    const sources = normalizeSourcesFromParts(
      mapAssistantStepContent([{ content: events }])
    )
    expect(sources.map((source) => source.url)).toEqual([
      'https://example.test/first.pdf',
      'https://example.test/shared.pdf',
      'https://example.test/second.pdf',
    ])
    const result = await dispatcher.project(
      session.executionToken,
      projection(...canonical),
      signal()
    )
    expect(result?.outputs.map((output) => output.toolCallId)).toEqual(
      canonical
    )
    for (const id of ['first', 'second'] as const) {
      const output = result!.outputs.find(
        (part) => part.toolCallId === id
      )!.modelOutput
      if (output.type !== 'text') throw new Error('Expected text projection')
      const payload = JSON.parse(output.value) as {
        sources: Array<{ citation_index: number }>
      }
      expect(payload.sources.map((source) => source.citation_index)).toEqual(
        sourceCitationIndices(payloads[id], sources)
      )
    }
    expect(result!.outputs[1]!.modelOutput).toEqual(helper!.modelOutput)
    expect(JSON.stringify({ first, second, helper })).toBe(rawBefore)
    expect(
      await dispatcher.execute(
        session.executionToken,
        request('first', { query: 'first' }, 'KB_doc_query'),
        signal()
      )
    ).toEqual(first)
    expect(execute).toHaveBeenCalledTimes(2)
  })

  test('numbers only delivered results and preserves the accepted cumulative prefix', async () => {
    const dispatcher = createHostToolDispatcher()
    const { prepared } = fixture()
    const session = await register(dispatcher, {
      signal: signal(),
      tools: {
        ...prepared,
        tools: {
          KB_doc_query: tool({
            inputSchema: z.object({ query: z.string() }),
            execute: async ({ query }) => ({
              sources: [
                {
                  file_name: `${query}.pdf`,
                  source_url: `https://example.test/${query}.pdf`,
                },
              ],
            }),
          }),
        },
      },
    })
    for (const id of ['lost-response', 'delivered-1', 'delivered-2']) {
      await dispatcher.execute(
        session.executionToken,
        request(id, { query: id }, 'KB_doc_query'),
        signal()
      )
    }
    const first = await dispatcher.project(
      session.executionToken,
      projection('delivered-1'),
      signal()
    )
    const repeat = await dispatcher.project(
      session.executionToken,
      projection('delivered-1'),
      signal()
    )
    expect(repeat).toEqual(first)
    const extended = await dispatcher.project(
      session.executionToken,
      projection('delivered-1', 'delivered-2'),
      signal()
    )
    expect(extended?.outputs[0]).toEqual(first?.outputs[0])
    expect(
      extended?.outputs.map(({ modelOutput }) => {
        if (modelOutput.type !== 'text')
          throw new Error('Expected text projection')
        return (
          JSON.parse(modelOutput.value) as {
            sources: Array<{ citation_index: number }>
          }
        ).sources[0]?.citation_index
      })
    ).toEqual([1, 2])
    await expect(
      dispatcher.project(
        session.executionToken,
        projection('delivered-2', 'delivered-1'),
        signal()
      )
    ).rejects.toThrow()
    await expect(
      dispatcher.project(
        session.executionToken,
        projection('delivered-1'),
        signal()
      )
    ).rejects.toThrow()
  })

  test.each([
    'duplicate',
    'foreign',
    'unfinished',
    'empty',
    'overflow',
    'extra-field',
  ] as const)('rejects %s projection identities without upstream work or accepting a prefix', async (invalid) => {
    const dispatcher = createHostToolDispatcher()
    const { prepared, execute } = fixture()
    const pending = deferred<void>()
    const started = deferred<void>()
    execute.mockImplementationOnce(async ({ query }) => {
      started.resolve()
      await pending.promise
      return { visible: query }
    })
    const session = await register(dispatcher, {
      tools: prepared,
      signal: signal(),
    })
    const operation = dispatcher.execute(
      session.executionToken,
      request('pending'),
      signal()
    )
    await started.promise
    const raw =
      invalid === 'duplicate'
        ? projection('pending', 'pending')
        : invalid === 'foreign'
          ? projection('other-run')
          : invalid === 'unfinished'
            ? projection('pending')
            : invalid === 'empty'
              ? projection()
              : invalid === 'overflow'
                ? projection(
                    ...Array.from({ length: 65 }, (_, index) => `call-${index}`)
                  )
                : { ...projection('pending'), output: {} }
    await expect(
      dispatcher.project(session.executionToken, raw, signal())
    ).rejects.toThrow()
    pending.resolve()
    await operation
    expect(
      (
        await dispatcher.project(
          session.executionToken,
          projection('pending'),
          signal()
        )
      )?.outputs
    ).toHaveLength(1)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  test('limits projection requests to five including identical repeats', async () => {
    const dispatcher = createHostToolDispatcher()
    const { prepared, execute } = fixture()
    const session = await register(dispatcher, {
      tools: prepared,
      signal: signal(),
    })
    await dispatcher.execute(session.executionToken, request('call'), signal())
    for (
      let count = 0;
      count < CHAT_ENGINE_MAX_V2_TOOL_PROJECTION_REQUESTS;
      count++
    ) {
      expect(
        (
          await dispatcher.project(
            session.executionToken,
            projection('call'),
            signal()
          )
        )?.outputs
      ).toHaveLength(1)
    }
    await expect(
      dispatcher.project(session.executionToken, projection('call'), signal())
    ).rejects.toThrow()
    expect(execute).toHaveBeenCalledTimes(1)
  })

  test('isolates completed identities between capabilities', async () => {
    const dispatcher = createHostToolDispatcher()
    const first = fixture()
    const second = fixture()
    const firstSession = await register(dispatcher, {
      tools: first.prepared,
      signal: signal(),
    })
    const secondSession = await register(dispatcher, {
      tools: second.prepared,
      signal: signal(),
    })
    await dispatcher.execute(
      firstSession.executionToken,
      request('same-id', { query: 'first' }),
      signal()
    )
    await expect(
      dispatcher.project(
        secondSession.executionToken,
        projection('same-id'),
        signal()
      )
    ).rejects.toThrow()
    expect(second.execute).not.toHaveBeenCalled()
    expect(
      (
        await dispatcher.execute(
          secondSession.executionToken,
          request('same-id', { query: 'second' }),
          signal()
        )
      )?.output
    ).toEqual({ visible: 'second' })
    expect(
      (
        await dispatcher.project(
          firstSession.executionToken,
          projection('same-id'),
          signal()
        )
      )?.outputs[0]?.modelOutput
    ).toEqual({ type: 'text', value: JSON.stringify({ guidance: 'first' }) })
    expect(first.execute).toHaveBeenCalledTimes(1)
    expect(second.execute).toHaveBeenCalledTimes(1)
  })

  test('requires a baseline projection and keeps mapper mutations out of the raw cache', async () => {
    const dispatcher = createHostToolDispatcher()
    const execute = vi.fn(async () => ({ raw: 'original' }))
    const session = await register(dispatcher, {
      signal: signal(),
      tools: {
        ...fixture().prepared,
        tools: {
          search: tool({
            inputSchema: z.object({ query: z.string() }),
            execute,
            toModelOutput: ({ input, output }) => {
              output.raw = 'model-only'
              return input.query === 'missing'
                ? (undefined as never)
                : { type: 'json', value: output }
            },
          }),
        },
      },
    })
    expect(
      await dispatcher.execute(
        session.executionToken,
        request('valid'),
        signal()
      )
    ).toEqual({
      output: { raw: 'original' },
      modelOutput: { type: 'json', value: { raw: 'model-only' } },
    })
    await expect(
      dispatcher.execute(
        session.executionToken,
        request('missing', { query: 'missing' }),
        signal()
      )
    ).rejects.toThrow()
    await expect(
      dispatcher.execute(
        session.executionToken,
        request('missing', { query: 'missing' }),
        signal()
      )
    ).rejects.toThrow()
    await expect(
      dispatcher.project(
        session.executionToken,
        projection('missing'),
        signal()
      )
    ).rejects.toThrow()
    expect(execute).toHaveBeenCalledTimes(2)
  })

  test('checks UTF-8 result bytes exactly and caches an overflow failure', async () => {
    const dispatcher = createHostToolDispatcher()
    const overhead = Buffer.byteLength(
      JSON.stringify({ output: '', modelOutput: { type: 'json', value: '' } })
    )
    const valueBytes = Math.floor(
      (CHAT_ENGINE_MAX_V2_TOOL_RESULT_BYTES - overhead) / 2
    )
    const value =
      'é'.repeat(Math.floor(valueBytes / 2)) + 'x'.repeat(valueBytes % 2)
    const execute = vi.fn(async ({ overflow }: { overflow: boolean }) =>
      overflow ? value + 'é' : value
    )
    const session = await register(dispatcher, {
      signal: signal(),
      tools: {
        ...fixture().prepared,
        tools: {
          search: tool({
            inputSchema: z.object({ overflow: z.boolean() }),
            execute,
          }),
        },
      },
    })
    const result = await dispatcher.execute(
      session.executionToken,
      request('within', { overflow: false }),
      signal()
    )
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(
      CHAT_ENGINE_MAX_V2_TOOL_RESULT_BYTES
    )
    expect(Buffer.byteLength(JSON.stringify(result))).toBeGreaterThan(
      CHAT_ENGINE_MAX_V2_TOOL_RESULT_BYTES - 2
    )
    await expect(
      dispatcher.execute(
        session.executionToken,
        request('overflow', { overflow: true }),
        signal()
      )
    ).rejects.toThrow()
    await expect(
      dispatcher.execute(
        session.executionToken,
        request('overflow', { overflow: true }),
        signal()
      )
    ).rejects.toThrow()
    expect(execute).toHaveBeenCalledTimes(2)
  })

  test('bounds per-run and dispatcher caches and releases bytes when sessions close', async () => {
    const dispatcher = createHostToolDispatcher()
    const value = 'x'.repeat(3 * 1024 * 1024)
    const resultBytes = Buffer.byteLength(
      JSON.stringify({ output: value, modelOutput: { type: 'json', value } })
    )
    const perRun = Math.floor(CHAT_ENGINE_MAX_V2_TOOL_CACHE_BYTES / resultBytes)
    const total = Math.floor(
      CHAT_ENGINE_MAX_V2_DISPATCHER_CACHE_BYTES / resultBytes
    )
    const execute = vi.fn(async () => value)
    const prepared = {
      ...fixture().prepared,
      tools: {
        search: tool({ inputSchema: z.object({ query: z.string() }), execute }),
      },
    }
    const first = await register(dispatcher, {
      tools: prepared,
      signal: signal(),
    })
    for (let index = 0; index < perRun; index++) {
      await dispatcher.execute(
        first.executionToken,
        request(`first-${index}`),
        signal()
      )
    }
    await expect(
      dispatcher.execute(
        first.executionToken,
        request('run-overflow'),
        signal()
      )
    ).rejects.toThrow()
    await expect(
      dispatcher.execute(
        first.executionToken,
        request('run-overflow'),
        signal()
      )
    ).rejects.toThrow()
    let filled = perRun
    while (filled < total) {
      const session = await register(dispatcher, {
        tools: prepared,
        signal: signal(),
      })
      for (let index = 0; index < perRun && filled < total; index++, filled++) {
        await dispatcher.execute(
          session.executionToken,
          request(`global-${index}`),
          signal()
        )
      }
    }
    const blocked = await register(dispatcher, {
      tools: prepared,
      signal: signal(),
    })
    await expect(
      dispatcher.execute(
        blocked.executionToken,
        request('global-overflow'),
        signal()
      )
    ).rejects.toThrow()
    await expect(
      dispatcher.execute(
        blocked.executionToken,
        request('global-overflow'),
        signal()
      )
    ).rejects.toThrow()
    expect(execute).toHaveBeenCalledTimes(total + 2)
    await first.close()
    await dispatcher.execute(
      blocked.executionToken,
      request('after-release'),
      signal()
    )
    expect(execute).toHaveBeenCalledTimes(total + 3)
  })

  test('bounds projection expansion without accepting a failed prefix', async () => {
    const dispatcher = createHostToolDispatcher()
    const overhead = Buffer.byteLength(
      JSON.stringify({ output: null, modelOutput: { type: 'json', value: '' } })
    )
    const value = 'x'.repeat(CHAT_ENGINE_MAX_V2_TOOL_RESULT_BYTES - overhead)
    const execute = vi.fn(async () => null)
    const session = await register(dispatcher, {
      signal: signal(),
      tools: {
        ...fixture().prepared,
        tools: {
          search: tool({
            inputSchema: z.object({ query: z.string() }),
            execute,
            toModelOutput: () => ({ type: 'json', value }),
          }),
        },
      },
    })
    const first = 'a'.repeat(128)
    const second = 'b'.repeat(128)
    for (const id of [first, second]) {
      await dispatcher.execute(session.executionToken, request(id), signal())
    }
    const projectionBytes = Buffer.byteLength(
      JSON.stringify({
        contractVersion: CHAT_ENGINE_CONTRACT_V2,
        outputs: [first, second].map((toolCallId) => ({
          toolCallId,
          modelOutput: { type: 'json', value },
        })),
      })
    )
    expect(projectionBytes).toBeGreaterThan(
      CHAT_ENGINE_MAX_V2_TOOL_PROJECTION_BYTES
    )
    await expect(
      dispatcher.project(
        session.executionToken,
        projection(first, second),
        signal()
      )
    ).rejects.toThrow()
    expect(
      (
        await dispatcher.project(
          session.executionToken,
          projection(second),
          signal()
        )
      )?.outputs.map((part) => part.toolCallId)
    ).toEqual([second])
    expect(execute).toHaveBeenCalledTimes(2)
  })

  test('forwards only admitted Python fields through the fixed callback and deduplicates it', async () => {
    const dispatcher = createHostToolDispatcher()
    const executePython = vi.fn(async () => ({ stdout: 'synthetic' }))
    const session = await register(dispatcher, {
      signal: signal(),
      tools: { ...fixture().prepared, tools: {} },
      python: {
        executionToken: 'synthetic-python-capability',
        tools: [
          {
            name: 'run_python',
            serverId: 'catalyst-codeapi',
            inputSchema: { type: 'object' },
          },
        ],
      },
      executePython,
    })
    const body = {
      ...request('python', { code: 'synthetic-only' }, 'run_python'),
      serverId: 'catalyst-codeapi',
    }
    const result = await dispatcher.execute(
      session.executionToken,
      body,
      signal()
    )
    expect(
      await dispatcher.execute(session.executionToken, body, signal())
    ).toEqual(result)
    expect(executePython).toHaveBeenCalledTimes(1)
    expect(executePython).toHaveBeenCalledWith(
      {
        serverId: 'catalyst-codeapi',
        toolName: 'run_python',
        input: { code: 'synthetic-only' },
      },
      'synthetic-python-capability',
      expect.any(AbortSignal)
    )
    await expect(
      dispatcher.execute(
        session.executionToken,
        { ...body, toolCallId: 'foreign', serverId: 'foreign' },
        signal()
      )
    ).rejects.toThrow()
    expect(executePython).toHaveBeenCalledTimes(1)
  })
})

test('holds the active session cap across concurrent asynchronous registration', async () => {
  const dispatcher = createHostToolDispatcher()
  const results = await Promise.allSettled(
    Array.from({ length: 129 }, () =>
      dispatcher.register({
        tools: {
          tools: {},
          promptToolNames: [],
          promptContext: '',
          close: async () => undefined,
        },
        signal: signal(),
      })
    )
  )
  const admitted = results.filter((result) => result.status === 'fulfilled')
  for (const result of admitted)
    if (result.status === 'fulfilled') sessions.push(result.value)
  expect(admitted).toHaveLength(128)
  expect(results.filter((result) => result.status === 'rejected')).toHaveLength(
    1
  )
})

test.each([
  'http://json-schema.org/draft-07/schema#',
  'https://json-schema.org/draft/2019-09/schema',
  'https://json-schema.org/draft/2020-12/schema',
])('validates MCP JSON Schema inputs without coercion or mutation: %s', async ($schema) => {
  const dispatcher = createHostToolDispatcher()
  const execute = vi.fn(async (input: unknown) => input)
  const schema = {
    $schema,
    type: 'object' as const,
    properties: {
      count: { type: 'integer' as const, minimum: 1 },
      scope: { type: 'string' as const, format: 'uuid' },
      nested: {
        type: 'object' as const,
        properties: { kind: { const: 'allowed' } },
        required: ['kind'],
        additionalProperties: false,
      },
      optional: { type: 'string' as const, default: 'not-injected' },
    },
    required: ['count', 'scope', 'nested'],
    additionalProperties: false,
  }
  const session = await dispatcher.register({
    tools: {
      tools: {
        course_query: tool({ inputSchema: jsonSchema(schema), execute }),
      },
      promptToolNames: ['course_query'],
      promptContext: '',
      close: async () => undefined,
    },
    signal: signal(),
  })
  sessions.push(session)
  const valid = {
    count: 1,
    scope: '11111111-1111-4111-8111-111111111111',
    nested: { kind: 'allowed' },
  }
  const invalid = [
    { ...valid, count: '1' },
    { ...valid, count: 0 },
    { ...valid, scope: 'not-a-uuid' },
    { ...valid, nested: { kind: 'foreign' } },
    { ...valid, foreign: true },
  ]
  for (const [index, input] of invalid.entries()) {
    await expect(
      dispatcher.execute(
        session.executionToken,
        {
          contractVersion: 'v2',
          toolCallId: `invalid-${index}`,
          serverId: 'klicker-host',
          toolName: 'course_query',
          input,
        },
        signal()
      )
    ).rejects.toThrow()
  }
  expect(execute).not.toHaveBeenCalled()
  await dispatcher.execute(
    session.executionToken,
    {
      contractVersion: 'v2',
      toolCallId: 'valid-call',
      serverId: 'klicker-host',
      toolName: 'course_query',
      input: valid,
    },
    signal()
  )
  expect(execute).toHaveBeenCalledOnce()
  expect(execute.mock.calls[0]?.[0]).toEqual(valid)
  expect(execute.mock.calls[0]?.[0]).not.toHaveProperty('optional')
  expect(valid.count).toBe(1)
})

test('rejects unresolved external schema references without fetching them', async () => {
  const dispatcher = createHostToolDispatcher()
  const execute = vi.fn(async () => null)
  const request = vi.spyOn(globalThis, 'fetch')
  try {
    await expect(
      dispatcher.register({
        tools: {
          tools: {
            course_query: tool({
              inputSchema: jsonSchema({
                $ref: 'https://schema.invalid/foreign',
              }),
              execute,
            }),
          },
          promptToolNames: [],
          promptContext: '',
          close: async () => undefined,
        },
        signal: signal(),
      })
    ).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  } finally {
    request.mockRestore()
  }
})
