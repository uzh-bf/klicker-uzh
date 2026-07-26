import type { ChatSource, ChatSourceType } from './types'

const MAX_SOURCES = 12
const EXCERPT_MAX_LENGTH = 240

// MCP tools are namespaced by server, e.g. `KB_doc_query` (see
// `toSafeToolName` in `services/mcpClients.ts`). Match the namespaced form or
// the bare tool name.
//
// The optional trailing group covers the disambiguation suffix `toSafeToolName`
// appends — 8 hex characters of a sha256 — when two servers expose the same
// tool name or the namespaced name exceeds its length cap. Without it, a
// chatbot with two RAG servers would silently lose sources, citations and the
// friendly chip for whichever server got the suffix.
const DOC_QUERY_TOOL_NAME_RE = /(^|_)doc_query(_[0-9a-f]{8})?$/

/**
 * Minimal structural shape shared by live (streamed) and persisted assistant
 * message content parts, so this module needs no import from assistant-ui or
 * the persisted-content types.
 */
export interface ChatSourcePart {
  type: string
  toolName?: string
  result?: unknown
  isError?: boolean
}

interface SourceCandidate {
  type: ChatSourceType
  title: string
  page?: number
  labeledPage?: string
  url?: string
  excerpt?: string
  dedupeKey: string
}

export function isDocQueryToolName(toolName: string): boolean {
  return DOC_QUERY_TOOL_NAME_RE.test(toolName)
}

/**
 * Resolves a `[n]` citation marker against the message's normalized sources.
 * Valid only when `1 <= n <= sources.length` — sources are always 1-based
 * and contiguous in first-appearance order (see `normalizeSourcesFromParts`),
 * so a simple bounds check is enough; no separate lookup by `.index` is
 * needed.
 *
 * Returns `undefined` for an out-of-range marker or when the message has no
 * sources at all, in which case the caller (`CitationChip`) renders the
 * original `[n]` text instead of a citation chip.
 */
export function resolveCitationSource(
  index: number,
  sources: readonly ChatSource[]
): ChatSource | undefined {
  if (!Number.isInteger(index) || index < 1 || index > sources.length) {
    return undefined
  }
  return sources[index - 1]
}

export function normalizeSourcesFromParts(
  parts: readonly ChatSourcePart[]
): ChatSource[] {
  if (!Array.isArray(parts)) return []

  const seenDedupeKeys = new Set<string>()
  const sources: ChatSource[] = []

  for (const part of parts) {
    if (sources.length >= MAX_SOURCES) break
    if (!isQualifyingPart(part)) continue

    const payload = parseDocQueryPayload(part.result)
    if (!payload || 'error' in payload) continue

    const candidates =
      payload.mode === 'documents'
        ? normalizeDocumentsModeSources(payload)
        : normalizeAnswerModeSources(payload)

    for (const candidate of candidates) {
      if (sources.length >= MAX_SOURCES) break
      if (seenDedupeKeys.has(candidate.dedupeKey)) continue

      seenDedupeKeys.add(candidate.dedupeKey)
      sources.push({
        id: candidate.dedupeKey,
        index: sources.length + 1,
        type: candidate.type,
        title: candidate.title,
        page: candidate.page,
        labeledPage: candidate.labeledPage,
        url: candidate.url,
        excerpt: candidate.excerpt,
      })
    }
  }

  return sources
}

function isQualifyingPart(
  part: ChatSourcePart
): part is ChatSourcePart & { toolName: string; result: unknown } {
  return (
    part.type === 'tool-call' &&
    typeof part.toolName === 'string' &&
    isDocQueryToolName(part.toolName) &&
    !part.isError &&
    part.result !== undefined &&
    part.result !== null
  )
}

/**
 * Tolerates the raw MCP CallToolResult envelope (what @ai-sdk/mcp returns
 * when no outputSchema is configured), an already-parsed doc_query payload,
 * and its JSON-string form; never throws on garbage/truncated JSON.
 *
 * Exported because "no payload at all" and "a payload that reports zero
 * sources" mean different things to a caller: the live tool-call parts carry
 * `'Loading...'`/`'Executing...'` placeholder strings while a call is in
 * flight (see `hooks/useChatResponse.ts`), and those must not be mistaken for
 * a search that genuinely came back empty.
 */
export function parseDocQueryPayload(
  raw: unknown
): Record<string, unknown> | undefined {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const envelope = raw as Record<string, unknown>

    if (Array.isArray(envelope.content)) {
      if (
        envelope.structuredContent &&
        typeof envelope.structuredContent === 'object' &&
        !Array.isArray(envelope.structuredContent)
      ) {
        return envelope.structuredContent as Record<string, unknown>
      }

      const textItem = envelope.content.find(
        (item): item is Record<string, unknown> =>
          !!item &&
          typeof item === 'object' &&
          (item as Record<string, unknown>).type === 'text'
      )
      return textItem ? parseJsonObject(textItem.text) : undefined
    }

    return envelope
  }

  return parseJsonObject(raw)
}

