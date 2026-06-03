import type { StudentMcpToolName } from './toolPolicy.js'

type StudentMcpSession = {
  bearerToken: string
  participantId: string
}

type StudentMcpToolErrorCode =
  | 'PRACTICE_POOL_UNAVAILABLE'
  | 'QUESTION_REF_EXPIRED'
  | 'QUESTION_REF_INVALID'
  | 'QUESTION_REF_STALE'
  | 'SUBMISSION_INVALID'
  | 'UNAUTHENTICATED'
  | 'UNKNOWN'

type StudentMcpToolErrorOutput = {
  error: {
    code: StudentMcpToolErrorCode
    message: string
  }
}

type RunStudentToolOptions = {
  execute: (session: StudentMcpSession) => Promise<unknown>
  session: StudentMcpSession | undefined
  toolName: StudentMcpToolName
}

function json(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2)
}

function requireSession(session: StudentMcpSession | undefined) {
  if (!session) {
    throw new Error('Missing authenticated participant session')
  }
  return session
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function errorCode(message: string): StudentMcpToolErrorCode {
  if (
    message === 'Missing authenticated participant session' ||
    message === 'Missing Authorization bearer token'
  ) {
    return 'UNAUTHENTICATED'
  }
  if (/questionRef has expired/i.test(message)) {
    return 'QUESTION_REF_EXPIRED'
  }
  if (/Invalid questionRef|questionRef signature/i.test(message)) {
    return 'QUESTION_REF_INVALID'
  }
  if (
    /no longer eligible|no longer matches|does not match request context/i.test(
      message
    )
  ) {
    return 'QUESTION_REF_STALE'
  }
  if (
    /Submission must answer|Duplicate response|Response type mismatch/i.test(
      message
    )
  ) {
    return 'SUBMISSION_INVALID'
  }
  if (/No practice pool is available/i.test(message)) {
    return 'PRACTICE_POOL_UNAVAILABLE'
  }
  return 'UNKNOWN'
}

function safeToolError(error: unknown): StudentMcpToolErrorOutput {
  const message = errorMessage(error)
  const code = errorCode(message)

  return {
    error: {
      code,
      message:
        code === 'UNKNOWN' ? 'Student practice tool call failed' : message,
    },
  }
}

function logToolCall(
  session: StudentMcpSession | undefined,
  toolName: StudentMcpToolName,
  startedAt: number,
  outcome: 'error' | 'ok',
  error?: StudentMcpToolErrorOutput
) {
  const entry = {
    latencyMs: Date.now() - startedAt,
    outcome,
    role: 'student',
    scopes: [],
    service: 'mcp-student',
    subjectId: session?.participantId ?? null,
    tool: toolName,
    ...(error ? { errorCode: error.error.code } : {}),
  }

  if (outcome === 'ok') {
    console.info('mcp_tool_call', entry)
  } else {
    console.warn('mcp_tool_call', entry)
  }
}

export async function runStudentTool({
  execute,
  session,
  toolName,
}: RunStudentToolOptions): Promise<string> {
  const startedAt = Date.now()

  try {
    const output = json(await execute(requireSession(session)))
    logToolCall(session, toolName, startedAt, 'ok')
    return output
  } catch (error) {
    const safeError = safeToolError(error)
    logToolCall(session, toolName, startedAt, 'error', safeError)
    return json(safeError)
  }
}
