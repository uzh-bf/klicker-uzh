import { sanitizeDocQueryResult } from './docQueryResult'

type RecordValue = Record<string, unknown>
type Passage = { source: RecordValue; chunk: RecordValue }
type Execute<Options, Result> = (
  input: unknown,
  options: Options
) => Result | PromiseLike<Result>
export type GraphQueryScope = { enabled: boolean; buildId?: string }
export type GraphQueryDependencies = {
  validateScope: () => Promise<GraphQueryScope>
  hints: (query: string) => Promise<string[]>
}

function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function documentPayload(value: unknown, depth = 0): RecordValue | undefined {
  if (depth > 5) return undefined
  if (typeof value === 'string') {
    try {
      return documentPayload(JSON.parse(value), depth + 1)
    } catch {
      return undefined
    }
  }
  if (!record(value) || value.isError === true || 'error' in value)
    return undefined
  if (Array.isArray(value.sources)) {
    // A bare payload must not also carry an envelope representation; the
    // ambiguity makes the result unusable for fusion.
    if ('structuredContent' in value || 'content' in value || 'result' in value)
      return undefined
    return value.mode === 'documents' ? value : undefined
  }
  const representations: unknown[] = []
  if (value.structuredContent !== undefined)
    representations.push(value.structuredContent)
  if ('content' in value) {
    if (!Array.isArray(value.content)) return undefined
    for (const item of value.content) {
      if (!record(item) || item.type !== 'text') return undefined
      representations.push(item.text)
    }
  }
  if (value.result !== undefined) representations.push(value.result)
  if (representations.length === 0) return undefined
  const payloads: RecordValue[] = []
  for (const representation of representations) {
    const payload = documentPayload(representation, depth + 1)
    if (!payload) return undefined
    payloads.push(payload)
  }
  // Coexisting representations must agree. Promoting one over a disagreeing
  // sibling would fabricate evidence, so the caller keeps the original result.
  const first = canonical(payloads[0])
  return payloads.every((payload) => canonical(payload) === first)
    ? payloads[0]
    : undefined
}

