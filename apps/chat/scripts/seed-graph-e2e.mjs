import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { prisma, requireDisposableDatabase } from '@klicker-uzh/prisma'

// This fixture is deliberately separate from the application and general seed.
// It publishes only synthetic concepts to the seeded Benibot's disposable KB.
const host = process.env.GRAPH_RETRIEVAL_TEST_HOST ?? '127.0.0.1'
const port = Number(process.env.GRAPH_RETRIEVAL_TEST_PORT)
if (
  !['127.0.0.1', 'localhost', 'host.docker.internal'].includes(host) ||
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535
) {
  throw new Error('Supply an explicit disposable local FalkorDB host and port')
}
const require = createRequire(import.meta.url)
const graphRequire = createRequire(
  require.resolve('@klicker-uzh/knowledge-graph')
)
const { FalkorDB } = graphRequire('falkordb')
// GRAPH_CHATBOT_ID targets another seeded chatbot, such as the isolated
// chatbot of the `mcp` profile.
const chatbotId =
  process.env.GRAPH_CHATBOT_ID ?? '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
// GRAPH_FIXTURE=kg-relations-v1 publishes the synthetic typed-relation rows
// from the generator contract fixture instead of the three-concept graph.
const relationFixture = process.env.GRAPH_FIXTURE === 'kg-relations-v1'
if (process.env.GRAPH_FIXTURE !== undefined && !relationFixture)
  throw new Error('Unknown GRAPH_FIXTURE')
const buildId = relationFixture
  ? 'ce800000-0000-4000-8000-000000000002'
  : 'ce800000-0000-4000-8000-000000000001'

// The fixture cites placeholder resources res-1 and res-2. Evidence resolves
// only to sources recorded on the published build, so both are recorded as
// synthetic build sources.
const relationFixtureSources = [
  {
    placeholder: 'res-1',
    resourceId: 'ce800000-0000-4000-8000-0000000000a1',
    title: 'Synthetic counting slides',
  },
  {
    placeholder: 'res-2',
    resourceId: 'ce800000-0000-4000-8000-0000000000a2',
    title: 'Synthetic counting notes',
  },
]

async function publishRelationFixture(graph) {
  const fixture = JSON.parse(
    readFileSync(
      new URL(
        '../../../packages/knowledge-graph/test/fixtures/kgRelationsV1.json',
        import.meta.url
      ),
      'utf8'
    )
  )
  const resourceIds = Object.fromEntries(
    relationFixtureSources.map((source) => [
      source.placeholder,
      source.resourceId,
    ])
  )
  const withResources = (properties) =>
    typeof properties.internal_evidence_refs === 'string'
      ? {
          ...properties,
          internal_evidence_refs: properties.internal_evidence_refs.replace(
            /res-[12]/g,
            (placeholder) => resourceIds[placeholder]
          ),
        }
      : properties
  for (const node of fixture.nodes) {
    const label = node.labels[0]
    if (!/^[A-Za-z]+$/.test(label)) throw new Error('Unexpected fixture label')
    await graph.query(`CREATE (n:${label}) SET n = $properties`, {
      params: { properties: withResources(node.properties) },
    })
  }
  for (const edge of fixture.edges) {
    await graph.query(
      `MATCH (source {kg_node_id: $source}), (target {kg_node_id: $target})
       CREATE (source)-[r:RELATED]->(target) SET r = $properties`,
      {
        params: {
          source: edge.source,
          target: edge.target,
          properties: withResources(edge.properties),
        },
      }
    )
  }
}
let client
try {
  await requireDisposableDatabase(prisma)
  const bindings = await prisma.kBChatbot.findMany({
    where: { chatbotId, isEnabled: true },
    select: { kbId: true },
  })
  if (bindings.length !== 1)
    throw new Error('Seeded chatbot must have exactly one KB')
  const kbId = bindings[0].kbId
  const resources = await prisma.kBResource.findMany({
    where: { kbId, deletedAt: null, activeContentSha256: { not: null } },
    select: { id: true, activeContentSha256: true },
    orderBy: { id: 'asc' },
  })
  const digest = createHash('sha256')
  for (const resource of resources) {
    digest.update(`${resource.id}:${resource.activeContentSha256}\n`)
  }
  const graphName = `klickeruzh:kb:${kbId}:${buildId}`
  if (process.env.DRY_RUN !== 'false') {
    console.log(
      relationFixture
        ? 'Dry run: publish synthetic typed-relation graph to seeded chatbot KB'
        : 'Dry run: publish synthetic three-concept graph to seeded chatbot KB'
    )
  } else {
    client = await FalkorDB.connect({
      socket: { host, port, connectTimeout: 2000 },
    })
    const graph = client.selectGraph(graphName)
    if (relationFixture) {
      await graph.delete().catch(() => undefined)
      await publishRelationFixture(graph)
    } else {
      await graph.query(`
      MERGE (a:Concept {name: 'Diversification'})
      MERGE (b:Concept {name: 'Covariance'})
      MERGE (c:Concept {name: 'Portfolio risk'})
      MERGE (a)-[:RELATED]->(b)
      MERGE (b)-[:RELATED]->(c)
    `)
    }
    const data = {
      kbId,
      graphName,
      sourceContentDigest: digest.digest('hex'),
      status: 'SUCCEEDED',
    }
    await prisma.kBGraphBuild.upsert({
      where: { id: buildId },
      create: { id: buildId, ...data },
      update: data,
    })
    for (const source of relationFixture ? relationFixtureSources : []) {
      await prisma.kBGraphBuildSource.upsert({
        where: {
          buildId_resourceId: { buildId, resourceId: source.resourceId },
        },
        create: {
          buildId,
          resourceId: source.resourceId,
          title: source.title,
          type: 'BLOB',
          contentSha256: createHash('sha256')
            .update(source.resourceId)
            .digest('hex'),
        },
        update: {},
      })
    }
    await prisma.kB.update({
      where: { id: kbId },
      data: { knowledgeGraphEnabled: true, publishedGraphBuildId: buildId },
    })
    console.log('Synthetic graph published for native browser E2E')
  }
} finally {
  await client?.close()
  await prisma.$disconnect()
}
