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
})
