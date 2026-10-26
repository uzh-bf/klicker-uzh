import { normalizeSourcesFromParts } from './normalizeSources'
import { getPublicSourceUrl, getSourceNavigationUrl } from './sourceUrl'

export { getPublicSourceUrl } from './sourceUrl'

export interface DocQueryChunk {
  id: string
  content?: string
  page?: number
  labeledPage?: string
  startSec?: number
  endSec?: number
  url?: string
}

export interface DocQueryGroup {
  id: string
  citationId?: string
  title?: string
  url?: string
  chunks: DocQueryChunk[]
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const clean = value.trim()
  return clean && clean.toUpperCase() !== 'N/A' ? clean : undefined
}

function number(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  if (typeof value === 'string' && !value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

function chunkLink(
  url: string | undefined,
  source: Record<string, unknown>,
  startSec: number | undefined
): string | undefined {
  if (
    !url ||
    startSec === undefined ||
    !/video|youtube/i.test(String(source.source_type))
  )
    return url
  const parsed = new URL(url)
  // Known provider semantics only. Keep existing authoritative fragments untouched.
  if (parsed.hash) return url
  if (
    ['youtube.com', 'www.youtube.com', 'youtu.be'].includes(parsed.hostname)
  ) {
    parsed.searchParams.set('t', `${Math.floor(startSec)}s`)
    return parsed.toString()
  }
  return url
}

/** Decode only known MCP wrappers, retaining failure precedence at every layer. */
function decode(raw: unknown, depth = 0): Record<string, unknown> | undefined {
  if (depth > 8) return undefined
  if (typeof raw === 'string') {
    try {
      return decode(JSON.parse(raw), depth + 1)
    } catch {
      return undefined
    }
  }
  const value = record(raw)
  if (!value) return undefined
  if (value.isError === true || 'error' in value) return { error: true }
  if (Array.isArray(value.sources)) return value
  if (value.structuredContent !== undefined) {
    const nested = decode(value.structuredContent, depth + 1)
    if (nested) return nested
  }
  if (Array.isArray(value.content)) {
    for (const item of value.content) {
      const entry = record(item)
      if (entry?.type !== 'text') continue
      const nested = decode(entry.text, depth + 1)
      if (nested) return nested
    }
  }
  if (value.result !== undefined) return decode(value.result, depth + 1)
  return undefined
}

export function getDocQueryResult(raw: unknown): {
  state: 'success' | 'empty' | 'unknown' | 'failed'
  groups: DocQueryGroup[]
} {
  const payload = decode(raw)
  if (!payload) return { state: 'unknown', groups: [] }
  if ('error' in payload) return { state: 'failed', groups: [] }
  const sources = payload.sources as unknown[]
  if (sources.length === 0) return { state: 'empty', groups: [] }
  const groups: DocQueryGroup[] = []
  sources.forEach((rawSource, sourceIndex) => {
    const source = record(rawSource)
    if (!source) return
    // Legacy normalization alone owns citation eligibility and identity.
    const citation = normalizeSourcesFromParts([
      {
        type: 'tool-call',
        toolName: 'doc_query',
        result: { ...payload, sources: [source] },
      },
    ])[0]
    const url =
      getPublicSourceUrl(source.source_url) ??
      getPublicSourceUrl(source.reference)
    const title =
      text(source.display_name) ??
      text(source.title) ??
      text(source.file_name) ??
      citation?.title
    const rawChunks =
      payload.mode === 'documents'
        ? Array.isArray(source.chunks)
          ? source.chunks
          : []
        : [source]
    const chunks: DocQueryChunk[] = []
    rawChunks.forEach((rawChunk, chunkIndex) => {
      const chunk = record(rawChunk)
      if (!chunk) return
      const page = number(chunk.page_number)
      const startSec = number(chunk.start_sec)
      const end = number(chunk.end_sec)
      chunks.push({
        id: `${sourceIndex}:${chunkIndex}`,
        content: text(chunk.content),
        page: page !== undefined && Number.isInteger(page) ? page : undefined,
        labeledPage: text(chunk.labeled_page_number),
        startSec,
        endSec:
          end !== undefined && (startSec === undefined || end >= startSec)
            ? end
            : undefined,
        url: getSourceNavigationUrl(chunkLink(url, source, startSec), page),
      })
    })
    if (!title && !url && !chunks.some((chunk) => chunk.content)) return
    groups.push({
      id: String(sourceIndex),
      citationId: citation?.id,
      title,
      url,
      chunks,
    })
  })
  return { state: groups.length > 0 ? 'success' : 'unknown', groups }
}
