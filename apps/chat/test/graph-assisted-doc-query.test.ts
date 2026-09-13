import { describe, expect, it, vi } from 'vitest'
import { normalizeSourcesFromParts } from '../src/lib/sources/normalizeSources'
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
    expect(
      await graphAssistedDocumentQuery(execute, deps)({ query: 'risk' }, {})
    ).toBe(original)
    expect(execute).toHaveBeenCalledTimes(1)
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

  it('preserves the original query and uses a traversed concept for additional passage retrieval', async () => {
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
    const result = (await graphAssistedDocumentQuery(execute, deps)(
      { query: 'Why diversify?', limit: 6 },
      { abortSignal: signal, toolCallId: 'call-1' }
    )) as any
    expect(execute.mock.calls[0]).toEqual([
      { query: 'Why diversify?', limit: 6 },
      { abortSignal: signal, toolCallId: 'call-1' },
    ])
    expect(execute.mock.calls[1]?.[0]).toMatchObject({
      query: expect.stringContaining('Covariance'),
      limit: 6,
    })
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

  it('protects the baseline prefix, fuses repeated evidence once, and preserves emitted order', () => {
    const make = (ids: number[]) => ({
      mode: 'documents',
      sources: ids.map((id) => ({
        reference: 'synthetic.pdf',
        chunks: [{ id, content: `Evidence ${id}`, page_number: id }],
      })),
    })
    const result = combineGraphSearchDocuments(
      make([1, 2, 3, 4, 5, 6, 7, 8]),
      make([8, 9, 10, 11, 12, 13, 14, 8])
    ) as any
    const ids = result.structuredContent.sources.flatMap((source: any) =>
      source.chunks.map((chunk: any) => chunk.id)
    )
    expect(ids.slice(0, 4)).toEqual([1, 2, 3, 8])
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(12)
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent)
  })

  it('keeps global rank order when a provider group resumes after another source', () => {
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
      result.structuredContent.sources.flatMap((source: any) =>
        source.chunks.map((chunk: any) => chunk.id)
      )
    ).toEqual([1, 2, 3, 6, 7, 4, 5])
    expect(
      result.structuredContent.sources.map((source: any) => source.reference)
    ).toEqual(['a.pdf', 'b.pdf', 'a.pdf'])
  })

  it('skips oversized passages and reserves original character budget before expansion', () => {
    const original = documents('x'.repeat(16001))
    original.sources[0]!.chunks.push({
      content: 'y'.repeat(8000),
      page_number: 2,
    })
    original.sources[0]!.chunks.push({
      content: 'z'.repeat(8000),
      page_number: 3,
    })
    const result = combineGraphSearchDocuments(
      original,
      documents('New evidence')
    ) as any
    const chunks = result.structuredContent.sources.flatMap(
      (source: any) => source.chunks
    )
    expect(chunks.map((chunk: any) => chunk.page_number)).toEqual([2, 3])
    expect(
      chunks.reduce((sum: number, chunk: any) => sum + chunk.content.length, 0)
    ).toBe(16000)
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

  it('deduplicates a repeated passage that only differs in per-query score metadata', () => {
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
    const result = combineGraphSearchDocuments(
      passage(0.91, 1, 1),
      passage(0.32, 7, 3)
    ) as any
    expect(result.structuredContent.sources).toHaveLength(1)
    expect(result.structuredContent.summary).toEqual({
      count: 1,
      sources_returned: 1,
      chunks_returned: 1,
    })
    // The baseline occurrence is retained with its own score metadata.
    expect(result.structuredContent.sources[0]).toMatchObject({
      aggregate_rank: 1,
      chunks: [{ content: 'Evidence', score: 0.91, global_rank: 1 }],
    })
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
