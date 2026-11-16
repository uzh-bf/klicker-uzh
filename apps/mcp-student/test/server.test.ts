import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import type { StudentMcpSession } from '../src/auth.js'
import { getStudentCapabilities } from '../src/capabilities.js'
import { createStudentMcpServer } from '../src/server.js'
import type { StudentPracticeService } from '../src/service.js'
import { STUDENT_MCP_TOOL_NAMES } from '../src/toolPolicy.js'

type JsonSchemaProperty = {
  default?: unknown
  maximum?: number
  minimum?: number
}

type McpTool = {
  inputSchema: {
    properties?: Record<string, JsonSchemaProperty>
    required?: string[]
  }
  name: string
}

type McpClient = {
  callTool(params: {
    arguments: Record<string, unknown>
    name: string
  }): Promise<unknown>
  close(): Promise<void>
  connect(transport: unknown): Promise<void>
  listTools(): Promise<{ tools: McpTool[] }>
}

type ServerTransport = Parameters<
  ReturnType<typeof createStudentMcpServer>['connect']
>[0]

type McpSdk = {
  Client: new (clientInfo: { name: string; version: string }) => McpClient
  InMemoryTransport: {
    createLinkedPair(): [ServerTransport, ServerTransport]
  }
}

async function loadMcpSdk(): Promise<McpSdk> {
  const appRequire = createRequire(import.meta.url)
  const fastmcpRequire = createRequire(appRequire.resolve('fastmcp'))
  const load = (specifier: string) =>
    import(
      /* @vite-ignore */ pathToFileURL(fastmcpRequire.resolve(specifier)).href
    )

  const [clientModule, transportModule] = await Promise.all([
    load('@modelcontextprotocol/sdk/client/index.js'),
    load('@modelcontextprotocol/sdk/inMemory.js'),
  ])

  return {
    Client: clientModule.Client as McpSdk['Client'],
    InMemoryTransport:
      transportModule.InMemoryTransport as McpSdk['InMemoryTransport'],
  }
}

async function connectClient(
  server: ReturnType<typeof createStudentMcpServer>,
  session: StudentMcpSession
): Promise<McpClient> {
  const { Client, InMemoryTransport } = await loadMcpSdk()
  const client = new Client({
    name: 'synthetic-student-test',
    version: '0.0.0',
  })
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair()

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport, session),
  ])
  return client
}

function findTool(tools: McpTool[], name: string): McpTool {
  const tool = tools.find((candidate) => candidate.name === name)
  if (!tool) throw new Error(`FastMCP did not register ${name}`)
  return tool
}

describe('student MCP capabilities', () => {
  it('advertises service metadata and policy summaries for every tool', () => {
    const capabilities = getStudentCapabilities({ mcpEndpoint: '/mcp' })

    expect(capabilities).toMatchObject({
      service: 'mcp-student',
      version: '0.1.0',
      transport: 'httpStream',
      endpoint: '/mcp',
      autonomousWrites: false,
      proposalRequiredForWrites: false,
      humanConfirmationRequiredForWrites: true,
    })
    expect(capabilities.tools.map((tool) => tool.name)).toEqual(
      STUDENT_MCP_TOOL_NAMES
    )

    expect(
      capabilities.tools.find(
        (tool) => tool.name === 'klicker_student_capabilities'
      )
    ).toMatchObject({
      annotations: { readOnlyHint: true },
      category: 'meta',
      rbacScope: ['student:practice:read'],
      requiresHumanConfirmation: false,
      solutionExposure: 'none',
    })
    expect(
      capabilities.tools.find(
        (tool) => tool.name === 'submit_practice_stack_answer'
      )
    ).toMatchObject({
      annotations: { readOnlyHint: false },
      category: 'practice-write',
      rbacScope: ['student:practice:submit'],
      requiresHumanConfirmation: true,
      solutionExposure: 'submission-gated',
    })
  })

  it('registers argument schemas and rejects invalid calls before dispatch', async () => {
    const lookupRelevantPracticeStacks = vi.fn(async () => ({ candidates: [] }))
    const server = createStudentMcpServer(
      {
        apiGraphqlEndpoint: 'http://synthetic.invalid/graphql',
        host: '127.0.0.1',
        jwtIssuer: 'synthetic-test-issuer',
        jwtSecret: 'synthetic-test-secret',
        mcpEndpoint: '/mcp',
        port: 7080,
        questionRefSecret: 'synthetic-question-ref-secret',
        questionRefTtlSeconds: 1200,
      },
      { lookupRelevantPracticeStacks } as unknown as StudentPracticeService
    )
    const session: StudentMcpSession = {
      actor: 'account',
      bearerToken: 'synthetic-test-token',
      participantId: 'synthetic-participant',
      scopes: ['student:practice:read', 'student:practice:submit'],
    }
    const client = await connectClient(server, session)

    try {
      const { tools } = await client.listTools()
      expect(tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining([
          'lookup_relevant_practice_stacks',
          'submit_practice_stack_answer',
        ])
      )

      const lookup = findTool(tools, 'lookup_relevant_practice_stacks')
      expect(lookup.inputSchema.required).toEqual(
        expect.arrayContaining(['chatbotId', 'courseId', 'lastUserMessage'])
      )
      expect(lookup.inputSchema.properties?.limit).toMatchObject({
        default: 3,
        maximum: 5,
        minimum: 1,
      })

      const validArguments = {
        chatbotId: 'synthetic-chatbot',
        courseId: 'synthetic-course',
        lastUserMessage: 'synthetic question',
      }
      await client.callTool({
        arguments: validArguments,
        name: 'lookup_relevant_practice_stacks',
      })
      expect(lookupRelevantPracticeStacks).toHaveBeenCalledWith(
        { ...validArguments, limit: 3 },
        expect.objectContaining({ participantId: 'synthetic-participant' })
      )

      for (const limit of [0, 6]) {
        await expect(
          client.callTool({
            arguments: { ...validArguments, limit },
            name: 'lookup_relevant_practice_stacks',
          })
        ).rejects.toMatchObject({ code: -32602 })
      }
      await expect(
        client.callTool({
          arguments: {
            courseId: validArguments.courseId,
            lastUserMessage: validArguments.lastUserMessage,
          },
          name: 'lookup_relevant_practice_stacks',
        })
      ).rejects.toMatchObject({ code: -32602 })
      expect(lookupRelevantPracticeStacks).toHaveBeenCalledTimes(1)
    } finally {
      await client.close()
      await server.stop()
    }
  })
})
