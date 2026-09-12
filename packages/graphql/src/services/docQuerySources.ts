import { createHash } from 'node:crypto'
import {
  assertDocQueryTransportSecurity,
  createDocQueryMcpClient,
  type DocQueryMcpClient,
  type DocQueryMcpClientOptions,
  isDocQuerySessionNotFound,
  signDocQueryScopeToken,
} from '@klicker-uzh/doc-query-client'
import { safeDecrypt } from '@klicker-uzh/util'

export const KB_SOURCES_TOOL_NAME = 'doc_query_sources'
export const KB_SOURCES_REQUEST_TIMEOUT_MS = 30_000

export interface KbMcpServerEndpoint {
  url: string | null
  authType: string
  authSecret?: string | null
}

export interface KbImportedSourceItem {
  id: string
  title: string
  sourceType: string | null
  sourceUrl: string | null
  ingestedAt: Date | null
  observedAt: Date | null
  chunkCount: number
}

export interface KbImportedSourceInventory {
  items: KbImportedSourceItem[]
  nextCursor: string | null
  totalSourcesInScan: number
  incomplete: boolean
  unidentifiedChunks: number
}

export interface KbSourceInventoryDeps {
  createClient?: (
    options: DocQueryMcpClientOptions
  ) => Promise<DocQueryMcpClient>
  decryptSecret?: (secret: string) => string
  signScopeToken?: typeof signDocQueryScopeToken
}

export class DocQueryInventoryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DocQueryInventoryError'
  }
}

function toNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function parseDateOrNull(value: unknown): Date | null {
  const raw = toNonEmptyString(value)
  if (raw === null) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function toNonNegativeInt(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new DocQueryInventoryError('Malformed Doc Query inventory payload')
  }
  return value
}

function parseToolResultText(result: unknown): unknown {
  if (result === null || typeof result !== 'object') {
    throw new DocQueryInventoryError('Invalid Doc Query tool result')
  }
  const { content } = result as { content?: unknown }
  if (!Array.isArray(content)) {
    throw new DocQueryInventoryError('Invalid Doc Query tool result')
  }
  const textBlock = content.find(
    (block): block is { type: 'text'; text: string } =>
      block !== null &&
      typeof block === 'object' &&
      (block as { type?: unknown }).type === 'text' &&
      typeof (block as { text?: unknown }).text === 'string'
  )
  if (!textBlock) {
    throw new DocQueryInventoryError('Invalid Doc Query tool result')
  }
  try {
    return JSON.parse(textBlock.text)
  } catch {
    throw new DocQueryInventoryError('Malformed Doc Query inventory payload')
  }
}

function parseInventory(payload: unknown): KbImportedSourceInventory {
  if (
    payload === null ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    throw new DocQueryInventoryError('Malformed Doc Query inventory payload')
  }
  const record = payload as Record<string, unknown>
  const error = toNonEmptyString(record.error)
  if (error !== null) {
    throw new DocQueryInventoryError(
      `Doc Query source inventory failed: ${error}`
    )
  }
  if (!Array.isArray(record.sources)) {
    throw new DocQueryInventoryError('Malformed Doc Query inventory payload')
  }
  const items = record.sources.map((raw): KbImportedSourceItem => {
    if (raw === null || typeof raw !== 'object') {
      throw new DocQueryInventoryError('Malformed Doc Query inventory payload')
    }
    const source = raw as Record<string, unknown>
    const identityField = toNonEmptyString(source.identity_field)
    const identityValue = toNonEmptyString(source.identity_value)
    if (identityField === null || identityValue === null) {
      throw new DocQueryInventoryError('Malformed Doc Query inventory payload')
    }
    const chunkCount = toNonNegativeInt(source.chunk_count)
    if (chunkCount < 1) {
      throw new DocQueryInventoryError('Malformed Doc Query inventory payload')
    }
    return {
      id: createHash('sha256')
        .update(`${identityField}\n${identityValue}`)
        .digest('hex'),
      title: toNonEmptyString(source.title) ?? identityValue,
      sourceType: toNonEmptyString(source.source_type),
      sourceUrl: toNonEmptyString(source.source_url),
      ingestedAt: parseDateOrNull(source.ingested_at),
      observedAt: parseDateOrNull(source.observed_at),
      chunkCount,
    }
  })
  return {
    items,
    nextCursor: toNonEmptyString(record.next_cursor),
    totalSourcesInScan: toNonNegativeInt(record.total_sources_in_scan),
    incomplete: record.truncated === true,
    unidentifiedChunks: toNonNegativeInt(record.unidentified_chunks),
  }
}

/**
 * Loads the imported-source inventory from the scoped doc-query companion
 * tool. One MCP client is used per call and always closed; a session-lost
 * HTTP 404 is retried exactly once with a fresh client because the
 * initialize handshake is what re-establishes the session.
 */
export async function fetchKbSourceInventory(
  {
    server,
    kbId,
    limit,
    after,
  }: {
    server: KbMcpServerEndpoint
    kbId: string
    limit: number
    after?: string | null
  },
  {
    createClient = createDocQueryMcpClient,
    decryptSecret = safeDecrypt,
    signScopeToken = signDocQueryScopeToken,
  }: KbSourceInventoryDeps = {}
): Promise<KbImportedSourceInventory> {
  const serverUrl = server.url
  if (!serverUrl) {
    throw new DocQueryInventoryError('KB MCP server has no URL')
  }
  assertDocQueryTransportSecurity(serverUrl)

  const scopeToken = await signScopeToken({ kbIds: [kbId] })
  const authorization =
    server.authType === 'bearer' && server.authSecret
      ? decryptSecret(server.authSecret)
      : undefined

  const callOnce = async (): Promise<KbImportedSourceInventory> => {
    const handle = await createClient({
      url: serverUrl,
      authorization,
      scopeToken,
    })
    try {
      const result = await handle.client.callTool(
        {
          name: KB_SOURCES_TOOL_NAME,
          arguments: after ? { limit, after } : { limit },
        },
        undefined,
        { timeout: KB_SOURCES_REQUEST_TIMEOUT_MS }
      )
      return parseInventory(parseToolResultText(result))
    } finally {
      await handle.close().catch(() => undefined)
    }
  }

  try {
    return await callOnce()
  } catch (error) {
    if (isDocQuerySessionNotFound(error)) {
      return await callOnce()
    }
    throw error
  }
}
