import { randomUUID } from 'node:crypto'
import { FalkorDB } from 'falkordb'
import { expect, it, vi } from 'vitest'
import {
  closeKnowledgeGraphClient,
  readKnowledgeGraphSearchHints,
} from '../src/client.js'

// Supply a disposable local FalkorDB explicitly; never inherit application credentials.
const port = process.env.GRAPH_RETRIEVAL_TEST_PORT
const host = process.env.GRAPH_RETRIEVAL_TEST_HOST ?? '127.0.0.1'

it.skipIf(!port)(
  'retrieves a connected concept from a real native graph',
  async () => {
    if (!['127.0.0.1', 'localhost', 'host.docker.internal'].includes(host)) {
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
    const client = await FalkorDB.connect({
      socket: { host, port: Number(port), connectTimeout: 2000 },
    })
    const graphName = `graphrag-test:${randomUUID()}`
    const graph = client.selectGraph(graphName)
    await closeKnowledgeGraphClient()
    vi.stubEnv('KB_FALKORDB_HOST', host)
    vi.stubEnv('KB_FALKORDB_PORT', port)
    vi.stubEnv('KB_FALKORDB_TLS', 'false')
    vi.stubEnv('KB_FALKORDB_USERNAME', '')
    vi.stubEnv('KB_FALKORDB_PASSWORD', '')
    let created = false
    try {
      await graph.query(`CREATE (a:Concept {name: 'Diversification'}),
      (b:Concept {name: 'Covariance'}), (c:Concept {name: 'Unrelated topic'}),
      (a)-[:RELATED {description: 'Diversification depends on covariance'}]->(b)`)
      created = true
      const context = {
        kbId: 'synthetic-kb',
        buildId: 'synthetic-build',
        graphName,
        isStale: false,
        sources: [],
      }
      expect(
        await readKnowledgeGraphSearchHints(context, 'Explain diversification')
      ).toEqual(['Covariance'])
      expect(
        await readKnowledgeGraphSearchHints(context, 'nonexistent')
      ).toEqual([])
      expect(
        await readKnowledgeGraphSearchHints(
          { ...context, isStale: true },
          'diversification'
        )
      ).toEqual([])
      expect(
        (
          await graph.roQuery<{ count: number }>(
            'MATCH (n) RETURN count(n) AS count'
          )
        ).data
      ).toEqual([{ count: 3 }])
    } finally {
      await closeKnowledgeGraphClient()
      vi.unstubAllEnvs()
      try {
        if (created) await graph.delete()
      } finally {
        await client.close()
      }
    }
  },
  10000
)
