import { lookup } from 'node:dns/promises'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { isPrivateAddress, privateMcpEndpoint } from './runtime.mjs'

function origin(value, domain) {
  const url = new URL(value)
  if (
    url.protocol !== 'https:' ||
    !url.hostname.endsWith(`.${domain}`) ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('Preview fixture origin is invalid')
  }
  return url.origin
}

export async function fixtureConfiguration(env, resolve = lookup) {
  if (
    env.KLICKER_PREVIEW_DISPOSABLE !== '1' ||
    !/^[a-f0-9]{24}$/.test(env.KLICKER_PREVIEW_GENERATION ?? '') ||
    !/^[a-f0-9]{64}$/.test(env.LOCAL_MCP_TRANSPORT_TOKEN ?? '') ||
    !/^[a-f0-9]{64}$/.test(env.BLOB_STORAGE_ACCESS_KEY ?? '') ||
    env.BLOB_STORAGE_ACCOUNT_NAME !== 'klickerdev' ||
    !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(env.KLICKER_PREVIEW_DOMAIN ?? '')
  ) {
    throw new Error('Preview fixture configuration is incomplete')
  }
  const endpoint = await privateMcpEndpoint(env, resolve)
  const blob = new URL(env.BLOB_STORAGE_INTERNAL_ACCOUNT_URL)
  if (
    blob.protocol !== 'http:' ||
    blob.hostname !== env.KLICKER_PREVIEW_BLOB_HOST ||
    blob.port !== '10000' ||
    blob.pathname !== '/klickerdev' ||
    blob.username ||
    blob.password ||
    blob.search ||
    blob.hash
  ) {
    throw new Error('Preview fixture Blob endpoint does not match its service')
  }
  const origins = [
    env.KLICKER_PREVIEW_MANAGE_ORIGIN,
    env.KLICKER_PREVIEW_PWA_ORIGIN,
    env.KLICKER_PREVIEW_CHAT_ORIGIN,
  ]
    .filter(Boolean)
    .map((value) => origin(value, env.KLICKER_PREVIEW_DOMAIN))
  if (origins.length === 0) {
    throw new Error('Preview fixture browser origins are missing')
  }
  return {
    endpoint,
    blob,
    origins: [...new Set(origins)],
    generation: env.KLICKER_PREVIEW_GENERATION,
  }
}

export async function bindFixtureEndpoint(db, configuration, contract) {
  return db.$transaction(
    async (tx) => {
      const chatbot = await tx.chatbot.findUnique({
        where: { id: contract.chatbotId },
      })
      const course = await tx.course.findUnique({
        where: { id: contract.courseId },
      })
      const server = await tx.chatbotMCPServer.findUnique({
        where: { name: 'KB' },
      })
      const kb = await tx.kB.findUnique({ where: { id: contract.kbId } })
      if (
        chatbot?.ownerId !== contract.ownerId ||
        chatbot.courseId !== contract.courseId ||
        course?.ownerId !== contract.ownerId ||
        !server ||
        !server.isActive ||
        server.passChatbotId ||
        server.chatbotIdHeader
      )
        throw new Error('Preview fixture ownership does not match')
      const configurations = await tx.chatbotMCPConfig.findMany({
        where: { mcpServerId: server.id },
      })
      if (configurations.some((row) => row.chatbotId !== contract.chatbotId)) {
        throw new Error('Preview fixture server has another consumer')
      }
      const firstBinding =
        server.url === contract.legacyUrl &&
        server.authType === 'scope_token' &&
        server.authSecret === null &&
        isDeepStrictEqual(server.parameters, {})
      const scope = {
        required: true,
        toolAlias: 'doc_query',
        kb_ids: [contract.kbId],
      }
      if (
        configurations.some(
          (row) =>
            !['tutor', 'explainer'].includes(row.chatMode) ||
            row.priority !== 0 ||
            !isDeepStrictEqual(row.allowedTools, ['doc_query']) ||
            row.isEnabled !== true ||
            !isDeepStrictEqual(row.parameters, scope)
        )
      )
        throw new Error('Preview fixture configuration is not owned')
      if (kb?.ownerId !== contract.ownerId || kb.deletedAt !== null) {
        throw new Error('Preview fixture knowledge base is not owned')
      }
      if (!firstBinding) {
        const previous = new URL(server.url)
        if (
          previous.protocol !== 'http:' ||
          !isPrivateAddress(previous.hostname) ||
          previous.port !== '1417' ||
          previous.pathname !== '/mcp' ||
          previous.username ||
          previous.password ||
          previous.search ||
          previous.hash ||
          server.authType !== 'bearer' ||
          !isDeepStrictEqual(server.parameters, {
            previewFixture: true,
            previewGeneration: configuration.generation,
          }) ||
          !contract.tokenMatches(server.authSecret)
        )
          throw new Error(
            'Preview fixture binding does not match this generation'
          )
      }
      const external = await tx.chatbotMCPConfig.findMany({
        where: {
          chatbotId: contract.chatbotId,
          mcpServerId: { not: server.id },
        },
        include: { mcpServer: true },
      })
      if (
        external.some(
          (row) =>
            row.chatMode !== 'tutor' ||
            row.priority !== 10 ||
            !isDeepStrictEqual(row.parameters, {}) ||
            !isDeepStrictEqual(row.allowedTools, [
              'resolve-library-id',
              'get-library-docs',
            ]) ||
            row.mcpServer.name !== 'Context7' ||
            row.mcpServer.url !== 'https://mcp.context7.com/mcp' ||
            row.mcpServer.authSecret !== null
        )
      )
        throw new Error('Preview fixture has an unexpected external tool')
      const key = { kbId: contract.kbId, chatbotId: contract.chatbotId }
      const binding = await tx.kBChatbot.findUnique({
        where: { kbId_chatbotId: key },
      })
      if (!binding?.isEnabled)
        throw new Error('Preview fixture knowledge base is not bound')
      await tx.chatbotMCPServer.update({
        where: { id: server.id },
        data: {
          url: configuration.endpoint.href,
          authType: 'bearer',
          ...(firstBinding ? { authSecret: contract.encryptToken() } : {}),
          parameters: {
            previewFixture: true,
            previewGeneration: configuration.generation,
          },
        },
      })
      for (const chatMode of ['tutor', 'explainer']) {
        await tx.chatbotMCPConfig.upsert({
          where: {
            chatbotId_mcpServerId_chatMode: {
              chatbotId: contract.chatbotId,
              mcpServerId: server.id,
              chatMode,
            },
          },
          create: {
            chatbotId: contract.chatbotId,
            mcpServerId: server.id,
            chatMode,
            allowedTools: ['doc_query'],
            priority: 0,
            isEnabled: true,
            parameters: scope,
          },
          update: {
            allowedTools: ['doc_query'],
            priority: 0,
            isEnabled: true,
            parameters: scope,
          },
        })
      }
      for (const row of external) {
        await tx.chatbotMCPConfig.update({
          where: { id: row.id },
          data: { isEnabled: false },
        })
      }
    },
    { isolationLevel: 'Serializable', timeout: 10000 }
  )
}

