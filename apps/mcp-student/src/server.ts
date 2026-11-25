import {
  FlashcardCorrectness,
  STUDENT_MCP_SUPPORTED_ELEMENT_TYPES,
} from '@klicker-uzh/types'
import { FastMCP } from 'fastmcp'
import type { IncomingMessage } from 'node:http'
import { z } from 'zod'
import {
  bearerTokenFromHeaders,
  StudentMcpAuthError,
  verifyParticipantSession,
  type StudentMcpSession,
} from './auth.js'
import {
  getStudentCapabilities,
  type StudentMcpCapabilities,
} from './capabilities.js'
import type { RuntimeSettings } from './config.js'
import type { StudentPracticeService } from './service.js'
import { toolDefinition } from './toolPolicy.js'
import { runStudentTool } from './toolRunner.js'

export { getStudentCapabilities, type StudentMcpCapabilities }

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
  flashcardResponse: z.nativeEnum(FlashcardCorrectness).optional(),
  freeTextResponse: z.string().optional(),
  instanceId: z.number().int(),
  numericalResponse: z.number().optional(),
  type: z.enum(STUDENT_MCP_SUPPORTED_ELEMENT_TYPES),
})

const getQuizStackSchema = z.object({
  questionRef: z.string().min(1),
})

const submitSchema = z.object({
  questionRef: z.string().min(1),
  responses: z.array(stackResponseSchema).min(1),
  stackAnswerTimeSeconds: z.number().int().min(0),
})

export function createStudentMcpServer(
  settings: RuntimeSettings,
  service: StudentPracticeService
): FastMCP<StudentMcpSession> {
  const server = new FastMCP<StudentMcpSession>({
    // A nullish result is how fastmcp is told authentication failed; it then
    // answers with 401 and a WWW-Authenticate header. Letting an error escape
    // instead would leave the transport guessing a status from message text.
    authenticate: async (request: IncomingMessage) => {
      const token = bearerTokenFromHeaders(request.headers)
      if (!token) return null

      try {
        return await verifyParticipantSession(token, settings)
      } catch (error) {
        if (error instanceof StudentMcpAuthError) return null
        throw error
      }
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
    ...toolDefinition(
      'klicker_student_capabilities',
      'Student MCP Capabilities'
    ),
    description:
      'Return the current student MCP service capabilities and policy summary. This tool does not access course practice data.',
    execute: (_args, context) =>
      runStudentTool({
        execute: async () => getStudentCapabilities(settings),
        session: context.session,
        toolName: 'klicker_student_capabilities',
      }),
    parameters: z.object({}),
    timeoutMs: 5_000,
  })

  server.addTool({
    ...toolDefinition(
      'lookup_relevant_practice_stacks',
      'Lookup Relevant Practice Stacks'
    ),
    description:
      'Find answer-safe practice-stack candidates related to the current chat topic.',
    execute: (args, context) =>
      runStudentTool({
        execute: (session) =>
          service.lookupRelevantPracticeStacks(args, session),
        session: context.session,
        toolName: 'lookup_relevant_practice_stacks',
      }),
    parameters: lookupSchema,
    timeoutMs: 10_000,
  })

  server.addTool({
    ...toolDefinition(
      'get_practice_stack_for_quiz',
      'Get Practice Stack For Quiz'
    ),
    description:
      'Fetch full answer-safe render data for a selected practice stack.',
    execute: (args, context) =>
      runStudentTool({
        execute: (session) => service.getPracticeStackForQuiz(args, session),
        session: context.session,
        toolName: 'get_practice_stack_for_quiz',
      }),
    parameters: getQuizStackSchema,
    timeoutMs: 10_000,
  })

  server.addTool({
    ...toolDefinition(
      'submit_practice_stack_answer',
      'Submit Practice Stack Answer'
    ),
    description:
      'Submit a completed structured stack answer and return backend grading.',
    execute: (args, context) =>
      runStudentTool({
        execute: (session) => service.submitPracticeStackAnswer(args, session),
        session: context.session,
        toolName: 'submit_practice_stack_answer',
      }),
    parameters: submitSchema,
    timeoutMs: 30_000,
  })

  return server
}
