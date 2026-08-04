import { describe, expect, it } from 'vitest'
import {
  lecturerToolErrorCode,
  toLecturerToolError,
} from '../src/toolErrors.js'

describe('lecturer MCP tool errors', () => {
  it('maps auth, scope, and permission failures to explicit codes', () => {
    expect(
      lecturerToolErrorCode(
        new Error('Authentication failed: missing lecturer session')
      )
    ).toBe('UNAUTHENTICATED')
    expect(
      toLecturerToolError(
        new Error('Authentication failed: missing scope manage:draft')
      ).error
    ).toEqual({
      code: 'MISSING_SCOPE',
      message: 'Lecturer MCP token is missing the required scope',
    })
    expect(toLecturerToolError(new Error('Forbidden')).error).toEqual({
      code: 'PERMISSION_LEVEL_INSUFFICIENT',
      message: 'Lecturer permission level is insufficient for this action',
    })
  })

  it('keeps object access failures non-enumerating', () => {
    expect(
      toLecturerToolError(new Error('Object not found or not accessible')).error
    ).toEqual({
      code: 'FORBIDDEN',
      message: 'Object not found or not accessible',
    })
    expect(
      toLecturerToolError(
        new Error('Response not successful: Received status code 403')
      ).error.code
    ).toBe('FORBIDDEN')
  })

  it('maps proposal failures separately', () => {
    expect(
      toLecturerToolError(new Error('proposal token expired')).error
    ).toEqual({
      code: 'PROPOSAL_EXPIRED',
      message: 'Manage assistant proposal has expired',
    })
    expect(
      toLecturerToolError(new Error('Invalid Manage proposal token')).error
    ).toEqual({
      code: 'PROPOSAL_INVALID',
      message: 'Manage assistant proposal is invalid',
    })
  })

  it('maps validation and backend failures without leaking details', () => {
    const zodError = new Error('raw draft detail')
    zodError.name = 'ZodError'

    expect(toLecturerToolError(zodError).error).toEqual({
      code: 'INVALID_INPUT',
      message: 'Invalid lecturer MCP tool input',
    })
    expect(
      toLecturerToolError(
        new Error('GraphQL LecturerQuery failed: received secret backend 503')
      ).error
    ).toEqual({
      code: 'BACKEND_UNAVAILABLE',
      message: 'Lecturer MCP backend unavailable',
    })
  })
})
