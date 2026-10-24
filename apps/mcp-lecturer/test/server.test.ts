import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import type { LecturerMcpSession } from '../src/auth.js'
import { getLecturerCapabilities } from '../src/capabilities.js'
import { createLecturerMcpServer } from '../src/server.js'
import type { LecturerReadService } from '../src/service.js'
import { LECTURER_MCP_TOOL_NAMES } from '../src/toolPolicy.js'

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
  ReturnType<typeof createLecturerMcpServer>['connect']
>[0]

type McpSdk = {
  Client: new (clientInfo: { name: string; version: string }) => McpClient
  InMemoryTransport: {
    createLinkedPair(): [ServerTransport, ServerTransport]
  }
}

let mcpSdk: Promise<McpSdk> | undefined

function loadMcpSdk(): Promise<McpSdk> {
  mcpSdk ??= (async () => {
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
  })()

  return mcpSdk
}

async function connectClient(
  server: ReturnType<typeof createLecturerMcpServer>,
  session: LecturerMcpSession
): Promise<McpClient> {
  const { Client, InMemoryTransport } = await loadMcpSdk()
  const client = new Client({
    name: 'synthetic-lecturer-test',
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

describe('lecturer MCP capabilities', () => {
  it('advertises service metadata and policy summaries for every tool', () => {
    const capabilities = getLecturerCapabilities({ mcpEndpoint: '/mcp' })

    expect(capabilities).toMatchObject({
      service: 'mcp-lecturer',
      version: '0.1.0',
      transport: 'httpStream',
      endpoint: '/mcp',
      autonomousWrites: false,
      proposalRequiredForWrites: true,
      humanConfirmationRequiredForWrites: true,
    })
    expect(capabilities.tools.map((tool) => tool.name)).toEqual(
      LECTURER_MCP_TOOL_NAMES
    )
    expect(capabilities.tools.every((tool) => tool.readOnly)).toBe(true)
    expect(
      capabilities.tools.find(
        (tool) => tool.name === 'klicker_lecturer_capabilities'
      )
    ).toMatchObject({
      annotations: { readOnlyHint: true },
      category: 'meta',
      rbacScope: ['manage:read'],
      requiresHumanConfirmation: false,
      solutionExposure: 'none',
    })
    expect(
      capabilities.tools.find(
        (tool) => tool.name === 'klicker_lecturer_element_create_draft_proposal'
      )
    ).toMatchObject({
      annotations: { readOnlyHint: true },
      category: 'proposal',
      rbacScope: ['manage:draft'],
      requiresHumanConfirmation: true,
      solutionExposure: 'lecturer-owned',
    })
  })

  it('registers argument schemas and rejects invalid calls before dispatch', async () => {
    const listCourses = vi.fn(async () => ({ courses: [] }))
    const server = createLecturerMcpServer(
      {
        host: '127.0.0.1',
        jwtIssuer: 'synthetic-test-issuer',
        jwtSecret: 'synthetic-test-secret',
        mcpEndpoint: '/mcp',
        port: 7081,
      },
      { listCourses } as unknown as LecturerReadService
    )
    const session: LecturerMcpSession = {
      bearerToken: 'synthetic-test-token',
      scopes: ['manage:read', 'manage:draft'],
      userId: 'synthetic-lecturer',
    }
    const client = await connectClient(server, session)

    try {
      const { tools } = await client.listTools()
      expect(tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining([
          'klicker_lecturer_course_list',
          'klicker_lecturer_course_get',
        ])
      )

      const courseList = findTool(tools, 'klicker_lecturer_course_list')
      expect(courseList.inputSchema.properties?.limit).toMatchObject({
        default: 10,
        maximum: 20,
        minimum: 1,
      })

      const courseGet = findTool(tools, 'klicker_lecturer_course_get')
      expect(courseGet.inputSchema.required).toEqual(['courseId'])

      await client.callTool({
        arguments: {},
        name: 'klicker_lecturer_course_list',
      })
      expect(listCourses).toHaveBeenCalledWith(
        { includeArchived: false, limit: 10 },
        expect.objectContaining({ userId: 'synthetic-lecturer' })
      )

      for (const limit of [0, 21]) {
        await expect(
          client.callTool({
            arguments: { limit },
            name: 'klicker_lecturer_course_list',
          })
        ).rejects.toMatchObject({ code: -32602 })
      }
      await expect(
        client.callTool({
          arguments: {},
          name: 'klicker_lecturer_course_get',
        })
      ).rejects.toMatchObject({ code: -32602 })
      expect(listCourses).toHaveBeenCalledTimes(1)
    } finally {
      await client.close()
      await server.stop()
    }
  })
})
