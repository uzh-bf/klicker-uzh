import { FastMCP, UserError } from 'fastmcp'
import type { IncomingMessage } from 'node:http'
import { z } from 'zod'
import {
  bearerTokenFromHeaders,
  verifyLecturerSession,
  type LecturerMcpScope,
  type LecturerMcpSession,
} from './auth.js'
import type { RuntimeSettings } from './config.js'
import { signLecturerJwt } from './jwt.js'
import {
  choicesDraftSchema,
  courseGetSchema,
  courseListSchema,
  elementCreateDraftProposalSchema,
  elementGetSchema,
  elementSearchSchema,
  feedbackDraftSchema,
  questionDraftSchema,
  type LecturerReadService,
} from './service.js'

export const LECTURER_MCP_TOOL_NAMES = [
  'klicker_lecturer_capabilities',
  'klicker_lecturer_course_list',
  'klicker_lecturer_course_get',
  'klicker_lecturer_element_search',
  'klicker_lecturer_element_get',
  'klicker_lecturer_question_draft',
  'klicker_lecturer_choices_draft',
  'klicker_lecturer_feedback_draft',
  'klicker_lecturer_element_create_draft_proposal',
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
  if (/not found or not accessible|Forbidden|missing scope/i.test(message)) {
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

function requireScope(session: LecturerMcpSession, scope: LecturerMcpScope) {
  if (!session.scopes.includes(scope)) {
    throw new UserError(`Authentication failed: missing scope ${scope}`)
  }
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

async function runDraftTool(
  session: LecturerMcpSession | undefined,
  execute: (session: LecturerMcpSession) => Promise<unknown> | unknown
) {
  try {
    const validSession = requireSession(session)
    requireScope(validSession, 'manage:draft')
    return json(await execute(validSession))
  } catch (error) {
    return json(toolError(error))
  }
}

async function signProposalToken(
  settings: RuntimeSettings,
  session: LecturerMcpSession,
  proposal: {
    kind: string
    payload: unknown
    summary?: string
  }
) {
  return signLecturerJwt(
    {
      kind: proposal.kind,
      payload: proposal.payload,
      purpose: 'manage-assistant-proposal',
      summary: proposal.summary,
      sub: session.userId,
    },
    settings.jwtSecret,
    {
      expiresIn: '15m',
      issuer: settings.jwtIssuer,
    }
  )
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
      {
        name: 'klicker_lecturer_question_draft',
        description:
          'Create a validated non-persisted question draft payload for lecturer review.',
        readOnly: true,
      },
      {
        name: 'klicker_lecturer_choices_draft',
        description:
          'Create validated non-persisted answer-choice draft scaffolding.',
        readOnly: true,
      },
      {
        name: 'klicker_lecturer_feedback_draft',
        description:
          'Create validated non-persisted answer-feedback draft scaffolding.',
        readOnly: true,
      },
      {
        name: 'klicker_lecturer_element_create_draft_proposal',
        description:
          'Create a signed confirmation proposal for a DRAFT question. This never persists data until the lecturer confirms it in Manage assistant UI.',
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

  server.addTool({
    annotations: {
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      readOnlyHint: true,
      title: 'Draft Lecturer Question',
    },
    description:
      'Create a validated draft-only question payload for SC, MC, or FREE_TEXT questions. This never persists data. If courseId is provided, the course must be readable by the authenticated lecturer.',
    execute: (args, context) =>
      runDraftTool(context.session, (session) =>
        service.createQuestionDraft(args, session)
      ),
    name: 'klicker_lecturer_question_draft',
    parameters: questionDraftSchema,
    timeoutMs: 10_000,
  })

  server.addTool({
    annotations: {
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      readOnlyHint: true,
      title: 'Draft Lecturer Choices',
    },
    description:
      'Create validated draft-only choice scaffolding for a question. This never persists data.',
    execute: (args, context) =>
      runDraftTool(context.session, (session) =>
        service.createChoicesDraft(args, session)
      ),
    name: 'klicker_lecturer_choices_draft',
    parameters: choicesDraftSchema,
    timeoutMs: 5_000,
  })

  server.addTool({
    annotations: {
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      readOnlyHint: true,
      title: 'Draft Lecturer Feedback',
    },
    description:
      'Create validated draft-only answer feedback scaffolding for a question and its choices. This never persists data.',
    execute: (args, context) =>
      runDraftTool(context.session, (session) =>
        service.createFeedbackDraft(args, session)
      ),
    name: 'klicker_lecturer_feedback_draft',
    parameters: feedbackDraftSchema,
    timeoutMs: 5_000,
  })

  server.addTool({
    annotations: {
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      readOnlyHint: true,
      title: 'Propose Draft Question Creation',
    },
    description:
      'Create a signed proposal for a DRAFT SC, MC, or FREE_TEXT question. This does not persist data; the lecturer must explicitly confirm the proposal in the Manage assistant UI.',
    execute: (args, context) =>
      runDraftTool(context.session, async (session) => {
        const proposal = service.createElementDraftProposal(args, session)
        return {
          ...proposal,
          proposalToken: await signProposalToken(settings, session, proposal),
        }
      }),
    name: 'klicker_lecturer_element_create_draft_proposal',
    parameters: elementCreateDraftProposalSchema,
    timeoutMs: 10_000,
  })

  return server
}
