import { describe, expect, it } from 'vitest'
import { studentToolErrorCode, toStudentToolError } from '../src/toolErrors.js'

describe('student MCP tool errors', () => {
  it('classifies question reference failures with a fixed safe message', () => {
    expect(
      toStudentToolError(new Error('Invalid questionRef signature'))
    ).toEqual({
      error: {
        code: 'QUESTION_REF_INVALID',
        message: 'Question reference is invalid',
      },
    })
    // A raw message carrying an internal detail must not leak through the
    // domain-specific code path.
    expect(
      toStudentToolError(
        new Error('questionRef has expired at backend host db-7')
      ).error
    ).toEqual({
      code: 'QUESTION_REF_EXPIRED',
      message: 'Question reference has expired; request a new question',
    })
  })

  it('masks stale, submission, and practice-pool failures with fixed messages', () => {
    expect(
      toStudentToolError(
        new Error('questionRef no longer eligible for participant secret')
      ).error
    ).toEqual({
      code: 'QUESTION_REF_STALE',
      message: 'Question reference is no longer valid for this request',
    })
    expect(
      toStudentToolError(new Error('Submission must answer every stack')).error
    ).toEqual({
      code: 'SUBMISSION_INVALID',
      message: 'Submission is invalid',
    })
    expect(
      toStudentToolError(
        new Error('No practice pool is available for course x')
      ).error
    ).toEqual({
      code: 'PRACTICE_POOL_UNAVAILABLE',
      message: 'No practice pool is currently available',
    })
  })

  it('maps auth, access, and missing-object failures to stable common codes', () => {
    expect(
      studentToolErrorCode(
        new Error('Missing authenticated participant session')
      )
    ).toBe('UNAUTHENTICATED')
    expect(
      studentToolErrorCode(
        new Error('Authentication failed: invalid participant token')
      )
    ).toBe('UNAUTHENTICATED')
    expect(
      toStudentToolError(new Error('GraphQL Query failed: FORBIDDEN')).error
    ).toEqual({
      code: 'FORBIDDEN',
      message: 'Student practice object not found or not accessible',
    })
    expect(
      toStudentToolError(
        new Error('Response not successful: Received status code 403')
      ).error.code
    ).toBe('FORBIDDEN')
    expect(
      toStudentToolError(new Error('GraphQL Query failed: NOT_FOUND')).error
    ).toEqual({
      code: 'NOT_FOUND',
      message: 'Student practice object not found',
    })
  })

  it('maps validation and backend failures without leaking backend messages', () => {
    const zodError = new Error('raw validation detail')
    zodError.name = 'ZodError'

    expect(toStudentToolError(zodError).error).toEqual({
      code: 'INVALID_INPUT',
      message: 'Invalid student practice tool input',
    })
    expect(
      toStudentToolError(
        new Error('GraphQL PracticeQuery failed: received secret backend 503')
      ).error
    ).toEqual({
      code: 'BACKEND_UNAVAILABLE',
      message: 'Student practice backend unavailable',
    })
  })

  it('masks unknown failures', () => {
    expect(toStudentToolError(new Error('raw secret detail')).error).toEqual({
      code: 'UNKNOWN',
      message: 'Student practice tool call failed',
    })
  })
})
