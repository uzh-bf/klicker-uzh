import { describe, expect, it, vi } from 'vitest'
import {
  countDocQueryDocuments,
  normalizeSourcesFromParts,
} from '../src/lib/sources/normalizeSources'
import {
  combineGraphSearchDocuments,
  graphAssistedDocumentQuery,
} from '../src/services/graphAssistedDocQuery'

const documents = (content: string, page = 1) => ({
  mode: 'documents',
  sources: [
    {
      reference: 'synthetic.pdf',
      title: 'Synthetic course',
      chunks: [{ content, page_number: page }],
    },
  ],
})
// Mirrors the mcp-doc-query documents-mode provider: a stable source identity
// plus per-query chunk score/rank metadata that varies between two searches.
const scoredDocuments = (
  source: Record<string, unknown>,
  chunk: Record<string, unknown>
) => ({ mode: 'documents', sources: [{ ...source, chunks: [chunk] }] })
const dependencies = () => ({
  validateScope: vi
    .fn()
    .mockResolvedValue({ enabled: true, buildId: 'build-1' }),
  hints: vi.fn().mockResolvedValue(['Covariance']),
})

describe('graph-assisted document retrieval', () => {
  it('reports actual expansion and evidence sizes without content', async () => {
    const observe = vi.fn()
    const execute = vi
      .fn()
      .mockResolvedValueOnce(documents('baseline-secret'))
      .mockResolvedValueOnce(documents('expanded-secret'))
    await graphAssistedDocumentQuery(execute, { ...dependencies(), observe })(
      { query: 'query-secret' },
      {}
    )
    const event = observe.mock.calls[0]![0]
    expect(observe).toHaveBeenCalledTimes(1)
    expect(event).toMatchObject({
      outcome: 'fused',
      expansionAttempted: true,
      hintCount: 1,
      baselinePassages: 1,
      expandedPassages: 1,
      resultPassages: 2,
      resultCharacters: 'baseline-secret'.length + 'expanded-secret'.length,
    })
    expect(event.elapsedMs).toBeGreaterThanOrEqual(0)
    expect(Object.keys(event).sort()).toEqual(
      [
        'outcome',
        'expansionAttempted',
        'hintCount',
        'baselinePassages',
        'expandedPassages',
        'resultPassages',
        'resultCharacters',
        'elapsedMs',
      ].sort()
    )
    expect(JSON.stringify(event)).not.toMatch(/secret|Covariance|synthetic/)
  })

  it('keeps unavailable counts distinct from empty results and ignores observer failures', async () => {
    const observe = vi.fn().mockImplementation(() => {
      throw new Error('observer failed')
    })
    const malformed = {
      content: [{ type: 'text', text: 'not a document payload' }],
    }
    await expect(
      graphAssistedDocumentQuery(vi.fn().mockResolvedValue(malformed), {
        ...dependencies(),
        observe,
      })({ query: 'risk' }, {})
    ).resolves.toBe(malformed)
    expect(observe.mock.calls[0]![0]).toMatchObject({
      outcome: 'invalid_baseline',
      expansionAttempted: false,
      baselinePassages: null,
      resultPassages: null,
      resultCharacters: null,
    })
    const empty = { mode: 'documents', sources: [] }
    const observeEmpty = vi.fn()
    await graphAssistedDocumentQuery(vi.fn().mockResolvedValue(empty), {
      ...dependencies(),
      hints: vi.fn().mockResolvedValue([]),
      observe: observeEmpty,
    })({ query: 'risk' }, {})
    expect(observeEmpty.mock.calls[0]![0]).toMatchObject({
      outcome: 'no_hints',
      baselinePassages: 0,
      resultPassages: 0,
      resultCharacters: 0,
    })
    const error = new Error('scope revoked')
    await expect(
      graphAssistedDocumentQuery(vi.fn(), {
        ...dependencies(),
        validateScope: vi.fn().mockRejectedValue(error),
        observe,
      })({ query: 'risk' }, {})
    ).rejects.toBe(error)
  })

  it('allows at most one augmentation across concurrent tool calls', async () => {
    const execute = vi.fn().mockResolvedValue(documents('Evidence'))
    const wrapped = graphAssistedDocumentQuery(execute, dependencies())
    await Promise.all([
      wrapped({ query: 'diversification' }, {}),
      wrapped({ query: 'portfolio risk' }, {}),
    ])
    expect(execute).toHaveBeenCalledTimes(3)
  })

  it('preserves document search when the graph reader throws synchronously', async () => {
    const deps = dependencies()
    deps.hints.mockImplementation(() => {
      throw new Error('graph unavailable')
    })
    const original = documents('Evidence')
    const execute = vi.fn().mockResolvedValue(original)
    const observe = vi.fn()
    expect(
      await graphAssistedDocumentQuery(execute, { ...deps, observe })(
        { query: 'risk' },
        {}
      )
    ).toBe(original)
    expect(execute).toHaveBeenCalledTimes(1)
    expect(observe.mock.calls[0]![0]).toMatchObject({
      outcome: 'hints_unavailable',
      expansionAttempted: false,
      hintCount: null,
    })
  })

  it('suppresses completed augmentation after access is revoked', async () => {
    const deps = dependencies()
    deps.validateScope
      .mockResolvedValueOnce({ enabled: true, buildId: 'build-1' })
      .mockResolvedValueOnce({ enabled: true, buildId: 'build-1' })
      .mockRejectedValueOnce(new Error('revoked'))
    const execute = vi.fn().mockResolvedValue(documents('Evidence'))
    await expect(
      graphAssistedDocumentQuery(execute, deps)({ query: 'risk' }, {})
    ).rejects.toThrow('revoked')
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it('rejects mixed media envelopes and unsafe expansion labels', async () => {
    const original = {
      structuredContent: documents('Evidence'),
      content: [{ type: 'image', data: 'synthetic' }],
    }
    expect(combineGraphSearchDocuments(original, documents('More'))).toBe(
      original
    )
    const deps = dependencies()
    deps.hints.mockResolvedValue([
      'https://private.example/path',
      'x'.repeat(101),
    ])
    const execute = vi.fn().mockResolvedValue(documents('Evidence'))
    await graphAssistedDocumentQuery(execute, deps)({ query: 'risk' }, {})
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it.each([
    undefined,
    null,
    '',
    '  ',
    1,
  ])('expands a legacy query when question is unusable (%j)', async (question) => {
    const execute = vi.fn().mockResolvedValue(documents('Synthetic passage.'))
    const deps = dependencies()
    const input = { query: 'risk', question }
    await graphAssistedDocumentQuery(execute, deps)(input, {})
    expect(deps.hints).toHaveBeenCalledWith('risk')
    expect(execute).toHaveBeenCalledTimes(2)
    expect(execute.mock.calls[0]?.[0]).toEqual(input)
    expect(execute.mock.calls[1]?.[0]).toMatchObject({
      query: expect.stringContaining('Covariance'),
      question,
    })
    expect(Object.keys(execute.mock.calls[1]![0]).sort()).toEqual(
      Object.keys(input).sort()
    )
  })

  it.each([
    'question',
    'query',
  ] as const)('preserves the original %s and expands the same field for additional passage retrieval', async (field) => {
    const original = documents('Diversification spreads investments.')
    const expanded = documents(
      'Covariance determines how holdings move together.',
      2
    )
    const execute = vi
      .fn()
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(expanded)
    const deps = dependencies()
    const signal = new AbortController().signal
    const input = { [field]: 'Why diversify?', expand: false, limit: 6 }
    const result = (await graphAssistedDocumentQuery(execute, deps)(input, {
      abortSignal: signal,
      toolCallId: 'call-1',
    })) as any
    expect(execute.mock.calls[0]).toEqual([
      input,
      { abortSignal: signal, toolCallId: 'call-1' },
    ])
    expect(execute.mock.calls[1]?.[0]).toMatchObject({
      [field]: expect.stringContaining('Covariance'),
      expand: false,
      limit: 6,
    })
    expect(Object.keys(execute.mock.calls[1]![0]).sort()).toEqual(
      Object.keys(input).sort()
    )
    expect(deps.hints).toHaveBeenCalledWith(input[field])
    expect(execute.mock.calls[1]?.[1].toolCallId).toBe('call-1')
    expect(
      result.structuredContent.sources.flatMap((source: any) =>
        source.chunks.map((chunk: any) => chunk.page_number)
      )
    ).toEqual([1, 2])
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent)
    const persistedResult = JSON.parse(JSON.stringify(result))
    expect(
      normalizeSourcesFromParts([
        {
          type: 'tool-call',
          toolName: 'KB_doc_query',
          result: persistedResult,
        },
      ]).map((source) => source.page)
    ).toEqual([1, 2])
    expect(deps.validateScope).toHaveBeenCalledTimes(3)
  })

  it('does not call the graph or augment when disabled', async () => {
    const deps = dependencies()
    deps.validateScope.mockResolvedValue({ enabled: false })
    const original = documents('Original evidence')
    const execute = vi.fn().mockResolvedValue(original)
    expect(
      await graphAssistedDocumentQuery(execute, deps)({ query: 'test' }, {})
    ).toBe(original)
    expect(execute).toHaveBeenCalledTimes(1)
    expect(deps.hints).not.toHaveBeenCalled()
  })

  it.each([
    undefined,
    { answer: 'Unstructured answer' },
    { isError: true, structuredContent: documents('Do not use') },
  ])('retains incompatible or failed original envelopes', async (original) => {
    const execute = vi.fn().mockResolvedValue(original)
    expect(
      await graphAssistedDocumentQuery(execute, dependencies())(
        { query: 'test' },
        {}
      )
    ).toBe(original)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('preserves required document failures', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('document unavailable'))
    await expect(
      graphAssistedDocumentQuery(execute, dependencies())({ query: 'test' }, {})
    ).rejects.toThrow('document unavailable')
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('suppresses both results after binding revocation', async () => {
    const deps = dependencies()
    deps.validateScope
      .mockResolvedValueOnce({ enabled: true, buildId: 'build-1' })
      .mockRejectedValueOnce(new Error('revoked'))
    const execute = vi
      .fn()
      .mockResolvedValue(documents('Previously authorized'))
    await expect(
      graphAssistedDocumentQuery(execute, deps)({ query: 'test' }, {})
    ).rejects.toThrow('revoked')
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('uses original evidence after graph policy or source revision changes', async () => {
    const deps = dependencies()
    deps.validateScope
      .mockResolvedValueOnce({ enabled: true, buildId: 'build-1' })
      .mockResolvedValue({ enabled: true, buildId: 'build-2' })
    const original = documents('Original')
    const execute = vi.fn().mockResolvedValue(original)
    expect(
      await graphAssistedDocumentQuery(execute, deps)({ query: 'test' }, {})
    ).toBe(original)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('falls back after optional augmentation fails but propagates cancellation', async () => {
    const original = documents('Original')
    const execute = vi
      .fn()
      .mockResolvedValueOnce(original)
      .mockRejectedValueOnce(new Error('timeout'))
    expect(
      await graphAssistedDocumentQuery(execute, dependencies())(
        { query: 'test' },
        {}
      )
    ).toBe(original)
    const controller = new AbortController()
    controller.abort()
    await expect(
      graphAssistedDocumentQuery(execute, dependencies())(
        { query: 'test' },
        { abortSignal: controller.signal }
      )
    ).rejects.toThrow()
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it('deduplicates exact passages but preserves different evidence from identically named sources', () => {
    const first = documents('First support')
    first.sources[0]!.chunks.push({
      content: 'Another passage',
      page_number: 2,
    })
    const second = documents('Different support')
    const result = combineGraphSearchDocuments(first, {
      mode: 'documents',
      sources: [...first.sources, ...second.sources],
    }) as any
    expect(result.structuredContent.sources).toHaveLength(2)
    expect(result.structuredContent.summary).toEqual({
      count: 2,
      sources_returned: 2,
      chunks_returned: 3,
    })
    expect(
      result.structuredContent.sources.flatMap((source: any) =>
        source.chunks.map((chunk: any) => chunk.content)
      )
    ).toEqual(['First support', 'Another passage', 'Different support'])
  })

  it('keeps every original passage and appends new graph evidence after it', () => {
    const make = (ids: number[]) => ({
      mode: 'documents',
      sources: ids.map((id) => ({
        reference: 'synthetic.pdf',
        chunks: [{ id, content: `Evidence ${id}`, page_number: id }],
      })),
    })
    const original = make(Array.from({ length: 20 }, (_, index) => index + 1))
    const result = combineGraphSearchDocuments(
      original,
      make([8, 21, 22, 21])
    ) as any
    const ids = result.structuredContent.sources.flatMap((source: any) =>
      source.chunks.map((chunk: any) => chunk.id)
    )
    expect(ids).toEqual([
      ...original.sources.map((_, index) => index + 1),
      21,
      22,
    ])
    expect(result.structuredContent.sources.slice(0, 20)).toEqual(
      original.sources
    )
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent)
  })

  it('keeps the original grouping when graph evidence repeats an original passage', () => {
    const chunks = Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
      content: `Evidence ${index + 1}`,
    }))
    const original = {
      mode: 'documents',
      sources: [{ reference: 'a.pdf', chunks }],
    }
    const expanded = {
      mode: 'documents',
      sources: [
        { reference: 'a.pdf', chunks: [chunks[5]] },
        { reference: 'b.pdf', chunks: [{ id: 7, content: 'Other evidence' }] },
      ],
    }
    const result = combineGraphSearchDocuments(original, expanded) as any
    expect(
      result.structuredContent.sources.map((source: any) => [
        source.reference,
        source.chunks.map((chunk: any) => chunk.id),
      ])
    ).toEqual([
      ['a.pdf', [1, 2, 3, 4, 5, 6]],
      ['b.pdf', [7]],
    ])
  })

  it('limits graph additions to six passages and 8,000 characters while keeping oversized originals', () => {
    const original = documents('x'.repeat(16001))
    const expanded = {
      mode: 'documents',
      sources: [
        {
          reference: 'graph.pdf',
          chunks: [
            { content: 'a'.repeat(7000), page_number: 1 },
            { content: 'b'.repeat(2000), page_number: 2 },
            ...Array.from({ length: 8 }, (_, index) => ({
              content: `Short ${index}`,
              page_number: index + 3,
            })),
          ],
        },
      ],
    }
    const result = combineGraphSearchDocuments(original, expanded) as any
    const [kept, ...added] = result.structuredContent.sources.flatMap(
      (source: any) => source.chunks
    )
    expect(kept.content).toHaveLength(16001)
    // The 2,000-character passage would exceed the headroom and is skipped.
    expect(added.map((chunk: any) => chunk.page_number)).toEqual([
      1, 3, 4, 5, 6, 7,
    ])
  })

  it('spreads unranked graph additions across provider sources and groups them per source', () => {
    const source = (reference: string, count: number) => ({
      reference,
      chunks: Array.from({ length: count }, (_, index) => ({
        content: `${reference} ${index}`,
        page_number: index + 1,
      })),
    })
    const result = combineGraphSearchDocuments(documents('Baseline'), {
      mode: 'documents',
      sources: [source('first.pdf', 8), source('second.pdf', 2)],
    }) as any
    expect(
      result.structuredContent.sources
        .slice(1)
        .map((group: any) => group.chunks.map((chunk: any) => chunk.content))
    ).toEqual([
      ['first.pdf 0', 'first.pdf 1', 'first.pdf 2', 'first.pdf 3'],
      ['second.pdf 0', 'second.pdf 1'],
    ])
    expect(
      normalizeSourcesFromParts([
        { type: 'tool-call', toolName: 'KB_doc_query', result },
      ]).filter((card) => card.title !== 'Synthetic course')
    ).toHaveLength(2)
    expect(countDocQueryDocuments(result.structuredContent)).toBe(3)
  })

  it('keeps one long unranked passage from excluding every other source', () => {
    const result = combineGraphSearchDocuments(documents('Baseline'), {
      mode: 'documents',
      sources: [
        { reference: 'long.pdf', chunks: [{ content: 'a'.repeat(7999) }] },
        { reference: 'short.pdf', chunks: [{ content: 'b'.repeat(1000) }] },
      ],
    }) as any
    expect(
      result.structuredContent.sources
        .slice(1)
        .map((group: any) => group.reference)
    ).toEqual(['short.pdf'])
  })

  it('selects graph additions by global rank only when every chunk carries one', () => {
    const ranked = (ranks: unknown[]) => ({
      mode: 'documents',
      sources: [
        {
          reference: 'first.pdf',
          chunks: ranks.slice(0, 4).map((global_rank, index) => ({
            content: `first ${index}`,
            global_rank,
          })),
        },
        {
          reference: 'second.pdf',
          chunks: ranks.slice(4).map((global_rank, index) => ({
            content: `second ${index}`,
            global_rank,
          })),
        },
      ],
    })
    const added = (expanded: unknown) =>
      (
        combineGraphSearchDocuments(documents('Baseline'), expanded) as any
      ).structuredContent.sources
        .slice(1)
        .flatMap((group: any) =>
          group.chunks.map((chunk: any) => chunk.content)
        )
    expect(added(ranked([1, 2, 3, 4, 5, 6, 7, 8]))).toEqual([
      'first 0',
      'first 1',
      'first 2',
      'first 3',
      'second 0',
      'second 1',
    ])
    // A missing rank makes the order unknown, so sources are interleaved.
    expect(added(ranked([1, 2, 3, 4, 5, 6, null, 8]))).toEqual([
      'first 0',
      'first 1',
      'first 2',
      'second 0',
      'second 1',
      'second 2',
    ])
  })

  it('shows the original source cards unchanged next to graph additions', () => {
    const original = {
      mode: 'documents',
      sources: [
        {
          reference: 'a.pdf',
          title: 'A',
          chunks: [
            { content: 'A one', page_number: 1 },
            { content: 'A two', page_number: 2 },
          ],
        },
        {
          reference: 'b.pdf',
          title: 'B',
          chunks: [{ content: 'B one', page_number: 1 }],
        },
      ],
    }
    const cards = (result: unknown) =>
      normalizeSourcesFromParts([
        { type: 'tool-call', toolName: 'KB_doc_query', result },
      ]).map((source) => [source.title, source.page])
    const fused = combineGraphSearchDocuments(original, {
      mode: 'documents',
      sources: [
        {
          reference: 'c.pdf',
          title: 'C',
          chunks: [{ content: 'C one', page_number: 4 }],
        },
      ],
    })
    expect(cards(fused)).toEqual([...cards(original), ['C', 4]])
    expect(countDocQueryDocuments((fused as any).structuredContent)).toBe(
      countDocQueryDocuments(original) + 1
    )
  })

  it('handles JSON MCP envelopes and never retains obsolete generated answers', () => {
    const first = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ ...documents('A'), answer: 'obsolete' }),
        },
      ],
    }
    const result = combineGraphSearchDocuments(first, {
      structuredContent: documents('B'),
    }) as any
    expect(result.structuredContent.answer).toBeUndefined()
    expect(result.structuredContent.sources).toHaveLength(2)
  })

  it('returns the original unchanged when graph evidence only repeats it with other score metadata', () => {
    const passage = (
      score: number,
      globalRank: number,
      aggregateRank: number
    ) =>
      scoredDocuments(
        {
          reference: 'synthetic.pdf',
          reference_type: 'url',
          title: 'Synthetic course',
          aggregate_rank: aggregateRank,
        },
        { content: 'Evidence', page_number: 1, score, global_rank: globalRank }
      )
    const original = passage(0.91, 1, 1)
    expect(combineGraphSearchDocuments(original, passage(0.32, 7, 3))).toBe(
      original
    )
  })

  it('keeps passages whose content conflicts under a shared resource identity', () => {
    const at = (content: string, score: number) =>
      scoredDocuments(
        { reference: 'synthetic.pdf' },
        { content, page_number: 1, score }
      )
    const result = combineGraphSearchDocuments(
      at('First support', 0.9),
      at('Other support', 0.2)
    ) as any
    expect(
      result.structuredContent.sources.flatMap((source: any) =>
        source.chunks.map((chunk: any) => chunk.content)
      )
    ).toEqual(['First support', 'Other support'])
  })

  it('keeps passages whose locator conflicts despite identical content', () => {
    const at = (page: number, score: number) =>
      scoredDocuments(
        { reference: 'synthetic.pdf' },
        { content: 'Evidence', page_number: page, score }
      )
    const result = combineGraphSearchDocuments(at(1, 0.9), at(2, 0.2)) as any
    expect(
      result.structuredContent.sources.flatMap((source: any) =>
        source.chunks.map((chunk: any) => chunk.page_number)
      )
    ).toEqual([1, 2])
  })

  it('keeps passages whose source provenance conflicts despite a shared identity', () => {
    const at = (title: string) =>
      scoredDocuments(
        { reference: 'synthetic.pdf', title },
        { content: 'Evidence', page_number: 1 }
      )
    const result = combineGraphSearchDocuments(
      at('Baseline title'),
      at('Expanded title')
    ) as any
    expect(result.structuredContent.sources).toHaveLength(2)
    expect(
      result.structuredContent.sources.map((source: any) => source.title)
    ).toEqual(['Baseline title', 'Expanded title'])
  })

  it('falls back to the full passage when no stable resource identifier is present', () => {
    const at = (score: number) =>
      scoredDocuments(
        { title: 'Unidentified source' },
        { content: 'Evidence', page_number: 1, score }
      )
    const result = combineGraphSearchDocuments(at(0.9), at(0.2)) as any
    expect(result.structuredContent.sources).toHaveLength(2)
  })

  it('fuses an envelope whose text and structured payloads agree', () => {
    const payload = documents('Baseline evidence')
    const result = combineGraphSearchDocuments(
      {
        structuredContent: payload,
        content: [{ type: 'text', text: JSON.stringify(payload) }],
      },
      documents('Graph evidence', 2)
    ) as any
    expect(
      result.structuredContent.sources.flatMap((source: any) =>
        source.chunks.map((chunk: any) => chunk.page_number)
      )
    ).toEqual([1, 2])
  })

  it('refuses to fuse an envelope whose text and structured payloads disagree', async () => {
    const conflicted = {
      structuredContent: documents('Baseline evidence'),
      content: [
        { type: 'text', text: JSON.stringify(documents('Conflicting')) },
      ],
    }
    expect(combineGraphSearchDocuments(conflicted, documents('More', 2))).toBe(
      conflicted
    )
    const execute = vi.fn().mockResolvedValue(conflicted)
    expect(
      await graphAssistedDocumentQuery(execute, dependencies())(
        { query: 'risk' },
        {}
      )
    ).toBe(conflicted)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('refuses an envelope whose text sibling is not decodable JSON', () => {
    const envelope = {
      structuredContent: documents('Baseline evidence'),
      content: [{ type: 'text', text: 'truncated' }],
    }
    expect(combineGraphSearchDocuments(envelope, documents('More'))).toBe(
      envelope
    )
  })
})
