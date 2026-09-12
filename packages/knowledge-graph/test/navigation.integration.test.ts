import { randomUUID } from 'node:crypto'
import { FalkorDB } from 'falkordb'
import { expect, it, vi } from 'vitest'
import {
  closeKnowledgeGraphClient,
  readKnowledgeGraphNeighbors,
  readKnowledgeGraphOverview,
  searchKnowledgeGraph,
} from '../src/client.js'

const port = process.env.GRAPH_RETRIEVAL_TEST_PORT
const host = process.env.GRAPH_RETRIEVAL_TEST_HOST ?? '127.0.0.1'

it.skipIf(!port)(
  'bounds navigation over a native high-degree graph',
  async () => {
    if (
      !['127.0.0.1', 'localhost', 'host.docker.internal'].includes(host) ||
      !port ||
      !/^\d+$/.test(port) ||
      Number(port) < 1 ||
      Number(port) > 65535
    )
      throw new Error('An explicit disposable local FalkorDB is required')
    const client = await FalkorDB.connect({
      socket: { host, port: Number(port), connectTimeout: 2000 },
    })
    const graphName = `navigation-test:${randomUUID()}`
    const graph = client.selectGraph(graphName)
    await closeKnowledgeGraphClient()
    vi.stubEnv('KB_FALKORDB_HOST', host)
    vi.stubEnv('KB_FALKORDB_PORT', port)
    vi.stubEnv('KB_FALKORDB_TLS', 'false')
    vi.stubEnv('KB_FALKORDB_USERNAME', '')
    vi.stubEnv('KB_FALKORDB_PASSWORD', '')
    let created = false
    try {
      await graph.query("CREATE (:Concept {name: 'Hub'})")
      created = true
      await graph.query(`MATCH (hub) UNWIND range(1, 5000) AS i
      CREATE (n:Concept {name: 'Topic ' + toString(i)})
      CREATE (hub)-[:RELATED]->(n)`)
      const context = {
        kbId: 'synthetic',
        buildId: 'synthetic',
        graphName,
        isStale: false,
        sources: [],
      }
      const started = performance.now()
      const overview = await readKnowledgeGraphOverview(context)
      expect(overview.nodes).toHaveLength(250)
      expect(overview.edges.length).toBeLessThanOrEqual(500)
      expect(overview.truncated).toBe(true)
      const hub = (await searchKnowledgeGraph(context, 'Hub')).nodes[0]!
      expect(hub.degree).toBe(5000)
      const neighbors = await readKnowledgeGraphNeighbors(context, hub.id)
      expect(neighbors.nodes).toHaveLength(100)
      expect(neighbors.truncated).toBe(true)
      const admitted = new Set([
        hub.id,
        ...neighbors.nodes.map((node) => node.id),
      ])
      expect(neighbors.edges.length).toBeGreaterThan(0)
      expect(neighbors.edges.length).toBeLessThanOrEqual(200)
      expect(
        neighbors.edges.every(
          (edge) => admitted.has(edge.source) && admitted.has(edge.target)
        )
      ).toBe(true)
      expect((await searchKnowledgeGraph(context, 'Topic')).nodes).toHaveLength(
        20
      )
      expect(
        (await searchKnowledgeGraph(context, 'missing-concept')).nodes
      ).toEqual([])
      expect(
        (await searchKnowledgeGraph(context, "' OR 1=1 //")).nodes
      ).toEqual([])
      // The assertion detects a stalled native read, not a production latency SLA.
      expect(performance.now() - started).toBeLessThan(8000)
      await expect(
        graph.roQuery('MATCH (a), (b), (c) RETURN count(*)', { TIMEOUT: 1 })
      ).rejects.toThrow()
      expect((await searchKnowledgeGraph(context, 'Hub')).nodes).toHaveLength(1)
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
  15000
)
