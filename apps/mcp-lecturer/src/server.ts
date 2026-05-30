import { FastMCP } from 'fastmcp'
import { z } from 'zod'
import type { RuntimeSettings } from './config.js'

export const LECTURER_MCP_TOOL_NAMES = [
  'klicker_lecturer_capabilities',
] as const

export type LecturerMcpToolName = (typeof LECTURER_MCP_TOOL_NAMES)[number]

type LecturerToolCapability = {
  name: LecturerMcpToolName
  description: string
  readOnly: boolean
}

export type LecturerMcpCapabilities = {
  service: 'mcp-lecturer'
  version: '0.1.0'
  transport: 'httpStream'
  endpoint: `/${string}`
  autonomousWrites: false
  proposalRequiredForWrites: true
  tools: LecturerToolCapability[]
}

function json(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2)
}

export function getLecturerCapabilities(
  settings: Pick<RuntimeSettings, 'mcpEndpoint'>
): LecturerMcpCapabilities {
  return {
    service: 'mcp-lecturer',
    version: '0.1.0',
    transport: 'httpStream',
    endpoint: settings.mcpEndpoint,
    autonomousWrites: false,
    proposalRequiredForWrites: true,
    tools: [
      {
        name: 'klicker_lecturer_capabilities',
        description:
          'Describe the lecturer MCP scaffold and currently available safe tools.',
        readOnly: true,
      },
    ],
  }
}

export function createLecturerMcpServer(settings: RuntimeSettings): FastMCP {
  const server = new FastMCP({
    health: {
      enabled: true,
      message: 'healthy',
      path: '/healthz',
      status: 200,
    },
    name: 'KlickerUZH Lecturer MCP',
    version: '0.1.0',
  })

  server.addTool({
    annotations: {
      openWorldHint: false,
      readOnlyHint: true,
      title: 'Lecturer MCP Capabilities',
    },
    description:
      'Return the current lecturer MCP service capabilities. This scaffold tool does not access Klicker data.',
    execute: async () => json(getLecturerCapabilities(settings)),
    name: 'klicker_lecturer_capabilities',
    parameters: z.object({}),
    timeoutMs: 5_000,
  })

  return server
}
