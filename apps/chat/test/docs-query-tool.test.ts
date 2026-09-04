import { experimental_createMCPClient as createSDKMCPClient } from '@ai-sdk/mcp'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { KLICKER_DOCS_DOC_QUERY_TOOL_NAME } from '@/src/lib/config/toolNames'
import { parseDocQueryPayload } from '@/src/lib/sources/normalizeSources'
import { MAX_DOCS_OUTPUT_CHARS } from '@/src/services/docsSearch'
import {
  createKlickerDocsQueryToolBundle,
  klickerDocsQueryInputSchema,
} from '@/src/services/docsSearchTool'
import {
  fenceToolResultText,
  fenceToolSetResults,
} from '@/src/services/toolOutputFencing'

vi.mock('@ai-sdk/mcp', () => ({
  experimental_createMCPClient: vi.fn(),
}))

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: vi.fn(),
}))

const COMPANION_TOOL_NAME = `${KLICKER_DOCS_DOC_QUERY_TOOL_NAME}_chunk_topics`

function documentsPayload(
  reference = 'https://www.klicker.uzh.ch/tutorials/live_quiz/'
) {
  return {
    mode: 'documents',
    summary: { chunks_returned: 1, sources_returned: 1 },
    sources: [
      {
        chunks: [{ content: 'Create and run a live quiz.' }],
        reference,
        reference_type: 'url',
        source_type: 'webpage',
        title: 'Live Quizzes',
      },
    ],
  }
}

function documentsResult(
  reference = 'https://www.klicker.uzh.ch/tutorials/live_quiz/'
) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(documentsPayload(reference)),
      },
    ],
    isError: false,
  }
}

function configuredEnv(): NodeJS.ProcessEnv {
  return {
    DOC_QUERY_JWT_TOKEN_KLICKER_PUBLIC_DOCS: 'synthetic-token',
    MCP_KLICKER_PUBLIC_DOCS_URL:
      'https://doc-query.example.test/mcp/klicker-public-docs',
    NODE_ENV: 'test',
  }
}

function createClient(overrides: Record<string, unknown> = {}) {
  return {
    callTool: vi.fn().mockResolvedValue(documentsResult()),
    close: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({
      tools: [
        { name: KLICKER_DOCS_DOC_QUERY_TOOL_NAME },
        { name: COMPANION_TOOL_NAME },
      ],
    }),
    ...overrides,
  }
}

async function executeQuestion(
  bundle: ReturnType<typeof createKlickerDocsQueryToolBundle>,
  question = 'How do I create a live quiz?',
  abortSignal?: AbortSignal
) {
  const execute = bundle.tools[KLICKER_DOCS_DOC_QUERY_TOOL_NAME].execute as (
    input: { question: string },
    options?: { abortSignal?: AbortSignal }
  ) => Promise<unknown>
  return execute({ question }, { abortSignal })
}

