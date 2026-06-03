import { afterEach, describe, expect, it, vi } from 'vitest'
import { runLecturerDraftTool, runLecturerReadTool } from '../src/toolRunner.js'

const lecturerSession = {
  bearerToken: 'secret-lecturer-token',
  scopes: ['manage:read', 'manage:draft'] as const,
  userId: 'lecturer-1',
}

describe('lecturer MCP tool runner', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns successful read JSON and logs sanitized lecturer metadata', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const output = await runLecturerReadTool({
      execute: (session) => {
        expect(session).toBe(lecturerSession)
        return { value: 'course-result-payload' }
      },
      session: lecturerSession,
      toolName: 'klicker_lecturer_course_list',
    })

    expect(JSON.parse(output)).toEqual({ value: 'course-result-payload' })
    expect(info).toHaveBeenCalledWith(
      'mcp_tool_call',
      expect.objectContaining({
        latencyMs: expect.any(Number),
        outcome: 'ok',
        role: 'lecturer',
        scopes: ['manage:read', 'manage:draft'],
        service: 'mcp-lecturer',
        subjectId: 'lecturer-1',
        tool: 'klicker_lecturer_course_list',
      })
    )
    expect(warn).not.toHaveBeenCalled()
    expect(JSON.stringify(info.mock.calls)).not.toContain(
      'course-result-payload'
    )
    expect(JSON.stringify(info.mock.calls)).not.toContain(
      'secret-lecturer-token'
    )
  })

  it('preserves draft scope errors and does not execute the tool', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const execute = vi.fn()

    const output = await runLecturerDraftTool({
      execute,
      session: {
        bearerToken: 'secret-lecturer-token',
        scopes: ['manage:read'],
        userId: 'lecturer-1',
      },
      toolName: 'klicker_lecturer_question_draft',
    })

    expect(JSON.parse(output)).toEqual({
      error: {
        code: 'FORBIDDEN',
        message: 'Object not found or not accessible',
      },
    })
    expect(execute).not.toHaveBeenCalled()
    expect(info).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(
      'mcp_tool_call',
      expect.objectContaining({
        errorCode: 'FORBIDDEN',
        latencyMs: expect.any(Number),
        outcome: 'error',
        role: 'lecturer',
        scopes: ['manage:read'],
        service: 'mcp-lecturer',
        subjectId: 'lecturer-1',
        tool: 'klicker_lecturer_question_draft',
      })
    )
    expect(JSON.stringify(warn.mock.calls)).not.toContain(
      'secret-lecturer-token'
    )
  })

  it('keeps invalid-input errors stable without logging payloads', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = new Error('draft-payload invalid')
    error.name = 'ZodError'

    const output = await runLecturerReadTool({
      execute: () => {
        throw error
      },
      session: lecturerSession,
      toolName: 'klicker_lecturer_element_search',
    })

    expect(JSON.parse(output)).toEqual({
      error: {
        code: 'INVALID_INPUT',
        message: 'Invalid lecturer MCP tool input',
      },
    })
    expect(warn).toHaveBeenCalledWith(
      'mcp_tool_call',
      expect.objectContaining({
        errorCode: 'INVALID_INPUT',
        outcome: 'error',
        subjectId: 'lecturer-1',
        tool: 'klicker_lecturer_element_search',
      })
    )
    expect(JSON.stringify(warn.mock.calls)).not.toContain('draft-payload')
    expect(JSON.stringify(warn.mock.calls)).not.toContain(
      'secret-lecturer-token'
    )
  })
})
