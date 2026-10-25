export type LecturerToolErrorCode =
  | 'BACKEND_UNAVAILABLE'
  | 'FORBIDDEN'
  | 'INVALID_INPUT'
  | 'MISSING_SCOPE'
  | 'NOT_FOUND'
  | 'PERMISSION_LEVEL_INSUFFICIENT'
  | 'PROPOSAL_EXPIRED'
  | 'PROPOSAL_INVALID'
  | 'UNAUTHENTICATED'
  | 'UNKNOWN'

export type LecturerToolErrorOutput = {
  error: {
    code: LecturerToolErrorCode
    message: string
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function isZodError(error: unknown) {
  return error instanceof Error && error.name === 'ZodError'
}

export function lecturerToolErrorCode(error: unknown): LecturerToolErrorCode {
  const message = errorMessage(error)

  if (/missing scope|MCP token is missing scope/i.test(message)) {
    return 'MISSING_SCOPE'
  }
  if (
    /proposal.*expired|expired.*proposal|jwt expired|token expired/i.test(
      message
    )
  ) {
    return 'PROPOSAL_EXPIRED'
  }
  if (
    /invalid manage proposal|invalid proposal|proposal token|proposal payload/i.test(
      message
    )
  ) {
    return 'PROPOSAL_INVALID'
  }
  if (
    /missing lecturer session|missing Authorization|invalid lecturer MCP token|must identify a lecturer|UNAUTHENTICATED|unauthenticated|unauthorized|HTTP 401|status code 401/i.test(
      message
    )
  ) {
    return 'UNAUTHENTICATED'
  }
  if (isZodError(error)) {
    return 'INVALID_INPUT'
  }
  if (/^Forbidden$|permission level|insufficient permission/i.test(message)) {
    return 'PERMISSION_LEVEL_INSUFFICIENT'
  }
  if (
    /not found or not accessible|FORBIDDEN|not authorized|not accessible|HTTP 403|status code 403/i.test(
      message
    )
  ) {
    return 'FORBIDDEN'
  }
  if (/NOT_FOUND|not found|HTTP 404|status code 404/i.test(message)) {
    return 'NOT_FOUND'
  }
  if (
    /GraphQL .* failed|returned no data|fetch failed|network|ECONNREFUSED|ETIMEDOUT|timeout|ENOTFOUND|backend|HTTP 5\d\d|status code 5\d\d/i.test(
      message
    )
  ) {
    return 'BACKEND_UNAVAILABLE'
  }
  if (
    /BAD_USER_INPUT|GRAPHQL_VALIDATION_FAILED|invalid input|validation failed|HTTP 400|HTTP 422|status code 400|status code 422/i.test(
      message
    )
  ) {
    return 'INVALID_INPUT'
  }
  return 'UNKNOWN'
}

function safeLecturerToolMessage(code: LecturerToolErrorCode): string {
  switch (code) {
    case 'BACKEND_UNAVAILABLE':
      return 'Lecturer MCP backend unavailable'
    case 'FORBIDDEN':
      return 'Object not found or not accessible'
    case 'INVALID_INPUT':
      return 'Invalid lecturer MCP tool input'
    case 'MISSING_SCOPE':
      return 'Lecturer MCP token is missing the required scope'
    case 'NOT_FOUND':
      return 'Object not found'
    case 'PERMISSION_LEVEL_INSUFFICIENT':
      return 'Lecturer permission level is insufficient for this action'
    case 'PROPOSAL_EXPIRED':
      return 'Manage assistant proposal has expired'
    case 'PROPOSAL_INVALID':
      return 'Manage assistant proposal is invalid'
    case 'UNAUTHENTICATED':
      return 'Lecturer MCP authentication failed'
    case 'UNKNOWN':
      return 'Lecturer MCP tool call failed'
  }
}

export function toLecturerToolError(error: unknown): LecturerToolErrorOutput {
  const code = lecturerToolErrorCode(error)

  return {
    error: {
      code,
      message: safeLecturerToolMessage(code),
    },
  }
}