describe('Klicker public docs composite tool', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.mocked(createSDKMCPClient).mockReset()
    vi.mocked(StreamableHTTPClientTransport).mockReset()
  })

  test('bounds the question', () => {
    expect(
      klickerDocsQueryInputSchema.safeParse({ question: 'live quiz' }).success
    ).toBe(true)
    expect(
      klickerDocsQueryInputSchema.safeParse({ question: 'a'.repeat(201) })
        .success
    ).toBe(false)
  })

  test('uses the dedicated remote tool and closes its client exactly once', async () => {
    const client = createClient()
    const createClientFactory = vi.fn().mockResolvedValue(client)
    const bundle = createKlickerDocsQueryToolBundle({
      createClient: createClientFactory,
      env: configuredEnv(),
    })

    const result = await executeQuestion(bundle)

    expect(result).toBe(JSON.stringify(documentsPayload()))
    expect(client.listTools).toHaveBeenCalledTimes(1)
    expect(client.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        arguments: { question: 'How do I create a live quiz?' },
        name: KLICKER_DOCS_DOC_QUERY_TOOL_NAME,
      })
    )
    expect(client.close).not.toHaveBeenCalled()

    await bundle.close()
    await bundle.close()
    expect(client.close).toHaveBeenCalledTimes(1)
  })

  test('accepts a runtime without the optional companion tool', async () => {
    const client = createClient({
      listTools: vi.fn().mockResolvedValue({
        tools: [{ name: KLICKER_DOCS_DOC_QUERY_TOOL_NAME }],
      }),
    })
    const bundle = createKlickerDocsQueryToolBundle({
      createClient: vi.fn().mockResolvedValue(client),
      env: configuredEnv(),
    })

    await expect(executeQuestion(bundle)).resolves.toBe(
      JSON.stringify(documentsPayload())
    )
    await bundle.close()
  })

  test('fences validated structured content before it reaches the model', async () => {
    const payload = documentsPayload()
    const client = createClient({
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'untrusted alternate text' }],
        structuredContent: payload,
      }),
    })
    const bundle = createKlickerDocsQueryToolBundle({
      createClient: vi.fn().mockResolvedValue(client),
      env: configuredEnv(),
    })
    const sentinel = 'docs-sentinel'
    const fencedTools = fenceToolSetResults(bundle.tools, sentinel)
    const execute = fencedTools[KLICKER_DOCS_DOC_QUERY_TOOL_NAME].execute as (
      input: { question: string },
      options?: { abortSignal?: AbortSignal }
    ) => Promise<unknown>

    const result = await execute({ question: 'How do I create a live quiz?' })

    expect(result).toBe(fenceToolResultText(JSON.stringify(payload), sentinel))
    expect(parseDocQueryPayload(result)).toEqual(payload)
    await bundle.close()
  })

  test('rejects redirects and disables transport reconnection', async () => {
    let capturedOptions: NonNullable<
      ConstructorParameters<typeof StreamableHTTPClientTransport>[1]
    > = {}
    const fetchMock = vi.fn().mockResolvedValue(new Response(null))
    vi.stubGlobal('fetch', fetchMock)
    vi.mocked(StreamableHTTPClientTransport).mockImplementation(
      (_url, options) => {
        capturedOptions = options ?? {}
        return {} as InstanceType<typeof StreamableHTTPClientTransport>
      }
    )
    const client = createClient()
    vi.mocked(createSDKMCPClient).mockResolvedValue(
      client as unknown as Awaited<ReturnType<typeof createSDKMCPClient>>
    )
    const bundle = createKlickerDocsQueryToolBundle({ env: configuredEnv() })

    await expect(executeQuestion(bundle)).resolves.toBe(
      JSON.stringify(documentsPayload())
    )

    expect(capturedOptions).toMatchObject({
      reconnectionOptions: { maxRetries: 0 },
    })
    await capturedOptions.fetch?.('https://docs.test/mcp', {
      redirect: 'follow',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://docs.test/mcp',
      expect.objectContaining({ redirect: 'error' })
    )
    await bundle.close()
  })

  test('falls back and closes when the tenant exposes an unexpected tool', async () => {
    const client = createClient({
      listTools: vi.fn().mockResolvedValue({
        tools: [
          { name: KLICKER_DOCS_DOC_QUERY_TOOL_NAME },
          { name: 'unrelated_expert' },
        ],
      }),
    })
    const bundle = createKlickerDocsQueryToolBundle({
      createClient: vi.fn().mockResolvedValue(client),
      env: configuredEnv(),
    })

    const result = parseDocQueryPayload(await executeQuestion(bundle))

    expect(result?.retrieval).toMatchObject({
      source: 'bundled_release_snapshot',
    })
    expect(client.callTool).not.toHaveBeenCalled()
    expect(client.close).toHaveBeenCalledTimes(1)
  })

  test.each([
    ['call error', () => Promise.reject(new Error('synthetic failure'))],
    ['malformed output', () => Promise.resolve({ content: [] })],
    [
      'empty output',
      () =>
        Promise.resolve({
          content: [
            {
              type: 'text',
              text: JSON.stringify({ mode: 'documents', sources: [] }),
            },
          ],
        }),
    ],
    [
      'non-canonical source',
      () => Promise.resolve(documentsResult('https://example.test')),
    ],
  ])('uses the bundled fallback after %s', async (_label, remoteResult) => {
    const client = createClient({
      callTool: vi.fn().mockImplementation(remoteResult),
    })
    const bundle = createKlickerDocsQueryToolBundle({
      createClient: vi.fn().mockResolvedValue(client),
      env: configuredEnv(),
    })

    const result = parseDocQueryPayload(await executeQuestion(bundle))

    expect(result?.mode).toBe('documents')
    expect(result?.retrieval).toMatchObject({
      source: 'bundled_release_snapshot',
    })
    expect(client.close).toHaveBeenCalledTimes(1)
  })

  test('falls back when initialization exceeds the complete remote deadline', async () => {
    const createClientFactory = vi.fn(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise<ReturnType<typeof createClient>>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          })
        })
    )
    const bundle = createKlickerDocsQueryToolBundle({
      createClient: createClientFactory,
      env: configuredEnv(),
      timeoutMs: 5,
    })

    const result = parseDocQueryPayload(await executeQuestion(bundle))

    expect(result?.retrieval).toMatchObject({
      source: 'bundled_release_snapshot',
    })
  })

  test('does not turn caller cancellation into a fallback result', async () => {
    const controller = new AbortController()
    const client = createClient({
      callTool: vi.fn().mockImplementation(async () => {
        controller.abort(new Error('cancelled'))
        throw new Error('cancelled')
      }),
    })
    const bundle = createKlickerDocsQueryToolBundle({
      createClient: vi.fn().mockResolvedValue(client),
      env: configuredEnv(),
    })

    await expect(
      executeQuestion(bundle, 'How do I create a live quiz?', controller.signal)
    ).rejects.toThrow('cancelled')
    expect(client.close).toHaveBeenCalledTimes(1)
  })

  test('uses the local index immediately when remote configuration is absent', async () => {
    const createClientFactory = vi.fn()
    const bundle = createKlickerDocsQueryToolBundle({
      createClient: createClientFactory,
      env: { NODE_ENV: 'test' },
    })

    const output = await executeQuestion(bundle)
    const result = parseDocQueryPayload(output)

    expect(createClientFactory).not.toHaveBeenCalled()
    expect(output).toEqual(expect.any(String))
    expect((output as string).length).toBeLessThanOrEqual(MAX_DOCS_OUTPUT_CHARS)
    expect(result?.retrieval).toMatchObject({
      source: 'bundled_release_snapshot',
    })
    expect(result?.sources).toEqual(expect.any(Array))
  })
})
