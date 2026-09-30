import { createHash } from 'node:crypto'
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
const chatbotId = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const buildId = 'ce800000-0000-4000-8000-000000000001'
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
      'Dry run: publish synthetic three-concept graph to seeded chatbot KB'
    )
  } else {
    client = await FalkorDB.connect({
      socket: { host, port, connectTimeout: 2000 },
    })
    await client.selectGraph(graphName).query(`
      MERGE (a:Concept {name: 'Diversification'})
      MERGE (b:Concept {name: 'Covariance'})
      MERGE (c:Concept {name: 'Portfolio risk'})
      MERGE (a)-[:RELATED]->(b)
      MERGE (b)-[:RELATED]->(c)
    `)
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
