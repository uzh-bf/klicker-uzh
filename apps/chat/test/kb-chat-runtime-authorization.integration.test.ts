import { randomUUID } from 'node:crypto'
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { PermissionLevel } from '@klicker-uzh/prisma/client'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { exportPKCS8, generateKeyPair, jwtVerify, type KeyLike } from 'jose'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import { z } from 'zod'
import {
  getAggregatedMCPTools,
  type MCPServerWithConfig,
  type MCPToolsHandle,
} from '../src/services/mcpClients'

const describePostgres =
  process.env.CHAT_KB_RUNTIME_AUTH_INTEGRATION === '1'
    ? describe
    : describe.skip

const BOT_OWNER_ID = randomUUID()
const KB_OWNER_ID = randomUUID()
const COURSE_ID = randomUUID()
const CHATBOT_ID = randomUUID()
const KB_ID = randomUUID()
const TEST_KEY = `kb-runtime-auth-${BOT_OWNER_ID.slice(0, 8)}`
const TEST_ISSUER = 'https://chat.klicker.test'
const TEST_AUDIENCE = 'klicker-doc-query-test'
const TEST_KID = 'test-key-2026-08'
const TRANSPORT_TOKEN = 'synthetic-transport-token'

let prisma: PrismaClient
let publicKey: KeyLike
let server: ReturnType<typeof createServer> | undefined
let serverUrl = ''
let groupId: number
let permissionId: number
let outboundRequests = 0
let providerToolCalls = 0

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    request.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8')
        resolve(body.length > 0 ? JSON.parse(body) : undefined)
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

function createSyntheticDocQueryServer(): McpServer {
  const mcpServer = new McpServer({
    name: 'synthetic-kb-runtime-auth',
    version: '1.0.0',
  })
  mcpServer.tool('doc_query', { query: z.string() }, async ({ query }) => {
    providerToolCalls += 1
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            mode: 'documents',
            query,
            sources: [],
          }),
        },
      ],
    }
  })
  return mcpServer
}

function listen(httpServer: ReturnType<typeof createServer>): Promise<string> {
  return new Promise((resolve) => {
    httpServer.listen(0, '127.0.0.1', () => {
      const address = httpServer.address()
      if (!address || typeof address === 'string') {
        throw new Error('Synthetic MCP server did not bind')
      }
      resolve(`http://127.0.0.1:${address.port}/mcp`)
    })
  })
}

function closeServer(
  httpServer: ReturnType<typeof createServer>
): Promise<void> {
  httpServer.closeAllConnections()
  return new Promise((resolve, reject) => {
    httpServer.close((error) => (error ? reject(error) : resolve()))
  })
}

async function authorizeTransport(request: IncomingMessage): Promise<boolean> {
  if (request.headers.authorization !== `Bearer ${TRANSPORT_TOKEN}`) {
    return false
  }
  const rawToken = request.headers['x-doc-query-scope-token']
  const tokenHeader = Array.isArray(rawToken) ? rawToken[0] : rawToken
  if (!tokenHeader?.startsWith('Bearer ')) return false

  try {
    await jwtVerify(tokenHeader.slice('Bearer '.length), publicKey, {
      algorithms: ['ES256'],
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE,
    })
    return true
  } catch {
    return false
  }
}

function kbServer(): MCPServerWithConfig {
  return {
    server: {
      id: randomUUID(),
      name: 'KB',
      url: serverUrl,
      authType: 'bearer',
      authSecret: TRANSPORT_TOKEN,
      isActive: true,
    },
    config: {
      allowedTools: ['doc_query'],
      priority: 0,
      parameters: {
        required: true,
        toolAlias: 'doc_query',
        kb_id: KB_ID,
      },
    },
  }
}

async function cleanup() {
  const { requireDisposableDatabase } = await import('@klicker-uzh/prisma')
  await requireDisposableDatabase(prisma)
  await prisma.derivedPermission.deleteMany({ where: { kbId: KB_ID } })
  await prisma.permission.deleteMany({ where: { kbId: KB_ID } })
  await prisma.kBChatbot.deleteMany({ where: { chatbotId: CHATBOT_ID } })
  await prisma.chatbot.deleteMany({ where: { id: CHATBOT_ID } })
  await prisma.course.deleteMany({ where: { id: COURSE_ID } })
  await prisma.kB.deleteMany({ where: { id: KB_ID } })
  await prisma.userGroup.deleteMany({ where: { ownerId: KB_OWNER_ID } })
  await prisma.user.deleteMany({
    where: { id: { in: [BOT_OWNER_ID, KB_OWNER_ID] } },
  })
}

async function grantReadThroughGroup() {
  await prisma.derivedPermission.deleteMany({
    where: { kbId: KB_ID, userId: BOT_OWNER_ID },
  })
  await prisma.permission.deleteMany({ where: { kbId: KB_ID } })
  await prisma.userGroup.deleteMany({ where: { ownerId: KB_OWNER_ID } })

  const group = await prisma.userGroup.create({
    data: {
      name: TEST_KEY,
      ownerId: KB_OWNER_ID,
      members: { connect: { id: BOT_OWNER_ID } },
    },
  })
  groupId = group.id
  const permission = await prisma.permission.create({
    data: {
      permissionLevel: PermissionLevel.READ,
      kbId: KB_ID,
      userGroupId: groupId,
    },
  })
  permissionId = permission.id

  // Represents a lagging projection. The runtime must decide from the live
  // group grant or membership rather than this retained row.
  await prisma.derivedPermission.create({
    data: {
      permissionLevel: PermissionLevel.READ,
      kbId: KB_ID,
      userId: BOT_OWNER_ID,
    },
  })
}

