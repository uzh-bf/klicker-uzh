import {
  experimental_createMCPClient as createSDKMCPClient,
  type MCPClient,
} from '@ai-sdk/mcp'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { type ToolExecutionOptions, type ToolSet, tool } from 'ai'
import { z } from 'zod'
import docsManifest from '../../../docs/src/generated/docs-manifest.json'
import { KLICKER_DOCS_DOC_QUERY_TOOL_NAME } from '@/src/lib/config/toolNames'
import { parseDocQueryPayload } from '@/src/lib/sources/normalizeSources'
import {
  type KlickerDocsManifest,
  MAX_DOCS_OUTPUT_CHARS,
  MAX_DOCS_QUERY_LENGTH,
  searchKlickerDocs,
} from './docsSearch'

export { KLICKER_DOCS_DOC_QUERY_TOOL_NAME }

const KLICKER_DOCS_CHUNK_TOPICS_TOOL_NAME = `${KLICKER_DOCS_DOC_QUERY_TOOL_NAME}_chunk_topics`
export const KLICKER_DOCS_REMOTE_TIMEOUT_MS = 4000

type KlickerDocsMcpClient = Pick<MCPClient, 'callTool' | 'close' | 'listTools'>

type CreateKlickerDocsMcpClient = (options: {
  signal: AbortSignal
  token: string
  url: string
}) => Promise<KlickerDocsMcpClient>

export type KlickerDocsQueryToolBundle = {
  close: () => Promise<void>
  tools: ToolSet
}

type KlickerDocsQueryToolBundleOptions = {
  createClient?: CreateKlickerDocsMcpClient
  env?: NodeJS.ProcessEnv
  requestSignal?: AbortSignal
  timeoutMs?: number
}

// Build-time import of the generated manifest: the search runs against the
// exact v3 docs snapshot bundled with this chat release, never a live fetch.
const manifest = docsManifest as unknown as KlickerDocsManifest

// Merges the Chat-local docs tools into the request's lecturer-MCP tool set.
// The docs tool name is reserved: a lecturer-side tool with the same name
// would silently shadow or be shadowed, so the request fails loudly instead.
export function mergeManageAssistantToolSets(
  lecturerTools: ToolSet,
  localTools: ToolSet
): ToolSet {
  for (const name of Object.keys(localTools)) {
    if (name in lecturerTools) {
      throw new Error(
        `Lecturer MCP tool '${name}' collides with a reserved Chat-local tool name`
      )
    }
  }
  return { ...lecturerTools, ...localTools }
}

export function getKlickerDocsDocQueryUrl(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  return env.MCP_KLICKER_PUBLIC_DOCS_URL?.trim() || null
}

function combineAbortSignals(
  ...candidates: Array<AbortSignal | null | undefined>
): AbortSignal {
  const signals = candidates.filter(
    (candidate): candidate is AbortSignal => candidate != null
  )
  if (signals.length === 0) return new AbortController().signal
  if (signals.length === 1) return signals[0]
  return AbortSignal.any(signals)
}

async function createKlickerDocsMcpClient({
  signal,
  token,
  url,
}: {
  signal: AbortSignal
  token: string
  url: string
}): Promise<KlickerDocsMcpClient> {
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  })

  try {
    return await createSDKMCPClient({
      initializationOptions: { signal },
      maxRetries: 0,
      transport,
    })
  } catch (error) {
    await transport.close().catch(() => {})
    throw error
  }
}

async function assertExpectedRemoteToolInventory(
  client: KlickerDocsMcpClient,
  signal: AbortSignal
): Promise<void> {
  const names: string[] = []
  const cursors = new Set<string>()
  let cursor: string | undefined

  do {
    const page = await client.listTools({
      params: cursor ? { cursor } : undefined,
      options: { signal },
    })
    names.push(...page.tools.map((definition) => definition.name))

    const nextCursor = page.nextCursor
    if (nextCursor && cursors.has(nextCursor)) {
      throw new Error('Klicker docs MCP returned a repeated tools cursor')
    }
    if (nextCursor) cursors.add(nextCursor)
    cursor = nextCursor
  } while (cursor)

  const uniqueNames = [...new Set(names)].sort()
  const expectedPrimaryOnly = [KLICKER_DOCS_DOC_QUERY_TOOL_NAME]
  const expectedWithCompanion = [
    KLICKER_DOCS_CHUNK_TOPICS_TOOL_NAME,
    KLICKER_DOCS_DOC_QUERY_TOOL_NAME,
  ].sort()
  const matchesExpected =
    uniqueNames.length === names.length &&
    (arraysEqual(uniqueNames, expectedPrimaryOnly) ||
      arraysEqual(uniqueNames, expectedWithCompanion))

  if (!matchesExpected) {
    throw new Error('Klicker docs MCP exposed an unexpected tool inventory')
  }
}

function arraysEqual(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function isCanonicalKlickerDocsUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.hostname === 'www.klicker.uzh.ch' &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}

function isUsableDocumentsResult(result: unknown): boolean {
  if (
    result &&
    typeof result === 'object' &&
    !Array.isArray(result) &&
    (result as { isError?: unknown }).isError === true
  ) {
    return false
  }

  const payload = parseDocQueryPayload(result)
  if (!payload || payload.mode !== 'documents' || 'error' in payload) {
    return false
  }

  const sources = Array.isArray(payload.sources) ? payload.sources : []
  return (
    sources.length > 0 &&
    sources.every((source) => {
      if (!source || typeof source !== 'object') return false
      const record = source as Record<string, unknown>
      if (!isCanonicalKlickerDocsUrl(record.reference)) return false
      if (!Array.isArray(record.chunks) || record.chunks.length === 0) {
        return false
      }
      return record.chunks.some(
        (chunk) =>
          !!chunk &&
          typeof chunk === 'object' &&
          typeof (chunk as Record<string, unknown>).content === 'string' &&
          ((chunk as Record<string, unknown>).content as string).trim().length >
            0
      )
    })
  )
}

