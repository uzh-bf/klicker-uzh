import { FastMCP } from 'fastmcp'
import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import { z } from 'zod'
import {
  bearerTokenFromHeaders,
  LecturerMcpAuthError,
  verifyLecturerSession,
  type LecturerMcpSession,
} from './auth.js'
import {
  getLecturerCapabilities,
  type LecturerMcpCapabilities,
} from './capabilities.js'
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
import {
  LECTURER_MCP_TOOL_NAMES,
  toolDefinition,
  type LecturerMcpToolName,
} from './toolPolicy.js'
import { runLecturerTool } from './toolRunner.js'

export {
  getLecturerCapabilities,
  LECTURER_MCP_TOOL_NAMES,
  type LecturerMcpCapabilities,
  type LecturerMcpToolName,
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
      jti: randomUUID(),
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

export function createLecturerMcpServer(
  settings: RuntimeSettings,
  service: LecturerReadService
): FastMCP<LecturerMcpSession> {
  const server = new FastMCP<LecturerMcpSession>({
    // A nullish result is how fastmcp is told authentication failed; it then
    // answers with 401 and a WWW-Authenticate header. Letting an error escape
    // instead would leave the transport guessing a status from message text.
    authenticate: async (request: IncomingMessage) => {
      const token = bearerTokenFromHeaders(request.headers)
      if (!token) return null

      try {
        return await verifyLecturerSession(token, settings)
      } catch (error) {
        if (error instanceof LecturerMcpAuthError) return null
        throw error
      }
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
    ...toolDefinition(
      'klicker_lecturer_capabilities',
      'Lecturer MCP Capabilities'
    ),
    description:
      'Return the current lecturer MCP service capabilities. This scaffold tool does not access Klicker data.',
    execute: (_args, context) =>
      runLecturerTool({
        execute: () => getLecturerCapabilities(settings),
        session: context.session,
        toolName: 'klicker_lecturer_capabilities',
      }),
    parameters: z.object({}),
    timeoutMs: 5_000,
  })

  server.addTool({
    ...toolDefinition('klicker_lecturer_course_list', 'List Lecturer Courses'),
    description:
      'List courses readable by the authenticated lecturer. Returns compact metadata only and never includes PIN codes.',
    execute: (args, context) =>
      runLecturerTool({
        execute: (session) => service.listCourses(args, session),
        session: context.session,
        toolName: 'klicker_lecturer_course_list',
      }),
    parameters: courseListSchema,
    timeoutMs: 10_000,
  })

  server.addTool({
    ...toolDefinition('klicker_lecturer_course_get', 'Get Lecturer Course'),
    description:
      'Get compact metadata and activity counts for a course readable by the authenticated lecturer.',
    execute: (args, context) =>
      runLecturerTool({
        execute: (session) => service.getCourse(args, session),
        session: context.session,
        toolName: 'klicker_lecturer_course_get',
      }),
    parameters: courseGetSchema,
    timeoutMs: 10_000,
  })

  server.addTool({
    ...toolDefinition(
      'klicker_lecturer_element_search',
      'Search Lecturer Elements'
    ),
    description:
      'Search question elements readable by the authenticated lecturer. Results are capped and include plain-text snippets only.',
    execute: (args, context) =>
      runLecturerTool({
        execute: (session) => service.searchElements(args, session),
        session: context.session,
        toolName: 'klicker_lecturer_element_search',
      }),
    parameters: elementSearchSchema,
    timeoutMs: 10_000,
  })

  server.addTool({
    ...toolDefinition('klicker_lecturer_element_get', 'Get Lecturer Element'),
    description:
      'Get one question element readable by the authenticated lecturer. Text fields and options are capped.',
    execute: (args, context) =>
      runLecturerTool({
        execute: (session) => service.getElement(args, session),
        session: context.session,
        toolName: 'klicker_lecturer_element_get',
      }),
    parameters: elementGetSchema,
    timeoutMs: 10_000,
  })

  server.addTool({
    ...toolDefinition(
      'klicker_lecturer_question_draft',
      'Draft Lecturer Question'
    ),
    description:
      'Create a validated draft-only question payload for SC, MC, or FREE_TEXT questions. This never persists data. If courseId is provided, the course must be readable by the authenticated lecturer.',
    execute: (args, context) =>
      runLecturerTool({
        execute: (session) => service.createQuestionDraft(args, session),
        session: context.session,
        toolName: 'klicker_lecturer_question_draft',
      }),
    parameters: questionDraftSchema,
    timeoutMs: 10_000,
  })

  server.addTool({
    ...toolDefinition(
      'klicker_lecturer_choices_draft',
      'Draft Lecturer Choices'
    ),
    description:
      'Create validated draft-only choice scaffolding for a question. This never persists data.',
    execute: (args, context) =>
      runLecturerTool({
        execute: (session) => service.createChoicesDraft(args, session),
        session: context.session,
        toolName: 'klicker_lecturer_choices_draft',
      }),
    parameters: choicesDraftSchema,
    timeoutMs: 5_000,
  })

  server.addTool({
    ...toolDefinition(
      'klicker_lecturer_feedback_draft',
      'Draft Lecturer Feedback'
    ),
    description:
      'Create validated draft-only answer feedback scaffolding for a question and its choices. This never persists data.',
    execute: (args, context) =>
      runLecturerTool({
        execute: (session) => service.createFeedbackDraft(args, session),
        session: context.session,
        toolName: 'klicker_lecturer_feedback_draft',
      }),
    parameters: feedbackDraftSchema,
    timeoutMs: 5_000,
  })

  server.addTool({
    ...toolDefinition(
      'klicker_lecturer_element_create_draft_proposal',
      'Propose Draft Question Creation'
    ),
    description:
      'Create a signed proposal for a DRAFT SC, MC, or FREE_TEXT question. This does not persist data; the lecturer must explicitly confirm the proposal in the Manage assistant UI.',
    execute: (args, context) =>
      runLecturerTool({
        execute: async (session) => {
          const proposal = service.createElementDraftProposal(args, session)
          return {
            ...proposal,
            proposalToken: await signProposalToken(settings, session, proposal),
          }
        },
        session: context.session,
        toolName: 'klicker_lecturer_element_create_draft_proposal',
      }),
    parameters: elementCreateDraftProposalSchema,
    timeoutMs: 10_000,
  })

  return server
}
