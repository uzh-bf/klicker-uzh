import { afterEach, describe, expect, test, vi } from 'vitest'
import { parseDocQueryPayload } from '@/src/lib/sources/normalizeSources'
import {
  createKlickerDocsQueryToolBundle,
  getKlickerDocsDocQueryUrl,
  KLICKER_DOCS_DOC_QUERY_TOOL_NAME,
  klickerDocsQueryInputSchema,
} from '@/src/services/docsSearchTool'
import { MAX_DOCS_OUTPUT_CHARS } from '@/src/services/docsSearch'

const COMPANION_TOOL_NAME = `${KLICKER_DOCS_DOC_QUERY_TOOL_NAME}_chunk_topics`

function documentsResult(
  reference = 'https://www.klicker.uzh.ch/tutorials/live_quiz/'
) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
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
        }),
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
  })

  test('requires an explicit endpoint and bounds the question', () => {
    expect(getKlickerDocsDocQueryUrl({ NODE_ENV: 'production' })).toBeNull()
    expect(
      getKlickerDocsDocQueryUrl({
        MCP_KLICKER_PUBLIC_DOCS_URL: ' https://docs.test/mcp ',
        NODE_ENV: 'test',
      })
    ).toBe('https://docs.test/mcp')
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

    expect(result).toEqual(documentsResult())
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

    await expect(executeQuestion(bundle)).resolves.toEqual(documentsResult())
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
