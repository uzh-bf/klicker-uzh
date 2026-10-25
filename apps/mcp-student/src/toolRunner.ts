import type { StudentMcpSession } from './auth.js'
import {
  toStudentToolError,
  type StudentMcpToolErrorOutput,
} from './toolErrors.js'
import type { StudentMcpToolName } from './toolPolicy.js'

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
    scopes: session?.scopes ?? [],
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
    const safeError = toStudentToolError(error)
    logToolCall(session, toolName, startedAt, 'error', safeError)
    return json(safeError)
  }
}
