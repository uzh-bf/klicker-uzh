import { createHash } from 'node:crypto'
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
  if (
    Array.isArray(value.content) &&
    value.content.some((item) => !record(item) || item.type !== 'text')
  )
    return undefined
  if (value.mode === 'documents' && Array.isArray(value.sources)) return value
  if (value.structuredContent !== undefined)
    return documentPayload(value.structuredContent, depth + 1)
  if (Array.isArray(value.content) && value.content.length === 1) {
    const item = value.content[0]
    if (record(item) && item.type === 'text')
      return documentPayload(item.text, depth + 1)
  }
  if ('result' in value) return documentPayload(value.result, depth + 1)
  return undefined
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

/** Combine exact passages, never infer identity from a filename or similar text. */
export function combineGraphSearchDocuments(
  original: unknown,
  expanded: unknown
): unknown {
  const first = passages(original)
  const second = passages(expanded)
  if (!first || !second || second.length === 0) return original
  const selected: Passage[] = []
  const seen = new Set<string>()
  let characters = 0
  for (let index = 0; index < Math.max(first.length, second.length); index++) {
    for (const candidate of [first[index], second[index]]) {
      if (!candidate || selected.length >= 12) continue
      const key = createHash('sha256')
        .update(canonical(candidate))
        .digest('hex')
      if (seen.has(key)) continue
      const size = String(candidate.chunk.content).length
      if (characters + size > 16000) continue
      seen.add(key)
      characters += size
      selected.push(candidate)
    }
  }
  if (selected.length === 0) return original
  // Keep each provider source group: the citation UI displays its first chunk's locator.
  // Coalescing groups from two searches could hide the newly retrieved page.
  const groups = new Map<RecordValue, RecordValue>()
  for (const { source, chunk } of selected) {
    const group = groups.get(source)
    if (group) (group.chunks as RecordValue[]).push(chunk)
    else groups.set(source, { ...source, chunks: [chunk] })
  }
  const payload = {
    mode: 'documents',
    sources: [...groups.values()],
    summary: { count: groups.size },
    sources_used: groups.size,
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
