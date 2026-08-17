import { afterEach, describe, expect, it, vi } from 'vitest'
import { runStudentTool } from '../src/toolRunner.js'

const studentSession = {
  bearerToken: 'secret-student-token',
  participantId: 'participant-1',
}

describe('student MCP tool runner', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns successful JSON and logs sanitized tool metadata', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const output = await runStudentTool({
      execute: async (session) => {
        expect(session).toBe(studentSession)
        return { value: 'student-answer-payload' }
      },
      session: studentSession,
      toolName: 'lookup_relevant_practice_stacks',
    })

    expect(JSON.parse(output)).toEqual({ value: 'student-answer-payload' })
    expect(info).toHaveBeenCalledWith(
      'mcp_tool_call',
      expect.objectContaining({
        latencyMs: expect.any(Number),
        outcome: 'ok',
        role: 'student',
        scopes: [],
        service: 'mcp-student',
        subjectId: 'participant-1',
        tool: 'lookup_relevant_practice_stacks',
      })
    )
    expect(warn).not.toHaveBeenCalled()
    expect(JSON.stringify(info.mock.calls)).not.toContain(
      'secret-student-token'
    )
    expect(JSON.stringify(info.mock.calls)).not.toContain(
      'student-answer-payload'
    )
  })

  it('masks unauthenticated errors and logs the error code only', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const execute = vi.fn()

    const output = await runStudentTool({
      execute,
      session: undefined,
      toolName: 'get_practice_stack_for_quiz',
    })

    expect(JSON.parse(output)).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Student practice authentication failed',
      },
    })
    expect(execute).not.toHaveBeenCalled()
    expect(info).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(
      'mcp_tool_call',
      expect.objectContaining({
        errorCode: 'UNAUTHENTICATED',
        latencyMs: expect.any(Number),
        outcome: 'error',
        role: 'student',
        service: 'mcp-student',
        subjectId: null,
        tool: 'get_practice_stack_for_quiz',
      })
    )
  })

  it('keeps domain error codes stable and never surfaces the raw message', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const output = await runStudentTool({
      execute: async () => {
        throw new Error('questionRef has expired for student-answer-payload')
      },
      session: studentSession,
      toolName: 'submit_practice_stack_answer',
    })

    // The raw message embeds a response value; the client-facing error must
    // carry only the fixed safe message, not the leaked payload.
    expect(JSON.parse(output)).toEqual({
      error: {
        code: 'QUESTION_REF_EXPIRED',
        message: 'Question reference has expired; request a new question',
      },
    })
    expect(output).not.toContain('student-answer-payload')
    expect(warn).toHaveBeenCalledWith(
      'mcp_tool_call',
      expect.objectContaining({
        errorCode: 'QUESTION_REF_EXPIRED',
        outcome: 'error',
        subjectId: 'participant-1',
        tool: 'submit_practice_stack_answer',
      })
    )
    expect(JSON.stringify(warn.mock.calls)).not.toContain(
      'student-answer-payload'
    )
    expect(JSON.stringify(warn.mock.calls)).not.toContain(
      'secret-student-token'
    )
  })
})