describePostgres(
  'Chat KB owner-preview runtime authorization over retained handles',
  () => {
    beforeAll(async () => {
      ;({ prisma } = await import('@klicker-uzh/prisma'))
      await cleanup()

      const keyPair = await generateKeyPair('ES256')
      publicKey = keyPair.publicKey
      vi.stubEnv(
        'DOC_QUERY_SCOPE_PRIVATE_KEY',
        await exportPKCS8(keyPair.privateKey)
      )
      vi.stubEnv('DOC_QUERY_SCOPE_KID', TEST_KID)
      vi.stubEnv('DOC_QUERY_SCOPE_ISSUER', TEST_ISSUER)
      vi.stubEnv('DOC_QUERY_SCOPE_AUDIENCE', TEST_AUDIENCE)

      vi.stubEnv('DOC_QUERY_SCOPED_MCP_SERVER_ID', '')
      vi.stubEnv('DOC_QUERY_SCOPED_MCP_LEGACY_URL', '')
      vi.stubEnv('DOC_QUERY_SCOPED_MCP_URL', '')

      server = createServer(
        async (request: IncomingMessage, response: ServerResponse) => {
          if (request.method !== 'POST') {
            response.writeHead(405).end()
            return
          }

          if (!(await authorizeTransport(request))) {
            response.writeHead(401).end()
            return
          }

          const body = await readJsonBody(request)
          outboundRequests += 1

          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
          })
          const mcpServer = createSyntheticDocQueryServer()
          response.on('close', () => {
            void transport.close()
            void mcpServer.close()
          })
          await mcpServer.connect(transport)
          await transport.handleRequest(request, response, body)
        }
      )
      serverUrl = await listen(server)

      await prisma.user.createMany({
        data: [
          {
            id: BOT_OWNER_ID,
            email: `${TEST_KEY}-bot@example.invalid`,
            shortname: `${TEST_KEY}-bot`,
          },
          {
            id: KB_OWNER_ID,
            email: `${TEST_KEY}-kb@example.invalid`,
            shortname: `${TEST_KEY}-kb`,
          },
        ],
      })
      await prisma.course.create({
        data: {
          id: COURSE_ID,
          name: TEST_KEY,
          displayName: 'Synthetic KB runtime authorization course',
          authType: 'SSO',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2027-01-01T00:00:00.000Z'),
          groupDeadlineDate: new Date('2026-12-01T00:00:00.000Z'),
          ownerId: BOT_OWNER_ID,
        },
      })
      await prisma.chatbot.create({
        data: {
          id: CHATBOT_ID,
          name: 'Synthetic KB runtime authorization chatbot',
          ownerId: BOT_OWNER_ID,
          courseId: COURSE_ID,
        },
      })
      await prisma.kB.create({
        data: {
          id: KB_ID,
          name: 'Synthetic cross-owner runtime KB',
          ownerId: KB_OWNER_ID,
        },
      })
      await prisma.kBChatbot.create({
        data: { kbId: KB_ID, chatbotId: CHATBOT_ID, isEnabled: true },
      })
    }, 60_000)

    beforeEach(async () => {
      await grantReadThroughGroup()
    }, 60_000)

    afterAll(async () => {
      vi.unstubAllEnvs()
      try {
        if (prisma) await cleanup()
      } finally {
        if (server) await closeServer(server)
        if (prisma) await prisma.$disconnect()
      }
    }, 60_000)

    test.each([
      {
        label: 'removing the member while retaining the Permission row',
        mode: 'membership' as const,
      },
      {
        label: 'deleting the Permission row while retaining the member',
        mode: 'permission' as const,
      },
    ])('$label closes an owner-preview handle before outbound', async ({
      mode,
    }) => {
      providerToolCalls = 0
      outboundRequests = 0
      let handle: MCPToolsHandle | undefined
      try {
        // This suite deliberately exercises owner preview. Participant
        // publication and enrollment are covered by the route-level suites.
        handle = await getAggregatedMCPTools([kbServer()], {
          chatbotId: CHATBOT_ID,
          ownerPreviewUserId: BOT_OWNER_ID,
          authMode: 'account',
          kbIds: [KB_ID],
          sessionId: 'existing-synthetic-thread',
        })
        const tool = handle.tools.KB_doc_query as {
          execute: (input: { query: string }) => Promise<unknown>
        }

        await expect(
          tool.execute({ query: 'first authorized request' })
        ).resolves.toBeTruthy()
        const requestsBeforeRevoke = outboundRequests
        expect(providerToolCalls).toBe(1)

        if (mode === 'membership') {
          await prisma.userGroup.update({
            where: { id: groupId },
            data: { members: { disconnect: { id: BOT_OWNER_ID } } },
          })
          const permission = await prisma.permission.findUniqueOrThrow({
            where: { id: permissionId },
          })
          expect(permission.permissionLevel).toBe(PermissionLevel.READ)
        } else {
          await prisma.permission.delete({ where: { id: permissionId } })
          const group = await prisma.userGroup.findUniqueOrThrow({
            where: { id: groupId },
            include: { members: { select: { id: true } } },
          })
          expect(group.members.map(({ id }) => id)).toContain(BOT_OWNER_ID)
        }

        await expect(
          prisma.derivedPermission.findUniqueOrThrow({
            where: { kbId_userId: { kbId: KB_ID, userId: BOT_OWNER_ID } },
          })
        ).resolves.toMatchObject({ permissionLevel: PermissionLevel.READ })

        await expect(
          tool.execute({ query: 'second request after revocation' })
        ).rejects.toMatchObject({ reason: 'scope_violation' })

        expect(providerToolCalls).toBe(1)
        expect(outboundRequests).toBe(requestsBeforeRevoke)
      } finally {
        await handle?.close()
      }
    })
  }
)