function formatKlickerDocsFallbackResult(question: string): string {
  const outcome = searchKlickerDocs(manifest, question)
  const candidates = outcome.results.map((result) => ({
    chunks: [
      {
        content: [
          result.summary,
          result.headings.length > 0
            ? `Sections: ${result.headings.join('; ')}`
            : null,
          result.media.length > 0
            ? `Media: ${result.media.map((item) => item.url).join('; ')}`
            : null,
        ]
          .filter(Boolean)
          .join('\n')
          .slice(0, 500),
        labeled_page_number: null,
        page_number: null,
      },
    ],
    expert_id: 'KlickerUZH public documentation',
    reference: result.url,
    reference_type: 'url',
    source_type: 'webpage',
    title: result.title,
  }))
  const sources: typeof candidates = []

  const buildPayload = (truncated: boolean) => ({
    mode: 'documents',
    retrieval: {
      match: outcome.kind,
      source: 'bundled_release_snapshot',
      truncated,
    },
    summary: {
      chunks_returned: sources.length,
      sources_returned: sources.length,
    },
    sources,
  })

  for (const candidate of candidates) {
    sources.push(candidate)
    const truncated = outcome.truncated || sources.length < candidates.length
    if (
      JSON.stringify(buildPayload(truncated)).length > MAX_DOCS_OUTPUT_CHARS
    ) {
      sources.pop()
      break
    }
  }

  return JSON.stringify(
    buildPayload(outcome.truncated || sources.length < candidates.length)
  )
}

export function createKlickerDocsQueryToolBundle({
  createClient = createKlickerDocsMcpClient,
  env = process.env,
  requestSignal,
  timeoutMs = KLICKER_DOCS_REMOTE_TIMEOUT_MS,
}: KlickerDocsQueryToolBundleOptions = {}): KlickerDocsQueryToolBundle {
  const url = getKlickerDocsDocQueryUrl(env)
  const token = env.DOC_QUERY_JWT_TOKEN_KLICKER_PUBLIC_DOCS?.trim() || null
  let client: KlickerDocsMcpClient | undefined
  let clientPromise: Promise<KlickerDocsMcpClient> | undefined
  let closePromise: Promise<void> | undefined
  let closed = false
  let remoteUnavailable = !url || !token

  const closeRemoteClient = async () => {
    if (closePromise) return closePromise
    closePromise = (async () => {
      const activeClient =
        client ??
        (clientPromise ? await clientPromise.catch(() => undefined) : undefined)
      if (!activeClient) return
      await activeClient.close().catch(() => {
        console.warn('Failed to close Klicker docs MCP client')
      })
    })()
    return closePromise
  }

  const close = async () => {
    closed = true
    await closeRemoteClient()
  }

  const ensureClient = async (
    signal: AbortSignal
  ): Promise<KlickerDocsMcpClient> => {
    if (closed || remoteUnavailable || !url || !token) {
      throw new Error('Klicker docs MCP is unavailable')
    }
    if (!clientPromise) {
      clientPromise = (async () => {
        const connectedClient = await createClient({ signal, token, url })
        client = connectedClient
        await assertExpectedRemoteToolInventory(connectedClient, signal)
        return connectedClient
      })()
    }
    return clientPromise
  }

  const docsTool = tool({
    description:
      'Search the indexed public KlickerUZH documentation for current how-to and feature guidance. Returns canonical source pages and relevant passages. If the website index is unavailable or has no usable result, it falls back to the documentation snapshot bundled with this release.',
    inputSchema: klickerDocsQueryInputSchema,
    execute: async ({ question }, options?: ToolExecutionOptions<unknown>) => {
      const fallback = () => formatKlickerDocsFallbackResult(question)
      if (remoteUnavailable || closed) return fallback()

      const deadlineSignal = AbortSignal.timeout(timeoutMs)
      const signal = combineAbortSignals(
        requestSignal,
        options?.abortSignal,
        deadlineSignal
      )

      try {
        const activeClient = await ensureClient(signal)
        const result = await activeClient.callTool({
          arguments: { question },
          name: KLICKER_DOCS_DOC_QUERY_TOOL_NAME,
          options: { signal },
        })
        if (!isUsableDocumentsResult(result)) {
          throw new Error('Klicker docs MCP returned no usable documents')
        }
        return result
      } catch (error) {
        remoteUnavailable = true
        await closeRemoteClient()
        if (requestSignal?.aborted) throw requestSignal.reason ?? error
        if (options?.abortSignal?.aborted) {
          throw options.abortSignal.reason ?? error
        }
        console.warn(
          'Klicker docs MCP request failed; using bundled documentation snapshot'
        )
        return fallback()
      }
    },
  })

  return {
    close,
    tools: { [KLICKER_DOCS_DOC_QUERY_TOOL_NAME]: docsTool },
  }
}

export const klickerDocsQueryInputSchema = z.object({
  question: z
    .string()
    .min(1)
    .max(MAX_DOCS_QUERY_LENGTH)
    .describe('The KlickerUZH how-to or feature question to answer'),
})
