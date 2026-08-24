import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LecturerMcpSession } from '../src/auth.js'
import { runLecturerTool } from '../src/toolRunner.js'

const lecturerSession: LecturerMcpSession = {
  bearerToken: 'secret-lecturer-token',
  scopes: ['manage:read', 'manage:draft'],
  userId: 'lecturer-1',
}

describe('lecturer MCP tool runner', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns successful read JSON and logs sanitized lecturer metadata', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const output = await runLecturerTool({
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

  it('keeps invalid-input errors stable without logging payloads', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = new Error('draft-payload invalid')
    error.name = 'ZodError'

    const output = await runLecturerTool({
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