async function main() {
  if (process.argv.length !== 2) {
    throw new Error('Unexpected fixture configuration arguments')
  }
  const env = process.env
  const configuration = await fixtureConfiguration(env)
  const chatRequire = createRequire(
    new URL('../../apps/chat/package.json', import.meta.url)
  )
  const graphqlRequire = createRequire(
    new URL('../../packages/graphql/package.json', import.meta.url)
  )
  const { createDisposableTestPrismaClient } = await import(
    pathToFileURL(chatRequire.resolve('@klicker-uzh/prisma')).href
  )
  const { loadLocalMcpFixture } = await import(
    '../../apps/chat/scripts/local-mcp-fixture.mjs'
  )
  const fixture = loadLocalMcpFixture({
    LOCAL_MCP_FIXTURE_FILE: fileURLToPath(
      new URL('./mcp-fixture.json', import.meta.url)
    ),
  })
  const { USER_ID_TEST, COURSE_ID_TEST } = await import(
    '../../packages/prisma-data/src/data/constants.js'
  )
  const { encrypt, decrypt } = await import(
    pathToFileURL(chatRequire.resolve('@klicker-uzh/util')).href
  )
  const { BlobServiceClient, StorageSharedKeyCredential } = graphqlRequire(
    '@azure/storage-blob'
  )
  process.env.PRISMA_LOG_LEVELS = 'none'
  const db = await createDisposableTestPrismaClient(env.DATABASE_URL)
  try {
    await bindFixtureEndpoint(db, configuration, {
      chatbotId: fixture.chatbotId,
      kbId: fixture.kbId,
      ownerId: USER_ID_TEST,
      courseId: COURSE_ID_TEST,
      legacyUrl: 'http://localhost:1417/mcp',
      encryptToken: () => encrypt(env.LOCAL_MCP_TRANSPORT_TOKEN),
      tokenMatches: (value) => decrypt(value) === env.LOCAL_MCP_TRANSPORT_TOKEN,
    })
    const blob = new BlobServiceClient(
      configuration.blob.href,
      new StorageSharedKeyCredential('klickerdev', env.BLOB_STORAGE_ACCESS_KEY)
    )
    await blob.setProperties({
      cors: [
        {
          allowedOrigins: configuration.origins.join(','),
          allowedMethods: 'DELETE,GET,HEAD,OPTIONS,PUT',
          allowedHeaders: '*',
          exposedHeaders: 'x-ms-*',
          maxAgeInSeconds: 3600,
        },
      ],
    })
    for (const container of ['avatars', 'images', 'files']) {
      await blob.getContainerClient(container).createIfNotExists()
    }
    console.info('Preview fixture bindings configured')
  } finally {
    await db.$disconnect()
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch(() => {
    console.error('Preview fixture binding configuration failed')
    process.exitCode = 1
  })
}
