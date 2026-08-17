import type { LecturerMcpScope, LecturerMcpSession } from './auth.js'
import {
  toLecturerToolError,
  type LecturerToolErrorOutput,
} from './toolErrors.js'
import type { LecturerMcpToolName } from './toolPolicy.js'

type RunLecturerToolOptions = {
  execute: (session: LecturerMcpSession) => unknown
  session: LecturerMcpSession | undefined
  toolName: LecturerMcpToolName
}

function json(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2)
}

function requireSession(session: LecturerMcpSession | undefined) {
  if (!session) {
    throw new Error('Authentication failed: missing lecturer session')
  }
  return session
}

function requireScope(session: LecturerMcpSession, scope: LecturerMcpScope) {
  if (!session.scopes.includes(scope)) {
    throw new Error(`Authentication failed: missing scope ${scope}`)
  }
}

function logToolCall(
  session: LecturerMcpSession | undefined,
  toolName: LecturerMcpToolName,
  startedAt: number,
  outcome: 'error' | 'ok',
  error?: LecturerToolErrorOutput
) {
  const entry = {
    latencyMs: Date.now() - startedAt,
    outcome,
    role: 'lecturer',
    scopes: session?.scopes ?? [],
    service: 'mcp-lecturer',
    subjectId: session?.userId ?? null,
    tool: toolName,
    ...(error ? { errorCode: error.error.code } : {}),
  }

  if (outcome === 'ok') {
    console.info('mcp_tool_call', entry)
  } else {
    console.warn('mcp_tool_call', entry)
  }
}

export async function runLecturerReadTool({
  execute,
  session,
  toolName,
}: RunLecturerToolOptions) {
  const startedAt = Date.now()

  try {
    const output = json(await execute(requireSession(session)))
    logToolCall(session, toolName, startedAt, 'ok')
    return output
  } catch (error) {
    const safeError = toLecturerToolError(error)
    logToolCall(session, toolName, startedAt, 'error', safeError)
    return json(safeError)
  }
}

export async function runLecturerDraftTool({
  execute,
  session,
  toolName,
}: RunLecturerToolOptions) {
  const startedAt = Date.now()

  try {
    const validSession = requireSession(session)
    requireScope(validSession, 'manage:draft')
    const output = json(await execute(validSession))
    logToolCall(session, toolName, startedAt, 'ok')
    return output
  } catch (error) {
    const safeError = toLecturerToolError(error)
    logToolCall(session, toolName, startedAt, 'error', safeError)
    return json(safeError)
  }
}
