import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import type { PublishedKnowledgeGraph } from '@klicker-uzh/knowledge-graph'
import {
  closeKnowledgeGraphClient,
  readKnowledgeGraphSearchHints,
} from '@klicker-uzh/knowledge-graph'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { normalizeSourcesFromParts } from '../src/lib/sources/normalizeSources'
import { graphAssistedDocumentQuery } from '../src/services/graphAssistedDocQuery'

// `falkordb` is a dependency of @klicker-uzh/knowledge-graph, not of this app,
// so pnpm exposes it only inside that package. Resolve the native driver through
// the entry that owns the connection instead of adding an undeclared dependency.
const knowledgeGraphRequire = createRequire(
  createRequire(import.meta.url).resolve('@klicker-uzh/knowledge-graph')
)
const { FalkorDB } = knowledgeGraphRequire('falkordb') as {
  FalkorDB: {
    connect: (options: {
      socket: { host: string; port: number; connectTimeout: number }
    }) => Promise<FalkorClient>
  }
}

type FalkorGraph = {
  query: (cypher: string) => Promise<unknown>
  delete: () => Promise<unknown>
}

type FalkorClient = {
  selectGraph: (name: string) => FalkorGraph
  close: () => Promise<void>
}

type SyntheticSource = {
  reference: string
  title: string
  chunks: { content: string; page_number: number }[]
}

type SyntheticDocuments = { mode: 'documents'; sources: SyntheticSource[] }

type CombinedEnvelope = {
  content: { type: string; text: string }[]
  structuredContent: { sources: SyntheticSource[] }
}

// Supply a disposable local FalkorDB explicitly; never inherit application
// credentials. Without the explicit test port this suite skips and proves
// nothing about native retrieval.
const port = process.env.GRAPH_RETRIEVAL_TEST_PORT
const host = process.env.GRAPH_RETRIEVAL_TEST_HOST ?? '127.0.0.1'
const LOCAL_HOSTS = ['127.0.0.1', 'localhost', 'host.docker.internal']

const ORIGINAL_QUERY = 'Explain diversification benefits'

function syntheticDocuments(content: string, page: number): SyntheticDocuments {
  return {
    mode: 'documents',
    sources: [
      {
        reference: 'synthetic-portfolio-lecture.pdf',
        title: 'Synthetic portfolio lecture',
        chunks: [{ content, page_number: page }],
      },
    ],
  }
}

const enabledScope = () =>
  Promise.resolve({ enabled: true, buildId: 'synthetic-build' })

