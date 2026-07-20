import { describe, expect, it } from 'vitest'
import { studentToolErrorCode, toStudentToolError } from '../src/toolErrors.js'

describe('student MCP tool errors', () => {
  it('keeps question reference failures domain-specific', () => {
    expect(
      toStudentToolError(new Error('Invalid questionRef signature'))
    ).toEqual({
      error: {
        code: 'QUESTION_REF_INVALID',
        message: 'Invalid questionRef signature',
      },
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
