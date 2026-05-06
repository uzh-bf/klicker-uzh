import { FastMCP, UserError } from 'fastmcp'
import type { IncomingMessage } from 'node:http'
import { z } from 'zod'
import {
  bearerTokenFromHeaders,
  verifyParticipantSession,
  type StudentMcpSession,
} from './auth.js'
import type { RuntimeSettings } from './config.js'
import type { StudentPracticeService } from './service.js'
import { SUPPORTED_ELEMENT_TYPES } from './types.js'

const lookupSchema = z.object({
  chatbotId: z.string().min(1).describe('Chatbot assigned to the course'),
  courseId: z.string().min(1).describe('Course whose practice pool is queried'),
  conversationSummary: z
    .string()
    .optional()
    .describe('Compact summary of the current conversation'),
  lastUserMessage: z
    .string()
    .min(1)
    .describe('Latest student message in the conversation'),
  limit: z.number().int().min(1).max(5).default(3),
})

const stackResponseSchema = z.object({
  choicesResponse: z
    .array(
      z.object({
        ix: z.number().int(),
        selected: z.boolean(),
      })
    )
    .optional(),
  flashcardResponse: z.enum(['CORRECT', 'PARTIAL', 'INCORRECT']).optional(),
  freeTextResponse: z.string().optional(),
  instanceId: z.number().int(),
  numericalResponse: z.number().optional(),
  type: z.enum(SUPPORTED_ELEMENT_TYPES),
})

const getQuizStackSchema = z.object({
  questionRef: z.string().min(1),
})

const submitSchema = z.object({
  questionRef: z.string().min(1),
  responses: z.array(stackResponseSchema).min(1),
  stackAnswerTimeSeconds: z.number().int().min(0),
})

function json(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function requireSession(session: StudentMcpSession | undefined) {
  if (!session) {
    throw new UserError('Missing authenticated participant session')
  }
  return session
}

function toUserError(error: unknown): UserError {
  if (error instanceof UserError) return error
  if (error instanceof Error) return new UserError(error.message)
  return new UserError('Student MCP tool call failed')
}

async function runTool(
  session: StudentMcpSession | undefined,
  execute: (session: StudentMcpSession) => Promise<unknown>
): Promise<string> {
  try {
    return json(await execute(requireSession(session)))
  } catch (error) {
    throw toUserError(error)
  }
}

export function createStudentMcpServer(
  settings: RuntimeSettings,
  service: StudentPracticeService
): FastMCP<StudentMcpSession> {
  const server = new FastMCP<StudentMcpSession>({
    authenticate: async (request: IncomingMessage) => {
      const token = bearerTokenFromHeaders(request.headers)
      if (!token) {
        throw new UserError('Missing Authorization bearer token')
      }
      return verifyParticipantSession(token, settings)
    },
    health: {
      enabled: true,
      message: 'healthy',
      path: '/healthz',
      status: 200,
    },
    name: 'KlickerUZH Student MCP',
    version: '0.1.0',
  })

  server.addTool({
    annotations: {
      openWorldHint: false,
      readOnlyHint: true,
      title: 'Lookup Relevant Practice Stacks',
    },
    description:
      'Find answer-safe practice-stack candidates related to the current chat topic.',
    execute: (args, context) =>
      runTool(context.session, (session) =>
        service.lookupRelevantPracticeStacks(args, session)
      ),
    name: 'lookup_relevant_practice_stacks',
    parameters: lookupSchema,
    timeoutMs: 10_000,
  })

  server.addTool({
    annotations: {
      openWorldHint: false,
      readOnlyHint: true,
      title: 'Get Practice Stack For Quiz',
    },
    description:
      'Fetch full answer-safe render data for a selected practice stack.',
    execute: (args, context) =>
      runTool(context.session, (session) =>
        service.getPracticeStackForQuiz(args, session)
      ),
    name: 'get_practice_stack_for_quiz',
    parameters: getQuizStackSchema,
    timeoutMs: 10_000,
  })

  server.addTool({
    annotations: {
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
      readOnlyHint: false,
      title: 'Submit Practice Stack Answer',
    },
    description:
      'Submit a completed structured stack answer and return backend grading.',
    execute: (args, context) =>
      runTool(context.session, (session) =>
        service.submitPracticeStackAnswer(args, session)
      ),
    name: 'submit_practice_stack_answer',
    parameters: submitSchema,
    timeoutMs: 30_000,
  })

  return server
}
