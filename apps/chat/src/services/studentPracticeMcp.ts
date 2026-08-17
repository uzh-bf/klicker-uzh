import type {
  StudentMcpGetPracticeStackForQuizOutput as GetPracticeStackForQuizOutput,
  StudentMcpLookupRelevantPracticeStacksOutput as LookupRelevantPracticeStacksOutput,
  StudentMcpCandidate as PracticeCandidate,
  StudentMcpStackResponseInput as StackResponseInput,
  StudentMcpSubmitPracticeStackAnswerOutput as SubmitPracticeStackAnswerOutput,
  StudentMcpToolErrorCode as ToolErrorCode,
} from '@klicker-uzh/types'
import { createMCPClient, type MCPServerConfig } from './mcpClients'
import { buildMcpServiceUrl } from './mcpUrl'

export type {
  StudentMcpGetPracticeStackForQuizOutput as GetPracticeStackForQuizOutput,
  StudentMcpStackResponseInput as StackResponseInput,
} from '@klicker-uzh/types'

const DEFAULT_LOOKUP_LIMIT = 3
const MAX_LOOKUP_SUMMARY_MESSAGES = 6
const MAX_LOOKUP_SUMMARY_CHARS = 1200

export const STUDENT_PRACTICE_QUIZ_TOOL_NAME = 'start_student_practice_quiz'

export function toPracticeCandidateId(index: number): string {
  return `practice_${index + 1}`
}

export type ChatPracticeMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type PracticeLookupContext = {
  conversationSummary?: string
  lastUserMessage: string
}

type ExecutableMcpTool = {
  execute: (args: unknown, options?: unknown) => Promise<unknown> | unknown
}

type ExecuteWithTools<T> = (
  tools: Record<string, ExecutableMcpTool>
) => Promise<T>

export class StudentPracticeMcpToolError extends Error {
  constructor(
    readonly code: ToolErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'StudentPracticeMcpToolError'
  }
}

export function statusForStudentPracticeMcpError(
  error: StudentPracticeMcpToolError
): number {
  switch (error.code) {
    case 'QUESTION_REF_EXPIRED':
    case 'QUESTION_REF_STALE':
      return 410
    case 'FORBIDDEN':
      return 403
    case 'QUESTION_REF_INVALID':
    case 'SUBMISSION_INVALID':
    case 'INVALID_INPUT':
      return 400
    case 'PRACTICE_POOL_UNAVAILABLE':
    case 'NOT_FOUND':
      return 404
    case 'UNAUTHENTICATED':
      return 401
    case 'BACKEND_UNAVAILABLE':
    case 'UNKNOWN':
      return 500
    default:
      return 500
  }
}

export function getStudentPracticeMcpUrl(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  return buildMcpServiceUrl({
    defaultDevelopmentPort: '7080',
    env,
    names: {
      host: 'MCP_STUDENT_HOST',
      path: 'MCP_STUDENT_PATH',
      port: 'MCP_STUDENT_PORT',
      scheme: 'MCP_STUDENT_SCHEME',
      url: 'MCP_STUDENT_URL',
    },
  })
}

export function buildPracticeLookupContext(
  messages: ChatPracticeMessage[]
): PracticeLookupContext | null {
  const latestUserIndex = messages.findLastIndex(
    (message) => message.role === 'user' && message.content.trim().length > 0
  )

  if (latestUserIndex === -1) {
    return null
  }

  const priorMessages = messages
    .slice(0, latestUserIndex)
    .filter((message) => message.content.trim().length > 0)
    .slice(-MAX_LOOKUP_SUMMARY_MESSAGES)

  const conversationSummary = priorMessages
    .map((message) => `${message.role}: ${message.content.trim()}`)
    .join('\n')
    .slice(0, MAX_LOOKUP_SUMMARY_CHARS)

  return {
    ...(conversationSummary ? { conversationSummary } : {}),
    lastUserMessage: messages[latestUserIndex].content.trim(),
  }
}

export function parseMcpJsonToolResult<T = unknown>(result: unknown): T {
  if (typeof result === 'string') {
    return parseMcpJsonText<T>(result)
  }

  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>
    if ('toolResult' in record) {
      return parseMcpJsonToolResult<T>(record.toolResult)
    }

    if (Array.isArray(record.content)) {
      const textContent = record.content.find((part) => {
        if (!part || typeof part !== 'object') return false
        const contentPart = part as Record<string, unknown>
        return (
          contentPart.type === 'text' && typeof contentPart.text === 'string'
        )
      }) as { text: string } | undefined

      if (textContent) {
        return parseMcpJsonText<T>(textContent.text)
      }

      throw new Error('MCP tool result did not contain JSON text content')
    }

    if (isToolErrorOutput(result)) {
      throw new StudentPracticeMcpToolError(
        result.error.code,
        result.error.message
      )
    }

    return result as T
  }

  throw new Error('MCP tool result did not contain JSON text content')
}

function parseMcpJsonText<T>(text: string): T {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new StudentPracticeMcpToolError(
      'UNKNOWN',
      text.trim() || 'Student practice MCP returned a non-JSON response'
    )
  }

  if (isToolErrorOutput(parsed)) {
    throw new StudentPracticeMcpToolError(
      parsed.error.code,
      parsed.error.message
    )
  }

  return parsed as T
}