describe.skipIf(!port)(
  'graph-assisted document query native integration',
  () => {
    let client: FalkorClient | undefined
    let graph: FalkorGraph | undefined
    let context!: PublishedKnowledgeGraph
    let created = false

    beforeAll(async () => {
      if (!LOCAL_HOSTS.includes(host)) {
        throw new Error(
          'The integration test requires a disposable local FalkorDB'
        )
      }
      if (
        !port ||
        !/^\d+$/.test(port) ||
        Number(port) < 1 ||
        Number(port) > 65535
      ) {
        throw new Error('Invalid GRAPH_RETRIEVAL_TEST_PORT')
      }
      client = await FalkorDB.connect({
        socket: { host, port: Number(port), connectTimeout: 2000 },
      })
      const graphName = `graphrag-chat-test:${randomUUID()}`
      graph = client.selectGraph(graphName)
      await closeKnowledgeGraphClient()
      vi.stubEnv('KB_FALKORDB_HOST', host)
      vi.stubEnv('KB_FALKORDB_PORT', port)
      vi.stubEnv('KB_FALKORDB_TLS', 'false')
      vi.stubEnv('KB_FALKORDB_USERNAME', '')
      vi.stubEnv('KB_FALKORDB_PASSWORD', '')
      await graph.query(`CREATE (a:Concept {name: 'Diversification'}),
      (b:Concept {name: 'Covariance'}),
      (a)-[:RELATED {description: 'Diversification depends on covariance'}]->(b)`)
      created = true
      context = {
        kbId: 'synthetic-kb',
        buildId: 'synthetic-build',
        graphName,
        isStale: false,
        sources: [],
      }
    }, 15000)

    afterAll(async () => {
      await closeKnowledgeGraphClient()
      vi.unstubAllEnvs()
      try {
        if (graph && created) await graph.delete()
      } finally {
        if (client) await client.close()
      }
    }, 15000)

    it('reports the related concept from the real native graph', async () => {
      expect(
        await readKnowledgeGraphSearchHints(context, ORIGINAL_QUERY)
      ).toEqual(['Covariance'])
      expect(
        await readKnowledgeGraphSearchHints(
          context,
          'Summarize portfolio theory'
        )
      ).toEqual([])
      expect(
        await readKnowledgeGraphSearchHints(
          { ...context, isStale: true },
          ORIGINAL_QUERY
        )
      ).toEqual([])
    })

    it('adds the graph-reached passage and preserves the original query and source metadata', async () => {
      const baseline = syntheticDocuments(
        'Diversification spreads risk across holdings.',
        1
      )
      const augmented = syntheticDocuments(
        'Covariance measures how holdings move together.',
        2
      )
      const execute = vi
        .fn()
        .mockResolvedValueOnce(baseline)
        .mockResolvedValueOnce(augmented)
      const signal = new AbortController().signal
      const result = (await graphAssistedDocumentQuery(execute, {
        validateScope: enabledScope,
        hints: (query) => readKnowledgeGraphSearchHints(context, query),
      })(
        { query: ORIGINAL_QUERY, limit: 6 },
        { abortSignal: signal, toolCallId: 'call-1' }
      )) as unknown as CombinedEnvelope

      // The first search keeps the caller's query and options untouched.
      expect(execute.mock.calls[0]).toEqual([
        { query: ORIGINAL_QUERY, limit: 6 },
        { abortSignal: signal, toolCallId: 'call-1' },
      ])
      // The second search is the augmented one, built from the real graph hint.
      expect(execute.mock.calls[1]?.[0]).toMatchObject({
        query: expect.stringContaining('Covariance'),
        limit: 6,
      })
      expect((execute.mock.calls[1]?.[0] as { query: string }).query).toContain(
        ORIGINAL_QUERY
      )
      expect(
        (execute.mock.calls[1]?.[1] as { toolCallId: string }).toolCallId
      ).toBe('call-1')
      expect(execute).toHaveBeenCalledTimes(2)

      // The augmented passage is present and the baseline passage is retained.
      expect(
        result.structuredContent.sources.flatMap((source) =>
          source.chunks.map((chunk) => chunk.page_number)
        )
      ).toEqual([1, 2])
      const baselinePassages = baseline.sources.flatMap((source) =>
        source.chunks.map((chunk) => chunk.content)
      )
      const combinedPassages = result.structuredContent.sources.flatMap(
        (source) => source.chunks.map((chunk) => chunk.content)
      )
      expect(baselinePassages).not.toContain(
        'Covariance measures how holdings move together.'
      )
      expect(combinedPassages).toContain(
        'Covariance measures how holdings move together.'
      )
      expect(
        result.structuredContent.sources.map((source) => ({
          reference: source.reference,
          title: source.title,
        }))
      ).toEqual([
        {
          reference: 'synthetic-portfolio-lecture.pdf',
          title: 'Synthetic portfolio lecture',
        },
        {
          reference: 'synthetic-portfolio-lecture.pdf',
          title: 'Synthetic portfolio lecture',
        },
      ])
      expect(JSON.parse(result.content[0]?.text ?? '')).toEqual(
        result.structuredContent
      )

      // Citations keep both locators after the result is persisted and replayed.
      const persisted = JSON.parse(JSON.stringify(result))
      expect(
        normalizeSourcesFromParts([
          { type: 'tool-call', toolName: 'KB_doc_query', result: persisted },
        ]).map((source) => source.page)
      ).toEqual([1, 2])
    })

    it('retains document-only results when augmentation is disabled or fails', async () => {
      const disabledExecute = vi
        .fn()
        .mockResolvedValue(syntheticDocuments('Original evidence', 1))
      const disabledHints = vi.fn((query: string) =>
        readKnowledgeGraphSearchHints(context, query)
      )
      const disabledOriginal = syntheticDocuments('Original evidence', 1)
      expect(
        await graphAssistedDocumentQuery(disabledExecute, {
          validateScope: () =>
            Promise.resolve({ enabled: false, buildId: 'synthetic-build' }),
          hints: disabledHints,
        })({ query: ORIGINAL_QUERY }, {})
      ).toEqual(disabledOriginal)
      expect(disabledExecute).toHaveBeenCalledTimes(1)
      expect(disabledHints).not.toHaveBeenCalled()

      // A real reader against a graph that does not exist yields no hints, so the
      // original document result must survive unchanged.
      const missingExecute = vi.fn().mockResolvedValue(disabledOriginal)
      const missingContext = {
        ...context,
        graphName: `graphrag-chat-test-missing:${randomUUID()}`,
      }
      expect(
        await graphAssistedDocumentQuery(missingExecute, {
          validateScope: enabledScope,
          hints: (query) =>
            readKnowledgeGraphSearchHints(missingContext, query),
        })({ query: ORIGINAL_QUERY }, {})
      ).toEqual(disabledOriginal)
      expect(missingExecute).toHaveBeenCalledTimes(1)

      // A failed augmentation query falls back to the original result.
      const failingExecute = vi
        .fn()
        .mockResolvedValueOnce(disabledOriginal)
        .mockRejectedValueOnce(new Error('augmentation unavailable'))
      expect(
        await graphAssistedDocumentQuery(failingExecute, {
          validateScope: enabledScope,
          hints: (query) => readKnowledgeGraphSearchHints(context, query),
        })({ query: ORIGINAL_QUERY }, {})
      ).toEqual(disabledOriginal)
      expect(failingExecute).toHaveBeenCalledTimes(2)
    })
  }
)
