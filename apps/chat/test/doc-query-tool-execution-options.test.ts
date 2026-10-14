import type { ToolExecutionOptions } from 'ai'
import { describe, expect, expectTypeOf, test, vi } from 'vitest'
import { serializeDocQueryExecution } from '../src/services/docQueryResult'
import { graphAssistedDocumentQuery } from '../src/services/graphAssistedDocQuery'

type ExecutionOptions = ToolExecutionOptions<{ scope: string }>

const documents = (content: string) => ({
  mode: 'documents',
  sources: [
    {
      reference: 'synthetic.pdf',
      chunks: [{ content, page_number: 1 }],
    },
  ],
})

type Execute = (
  input: unknown,
  options?: ExecutionOptions
) => Promise<ReturnType<typeof documents>>

const dependencies = () => ({
  validateScope: vi
    .fn()
    .mockResolvedValue({ enabled: true, buildId: 'synthetic-build' }),
  hints: vi.fn().mockResolvedValue(['Covariance']),
})

function executionOptions(signal: AbortSignal): ExecutionOptions {
  return {
    toolCallId: 'synthetic-tool-call',
    messages: [{ role: 'user', content: 'Synthetic question' }],
    context: { scope: 'synthetic-scope' },
    abortSignal: signal,
  }
}

describe('document tool execution options', () => {
  test('preserves complete SDK options through serialization and graph expansion', async () => {
    const controller = new AbortController()
    const options = executionOptions(controller.signal)
    const execute = vi.fn<Execute>(async () => documents('Synthetic evidence'))
    const wrapped = graphAssistedDocumentQuery(
      serializeDocQueryExecution(execute),
      dependencies()
    )
    expectTypeOf(wrapped)
      .parameter(1)
      .toEqualTypeOf<ExecutionOptions | undefined>()

    await wrapped({ query: 'Synthetic query' }, options)

    expect(execute).toHaveBeenCalledTimes(2)
    expect(execute.mock.calls[0]?.[1]).toBe(options)
    const expandedOptions = execute.mock.calls[1]?.[1]
    expect(expandedOptions).toEqual({
      ...options,
      abortSignal: expect.any(AbortSignal),
    })
    expect(expandedOptions?.messages).toBe(options.messages)
    expect(expandedOptions?.context).toBe(options.context)
    expect(expandedOptions?.abortSignal).not.toBe(controller.signal)
    expect(options.abortSignal).toBe(controller.signal)
  })

  test('forwards cancellation and complete SDK options to an active expansion', async () => {
    const controller = new AbortController()
    const options = executionOptions(controller.signal)
    const pending = Promise.withResolvers<ReturnType<typeof documents>>()
    const execute = vi.fn<Execute>(async () => documents('Synthetic baseline'))
    execute
      .mockResolvedValueOnce(documents('Synthetic baseline'))
      .mockImplementationOnce(() => pending.promise)
    const wrapped = graphAssistedDocumentQuery(
      serializeDocQueryExecution(execute),
      dependencies()
    )
    const result = wrapped({ query: 'Synthetic query' }, options)
    const reason = new Error('Synthetic cancellation')
    const assertion = expect(result).rejects.toBe(reason)

    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(2))
    const expandedOptions = execute.mock.calls[1]?.[1]
    expect(expandedOptions?.toolCallId).toBe(options.toolCallId)
    expect(expandedOptions?.messages).toBe(options.messages)
    expect(expandedOptions?.context).toBe(options.context)
    controller.abort(reason)
    expect(expandedOptions?.abortSignal?.aborted).toBe(true)
    expect(expandedOptions?.abortSignal?.reason).toBe(reason)
    await assertion
    pending.resolve(documents('Late synthetic result'))
  })

  test('preserves omitted MCP execution options without constructing partial ones', async () => {
    const execute = vi.fn<Execute>(async () => documents('Synthetic evidence'))
    await graphAssistedDocumentQuery(
      serializeDocQueryExecution(execute),
      dependencies()
    )({ query: 'Synthetic query' }, undefined)

    expect(execute).toHaveBeenCalledTimes(2)
    expect(execute.mock.calls[0]?.[1]).toBeUndefined()
    expect(execute.mock.calls[1]?.[1]).toBeUndefined()
  })
})