function isToolErrorOutput(
  value: unknown
): value is { error: { code: ToolErrorCode; message: string } } {
  if (!value || typeof value !== 'object') return false
  const error = (value as { error?: unknown }).error
  if (!error || typeof error !== 'object') return false
  const record = error as Record<string, unknown>
  return typeof record.code === 'string' && typeof record.message === 'string'
}

export function formatPracticeCandidatesForPrompt(
  candidates: PracticeCandidate[]
): string {
  if (candidates.length === 0) return ''

  const formattedCandidates = candidates
    .map((candidate, index) =>
      [
        `${index + 1}. ${candidate.stackTitle}`,
        `candidateId: ${toPracticeCandidateId(index)}`,
        `source: ${candidate.sourcePracticeQuizTitle}`,
        `types: ${candidate.supportedElementTypes.join(', ')}`,
        `preview: ${candidate.shortQuestionPreview}`,
        `scores: relevance ${candidate.relevanceScore}, srs ${candidate.srsScore}`,
        `reason: ${candidate.reason}`,
      ].join('\n')
    )
    .join('\n\n')

  return [
    'Relevant practice candidates from this course. These are answer-safe and omit solution details.',
    'Only call start_student_practice_quiz with one of these candidateId values when a quiz would help the student.',
    'Do not quote or expose candidate ids to the student and do not render quiz content yourself.',
    formattedCandidates,
  ].join('\n\n')
}

async function withStudentPracticeMcp<T>({
  chatbotId,
  participantId,
  execute,
}: {
  chatbotId: string
  participantId: string
  execute: ExecuteWithTools<T>
}): Promise<T | null> {
  const url = getStudentPracticeMcpUrl()
  if (!url) {
    return null
  }

  const server: MCPServerConfig = {
    authType: 'klicker-participant-jwt',
    id: 'student-practice',
    name: 'Student_Practice',
    url,
  }

  const client = await createMCPClient(server, { chatbotId, participantId })

  try {
    const tools = (await client.tools()) as unknown as Record<
      string,
      ExecutableMcpTool
    >
    return await execute(tools)
  } finally {
    await client.close().catch((error: unknown) => {
      console.warn('Failed to close student practice MCP client:', error)
    })
  }
}

function getExecutableTool(
  tools: Record<string, ExecutableMcpTool>,
  name: string
): ExecutableMcpTool {
  const tool = tools[name]
  if (!tool || typeof tool.execute !== 'function') {
    throw new Error(`Student MCP tool ${name} is not available`)
  }
  return tool
}

async function executeStudentPracticeTool<T>({
  chatbotId,
  participantId,
  toolName,
  args,
}: {
  chatbotId: string
  participantId: string
  toolName: string
  args: Record<string, unknown>
}): Promise<T | null> {
  return withStudentPracticeMcp({
    chatbotId,
    participantId,
    execute: async (tools) => {
      const tool = getExecutableTool(tools, toolName)
      const result = await tool.execute(args)
      return parseMcpJsonToolResult<T>(result)
    },
  })
}

export async function lookupRelevantPracticeStacks({
  chatbotId,
  courseId,
  limit = DEFAULT_LOOKUP_LIMIT,
  messages,
  participantId,
}: {
  chatbotId: string
  courseId: string
  limit?: number
  messages: ChatPracticeMessage[]
  participantId: string
}): Promise<LookupRelevantPracticeStacksOutput | null> {
  const context = buildPracticeLookupContext(messages)
  if (!context) {
    return { candidates: [] }
  }

  return executeStudentPracticeTool<LookupRelevantPracticeStacksOutput>({
    args: {
      chatbotId,
      courseId,
      conversationSummary: context.conversationSummary,
      lastUserMessage: context.lastUserMessage,
      limit,
    },
    chatbotId,
    participantId,
    toolName: 'lookup_relevant_practice_stacks',
  })
}

export async function getPracticeStackForQuiz({
  chatbotId,
  participantId,
  questionRef,
}: {
  chatbotId: string
  participantId: string
  questionRef: string
}): Promise<GetPracticeStackForQuizOutput | null> {
  return executeStudentPracticeTool<GetPracticeStackForQuizOutput>({
    args: { questionRef },
    chatbotId,
    participantId,
    toolName: 'get_practice_stack_for_quiz',
  })
}

export async function submitPracticeStackAnswer({
  chatbotId,
  participantId,
  questionRef,
  responses,
  stackAnswerTimeSeconds,
}: {
  chatbotId: string
  participantId: string
  questionRef: string
  responses: StackResponseInput[]
  stackAnswerTimeSeconds: number
}): Promise<SubmitPracticeStackAnswerOutput | null> {
  return executeStudentPracticeTool<SubmitPracticeStackAnswerOutput>({
    args: {
      questionRef,
      responses,
      stackAnswerTimeSeconds,
    },
    chatbotId,
    participantId,
    toolName: 'submit_practice_stack_answer',
  })
}