function passages(value: unknown): Passage[] | undefined {
  const payload = documentPayload(value)
  if (!payload) return undefined
  const result: Passage[] = []
  for (const source of payload.sources as unknown[]) {
    if (!record(source) || !Array.isArray(source.chunks)) return undefined
    const { chunks, ...metadata } = source
    for (const chunk of chunks) {
      if (
        !record(chunk) ||
        typeof chunk.content !== 'string' ||
        !chunk.content.trim()
      )
        return undefined
      result.push({ source: metadata, chunk })
      if (result.length > 100) return undefined
    }
  }
  return result
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (record(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`
  return JSON.stringify(value) ?? 'null'
}

// The document producer (mcp-doc-query documents mode) attaches per-query
// retrieval metadata in development responses: a chunk `score` and
// `global_rank` and a source `aggregate_rank`. They rank one search and are
// not part of a passage's identity. `reference`, `source_id` and
// `catalog_record_id` are its stable resource identifiers; the provider emits
// no per-chunk identifier, so a chunk is identified by content and locator.
const PER_QUERY_SOURCE_FIELDS: readonly string[] = ['aggregate_rank']
const PER_QUERY_CHUNK_FIELDS: readonly string[] = ['score', 'global_rank']
const RESOURCE_ID_FIELDS: readonly string[] = [
  'reference',
  'source_id',
  'catalog_record_id',
]

function withoutFields(
  value: RecordValue,
  fields: readonly string[]
): RecordValue {
  const result: RecordValue = {}
  for (const [key, entry] of Object.entries(value)) {
    if (!fields.includes(key)) result[key] = entry
  }
  return result
}

/**
 * Deduplication identity for one passage. A stable provider resource
 * identifier lets the per-query score metadata be ignored; the content, the
 * locator and every other source and chunk field stay in the key, so
 * conflicting evidence or provenance is never merged. Without a stable
 * resource identifier the full canonical passage is used, which can only
 * preserve more passages, never fewer.
 */
function passageKey(passage: Passage): string {
  const identified = RESOURCE_ID_FIELDS.some((field) => {
    const value = passage.source[field]
    return typeof value === 'string' && value.trim().length > 0
  })
  if (!identified) return canonical(passage)
  return canonical({
    source: withoutFields(passage.source, PER_QUERY_SOURCE_FIELDS),
    chunk: withoutFields(passage.chunk, PER_QUERY_CHUNK_FIELDS),
  })
}

/** Combine exact passages, never infer identity from a filename or similar text. */
export function combineGraphSearchDocuments(
  original: unknown,
  expanded: unknown
): unknown {
  const first = passages(original)
  const second = passages(expanded)
  if (!first || !second || second.length === 0) return original
  const ranked = new Map<
    string,
    { passage: Passage; score: number; ranks: number[] }
  >()
  for (const [search, candidates] of [first, second].entries()) {
    candidates.forEach((passage, index) => {
      const key = passageKey(passage)
      const candidate = ranked.get(key) ?? {
        passage,
        score: 0,
        ranks: [Infinity, Infinity],
      }
      if (candidate.ranks[search] !== Infinity) return
      candidate.score += 1 / (60 + index + 1)
      candidate.ranks[search] = index
      ranked.set(key, candidate)
    })
  }
  const selected: Passage[] = []
  const seen = new Set<string>()
  let characters = 0
  function admit(passage: Passage) {
    const key = passageKey(passage)
    const size = String(passage.chunk.content).length
    if (seen.has(key) || selected.length >= 12 || characters + size > 16000)
      return
    seen.add(key)
    characters += size
    selected.push(passage)
  }
  // Reserve the strongest original evidence before admitting graph discoveries.
  for (const passage of first) {
    if (selected.length === 3) break
    admit(passage)
  }
  for (const { passage } of [...ranked.values()].sort(
    (a, b) =>
      b.score - a.score ||
      a.ranks[0]! - b.ranks[0]! ||
      a.ranks[1]! - b.ranks[1]!
  ))
    admit(passage)
  if (selected.length === 0) return original
  // Keep each provider source group: the citation UI displays its first chunk's locator.
  // Coalescing groups from two searches could hide the newly retrieved page.
  const groups: RecordValue[] = []
  let previousSource: RecordValue | undefined
  for (const { source, chunk } of selected) {
    if (source === previousSource)
      (groups[groups.length - 1]!.chunks as RecordValue[]).push(chunk)
    else groups.push({ ...source, chunks: [chunk] })
    previousSource = source
  }
  const payload = {
    mode: 'documents',
    sources: groups,
    summary: {
      count: groups.length,
      sources_returned: groups.length,
      chunks_returned: selected.length,
    },
    sources_used: groups.length,
  }
  return sanitizeDocQueryResult({
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    structuredContent: payload,
  })
}

async function untilAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal
): Promise<T> {
  signal.throwIfAborted()
  let abort: () => void = () => undefined
  const aborted = new Promise<never>((_, reject) => {
    abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
  })
  try {
    return await Promise.race([promise, aborted])
  } finally {
    signal.removeEventListener('abort', abort)
  }
}

export function graphAssistedDocumentQuery<
  Options extends { abortSignal?: AbortSignal },
  Result,
>(
  execute: Execute<Options, Result>,
  dependencies: GraphQueryDependencies
): Execute<Options, Result> {
  let augmentationUsed = false
  return async (input, options) => {
    const signal =
      options.abortSignal instanceof AbortSignal
        ? options.abortSignal
        : undefined
    signal?.throwIfAborted()
    const initial = await dependencies.validateScope()
    const query = record(input) ? input.query : undefined
    const eligible =
      !augmentationUsed &&
      initial.enabled &&
      initial.buildId &&
      typeof query === 'string' &&
      query.trim() &&
      query.length <= 2000
    const graphSignal = AbortSignal.timeout(1500)
    const hintsPromise = eligible
      ? untilAbort(
          Promise.resolve().then(() => dependencies.hints(query as string)),
          signal ? AbortSignal.any([signal, graphSignal]) : graphSignal
        ).catch(() => [])
      : Promise.resolve([])
    const original = await execute(input, options)
    signal?.throwIfAborted()
    const hints = await hintsPromise
    signal?.throwIfAborted()
    const current = await dependencies.validateScope()
    if (
      !eligible ||
      augmentationUsed ||
      !current.enabled ||
      current.buildId !== initial.buildId ||
      !passages(original) ||
      hints.length === 0
    )
      return original
    const safeHints = hints
      .filter(
        (hint) =>
          typeof hint === 'string' &&
          hint.length <= 100 &&
          /^[\p{L}\p{N}\s()&.,+/-]+$/u.test(hint)
      )
      .slice(0, 6)
    if (safeHints.length === 0) return original
    augmentationUsed = true
    const augmentationSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(3000)])
      : AbortSignal.timeout(3000)
    let expanded: unknown
    try {
      expanded = await untilAbort(
        Promise.resolve(
          execute(
            {
              ...(input as RecordValue),
              query: `${query}\nRelated concepts: ${safeHints.join(', ')}`,
            },
            { ...options, abortSignal: augmentationSignal }
          )
        ),
        augmentationSignal
      )
    } catch {
      signal?.throwIfAborted()
      await dependencies.validateScope()
      return original
    }
    signal?.throwIfAborted()
    const finalScope = await dependencies.validateScope()
    if (!finalScope.enabled || finalScope.buildId !== initial.buildId)
      return original
    // The combiner only reconstructs validated document envelopes; other
    // provider result contracts pass through unchanged.
    return combineGraphSearchDocuments(original, expanded) as Result
  }
}
