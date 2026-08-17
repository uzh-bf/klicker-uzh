export type StudentMcpToolErrorCode =
  | 'BACKEND_UNAVAILABLE'
  | 'FORBIDDEN'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'PRACTICE_POOL_UNAVAILABLE'
  | 'QUESTION_REF_EXPIRED'
  | 'QUESTION_REF_INVALID'
  | 'QUESTION_REF_STALE'
  | 'SUBMISSION_INVALID'
  | 'UNAUTHENTICATED'
  | 'UNKNOWN'

export type StudentMcpToolErrorOutput = {
  error: {
    code: StudentMcpToolErrorCode
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

export function studentToolErrorCode(error: unknown): StudentMcpToolErrorCode {
  const message = errorMessage(error)

  if (
    message === 'Missing authenticated participant session' ||
    /Authentication failed/i.test(message) ||
    /UNAUTHENTICATED|unauthenticated|unauthorized|HTTP 401|status code 401/i.test(
      message
    )
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
  if (
    /FORBIDDEN|Forbidden|not authorized|not accessible|HTTP 403|status code 403/i.test(
      message
    )
  ) {
    return 'FORBIDDEN'
  }
  if (/NOT_FOUND|not found|HTTP 404|status code 404/i.test(message)) {
    return 'NOT_FOUND'
  }
  if (
    isZodError(error) ||
    /BAD_USER_INPUT|GRAPHQL_VALIDATION_FAILED|invalid input|validation failed|HTTP 400|HTTP 422|status code 400|status code 422/i.test(
      message
    )
  ) {
    return 'INVALID_INPUT'
  }
  if (
    /GraphQL .* failed|returned no data|fetch failed|network|ECONNREFUSED|ETIMEDOUT|timeout|ENOTFOUND|backend|HTTP 5\d\d|status code 5\d\d/i.test(
      message
    )
  ) {
    return 'BACKEND_UNAVAILABLE'
  }
  return 'UNKNOWN'
}

function safeStudentToolMessage(code: StudentMcpToolErrorCode): string {
  switch (code) {
    case 'BACKEND_UNAVAILABLE':
      return 'Student practice backend unavailable'
    case 'FORBIDDEN':
      return 'Student practice object not found or not accessible'
    case 'INVALID_INPUT':
      return 'Invalid student practice tool input'
    case 'NOT_FOUND':
      return 'Student practice object not found'
    case 'PRACTICE_POOL_UNAVAILABLE':
      return 'No practice pool is currently available'
    case 'QUESTION_REF_EXPIRED':
      return 'Question reference has expired; request a new question'
    case 'QUESTION_REF_INVALID':
      return 'Question reference is invalid'
    case 'QUESTION_REF_STALE':
      return 'Question reference is no longer valid for this request'
    case 'SUBMISSION_INVALID':
      return 'Submission is invalid'
    case 'UNAUTHENTICATED':
      return 'Student practice authentication failed'
    case 'UNKNOWN':
      return 'Student practice tool call failed'
  }
}

export function toStudentToolError(error: unknown): StudentMcpToolErrorOutput {
  const code = studentToolErrorCode(error)

  return {
    error: {
      code,
      message: safeStudentToolMessage(code),
    },
  }
}