function parseJsonObject(raw: unknown): Record<string, unknown> | undefined {
  if (typeof raw !== 'string') return undefined
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

// doc_query answer mode may report any field as the literal string "N/A"
// instead of omitting it.
function isNAValue(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toUpperCase() === 'N/A'
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string' || isNAValue(value)) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

// page_number may arrive as a number or a numeric string.
function cleanPage(value: unknown): number | undefined {
  if (isNAValue(value)) return undefined
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function lastPathSegment(value: string): string | undefined {
  const withoutQuery = value.split(/[?#]/)[0]
  const segments = withoutQuery.split('/').filter(Boolean)
  const last = segments[segments.length - 1]
  if (!last) return undefined
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}

function isUrlLike(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function hasFileExtension(value: string): boolean {
  return /\.[a-z0-9]{1,8}$/i.test(value)
}

function truncateExcerpt(value: string | undefined): string | undefined {
  if (!value) return undefined
  if (value.length <= EXCERPT_MAX_LENGTH) return value
  return `${value.slice(0, EXCERPT_MAX_LENGTH).trimEnd()}…`
}

// Case-insensitive, tolerant of whatever a source/reference type label the
// doc_query pipeline sends; a URL with no file name reads as a plain link
// rather than a document.
function inferSourceType(
  typeHint: string | undefined,
  url: string | undefined
): ChatSourceType {
  const lower = (typeHint ?? '').toLowerCase()
  if (lower.includes('video') || lower.includes('youtube')) return 'video'
  if (
    lower.includes('image') ||
    lower.includes('figure') ||
    lower.includes('img')
  )
    return 'image'
  if (url) {
    const fileName = lastPathSegment(url)
    if (!fileName || !hasFileExtension(fileName)) return 'link'
  }
  return 'document'
}

function buildDedupeKey(params: {
  url?: string
  title: string
  page?: number
  labeledPage?: string
}): string {
  const { url, title, page, labeledPage } = params
  return url
    ? `url:${url}|${page ?? ''}|${labeledPage ?? ''}`
    : `title:${title}|${page ?? ''}|${labeledPage ?? ''}`
}

function normalizeAnswerModeSources(
  payload: Record<string, unknown>
): SourceCandidate[] {
  const rawSources = Array.isArray(payload.sources) ? payload.sources : []
  const candidates: SourceCandidate[] = []

  for (const rawSource of rawSources) {
    if (!rawSource || typeof rawSource !== 'object') continue
    const source = rawSource as Record<string, unknown>

    const rawUrl = cleanString(source.source_url)
    // Only an http(s) value becomes a link target, matching the `isUrlLike`
    // gate documents mode already applies to `reference`. This payload comes
    // from an external RAG service over uploaded course documents, so it is
    // untrusted input that reaches an `href` directly. React 19 does neuter a
    // `javascript:` href on its own, so this is a second line rather than the
    // only one — it also keeps relative paths and other schemes from
    // rendering as links that go nowhere useful from this origin. The raw
    // value still feeds the title and type fallbacks.
    const url = rawUrl && isUrlLike(rawUrl) ? rawUrl : undefined
    const fileName = cleanString(source.file_name)
    const expert = cleanString(source.expert)
    // Title fallback chain: file_name -> last URL path segment -> expert
    // name -> skip (no usable title/url means the entry is useless to show).
    const title =
      fileName ?? (rawUrl ? lastPathSegment(rawUrl) : undefined) ?? expert
    if (!title) continue

    const page = cleanPage(source.page_number)
    const labeledPage = cleanString(source.labeled_page_number)
    const type = inferSourceType(cleanString(source.source_type), rawUrl)

    candidates.push({
      type,
      title,
      page,
      labeledPage,
      url,
      dedupeKey: buildDedupeKey({ url, title, page, labeledPage }),
    })
  }

  return candidates
}

function normalizeDocumentsModeSources(
  payload: Record<string, unknown>
): SourceCandidate[] {
  const rawSources = Array.isArray(payload.sources) ? payload.sources : []
  const candidates: SourceCandidate[] = []

  for (const rawSource of rawSources) {
    if (!rawSource || typeof rawSource !== 'object') continue
    const source = rawSource as Record<string, unknown>

    const reference = cleanString(source.reference)
    const explicitTitle = cleanString(source.title)
    const referenceIsUrl = reference ? isUrlLike(reference) : false
    const url = referenceIsUrl ? reference : undefined

    // Title fallback: explicit title -> (if reference is a URL) a short name
    // derived from its last path segment -> the raw reference -> skip.
    const title =
      explicitTitle ??
      (referenceIsUrl && reference
        ? (lastPathSegment(reference) ?? reference)
        : reference)
    if (!title) continue

    const rawChunks = Array.isArray(source.chunks) ? source.chunks : []
    const firstChunk =
      rawChunks.length > 0 && rawChunks[0] && typeof rawChunks[0] === 'object'
        ? (rawChunks[0] as Record<string, unknown>)
        : undefined

    const excerpt = truncateExcerpt(cleanString(firstChunk?.content))
    const page = cleanPage(firstChunk?.page_number)
    const labeledPage = cleanString(firstChunk?.labeled_page_number)

    const typeHint = [
      cleanString(source.source_type),
      cleanString(source.reference_type),
    ]
      .filter((part): part is string => Boolean(part))
      .join(' ')
    const type = inferSourceType(typeHint, url)

    candidates.push({
      type,
      title,
      page,
      labeledPage,
      url,
      excerpt,
      dedupeKey: buildDedupeKey({ url, title, page, labeledPage }),
    })
  }

  return candidates
}
