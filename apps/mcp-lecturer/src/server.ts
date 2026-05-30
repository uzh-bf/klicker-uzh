import { FastMCP, UserError } from 'fastmcp'
import type { IncomingMessage } from 'node:http'
import { z } from 'zod'
import {
  bearerTokenFromHeaders,
  verifyLecturerSession,
  type LecturerMcpSession,
} from './auth.js'
import type { RuntimeSettings } from './config.js'
import {
  courseGetSchema,
  courseListSchema,
  elementGetSchema,
  elementSearchSchema,
  type LecturerReadService,
} from './service.js'

export const LECTURER_MCP_TOOL_NAMES = [
  'klicker_lecturer_capabilities',
  'klicker_lecturer_course_list',
  'klicker_lecturer_course_get',
  'klicker_lecturer_element_search',
  'klicker_lecturer_element_get',
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

function toolError(error: unknown) {
  if (error instanceof z.ZodError) {
    return {
      error: {
        code: 'INVALID_INPUT',
        message: 'Invalid lecturer MCP tool input',
      },
    }
  }

  const message = error instanceof Error ? error.message : String(error)
  if (/not found or not accessible|Forbidden/i.test(message)) {
    return {
      error: {
        code: 'FORBIDDEN',
        message: 'Object not found or not accessible',
      },
    }
  }

  return {
    error: {
      code: 'UNKNOWN',
      message: 'Lecturer MCP tool call failed',
    },
  }
}

function requireSession(session: LecturerMcpSession | undefined) {
  if (!session) {
    throw new UserError('Authentication failed: missing lecturer session')
  }
  return session
}

async function runReadTool(
  session: LecturerMcpSession | undefined,
  execute: (session: LecturerMcpSession) => Promise<unknown>
) {
  try {
    return json(await execute(requireSession(session)))
  } catch (error) {
    return json(toolError(error))
  }
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
      {
        name: 'klicker_lecturer_course_list',
        description:
          'List compact courses the authenticated lecturer can read.',
        readOnly: true,
      },
      {
        name: 'klicker_lecturer_course_get',
        description:
          'Get compact metadata and activity counts for one readable course.',
        readOnly: true,
      },
      {
        name: 'klicker_lecturer_element_search',
        description:
          'Search readable question elements with capped plain-text snippets.',
        readOnly: true,
      },
      {
        name: 'klicker_lecturer_element_get',
        description:
          'Get one readable question element with capped sanitized details.',
        readOnly: true,
      },
    ],
  }
}

export function createLecturerMcpServer(
  settings: RuntimeSettings,
  service: LecturerReadService
): FastMCP<LecturerMcpSession> {
  const server = new FastMCP<LecturerMcpSession>({
    authenticate: async (request: IncomingMessage) => {
      const token = bearerTokenFromHeaders(request.headers)
      if (!token) {
        throw new UserError(
          'Authentication failed: missing Authorization bearer token'
        )
      }
      return verifyLecturerSession(token, settings)
    },
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

  server.addTool({
    annotations: {
      openWorldHint: false,
      readOnlyHint: true,
      title: 'List Lecturer Courses',
    },
    description:
      'List courses readable by the authenticated lecturer. Returns compact metadata only and never includes PIN codes.',
    execute: (args, context) =>
      runReadTool(context.session, (session) =>
        service.listCourses(args, session)
      ),
    name: 'klicker_lecturer_course_list',
    parameters: courseListSchema,
    timeoutMs: 10_000,
  })

  server.addTool({
    annotations: {
      openWorldHint: false,
      readOnlyHint: true,
      title: 'Get Lecturer Course',
    },
    description:
      'Get compact metadata and activity counts for a course readable by the authenticated lecturer.',
    execute: (args, context) =>
      runReadTool(context.session, (session) =>
        service.getCourse(args, session)
      ),
    name: 'klicker_lecturer_course_get',
    parameters: courseGetSchema,
    timeoutMs: 10_000,
  })

  server.addTool({
    annotations: {
      openWorldHint: false,
      readOnlyHint: true,
      title: 'Search Lecturer Elements',
    },
    description:
      'Search question elements readable by the authenticated lecturer. Results are capped and include plain-text snippets only.',
    execute: (args, context) =>
      runReadTool(context.session, (session) =>
        service.searchElements(args, session)
      ),
    name: 'klicker_lecturer_element_search',
    parameters: elementSearchSchema,
    timeoutMs: 10_000,
  })

  server.addTool({
    annotations: {
      openWorldHint: false,
      readOnlyHint: true,
      title: 'Get Lecturer Element',
    },
    description:
      'Get one question element readable by the authenticated lecturer. Text fields and options are capped.',
    execute: (args, context) =>
      runReadTool(context.session, (session) =>
        service.getElement(args, session)
      ),
    name: 'klicker_lecturer_element_get',
    parameters: elementGetSchema,
    timeoutMs: 10_000,
  })

  return server
}
