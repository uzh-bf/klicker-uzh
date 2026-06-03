import type { LecturerMcpToolName } from './toolPolicy.js'

type LecturerMcpScope = 'manage:draft' | 'manage:read'

type LecturerMcpSession = {
  bearerToken: string
  scopes: readonly LecturerMcpScope[]
  userId: string
}

type LecturerToolErrorCode = 'FORBIDDEN' | 'INVALID_INPUT' | 'UNKNOWN'

type LecturerToolErrorOutput = {
  error: {
    code: LecturerToolErrorCode
    message: string
  }
}

type RunLecturerToolOptions = {
  execute: (session: LecturerMcpSession) => Promise<unknown> | unknown
  session: LecturerMcpSession | undefined
  toolName: LecturerMcpToolName
}

function json(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2)
}

function isZodError(error: unknown) {
  return error instanceof Error && error.name === 'ZodError'
}

function toolError(error: unknown): LecturerToolErrorOutput {
  if (isZodError(error)) {
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
    const safeError = toolError(error)
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
    const safeError = toolError(error)
    logToolCall(session, toolName, startedAt, 'error', safeError)
    return json(safeError)
  }
}
