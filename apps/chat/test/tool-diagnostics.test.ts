import { describe, expect, it } from 'vitest'
import {
  collectStepToolDiagnostics,
  summarizeToolDiagnostics,
} from '../src/lib/server/toolDiagnostics'

const step = (content: unknown[]) => ({ content })

describe('step tool diagnostics', () => {
  it('counts only tool calls and derives names from them', () => {
    const diagnostics = collectStepToolDiagnostics(
      step([
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'KB_doc_query',
          input: { query: 'a' },
        },
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'KB_doc_query',
          output: { sources: [] },
        },
        {
          type: 'tool-error',
          toolCallId: 'call-2',
          toolName: 'KB_doc_query',
          input: { query: 'b' },
          error: 'synthetic failure',
        },
        {
          type: 'tool-call',
          toolCallId: 'call-3',
          toolName: 'local_search',
          input: { q: 'c' },
        },
      ])
    )

    expect(diagnostics.map((diagnostic) => diagnostic.event)).toEqual([
      'tool-call',
      'tool-result',
      'tool-error',
      'tool-call',
    ])
    expect(summarizeToolDiagnostics(diagnostics)).toEqual({
      toolCallsCount: 2,
      toolCallNames: ['KB_doc_query', 'local_search'],
    })
  })

  it('does not count a lone result or error as a tool call', () => {
    const resultOnly = collectStepToolDiagnostics(
      step([
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'KB_doc_query',
          output: { sources: [] },
        },
      ])
    )
    expect(summarizeToolDiagnostics(resultOnly)).toEqual({
      toolCallsCount: 0,
      toolCallNames: [],
    })

    const errorOnly = collectStepToolDiagnostics(
      step([
        {
          type: 'tool-error',
          toolCallId: 'call-1',
          toolName: 'KB_doc_query',
          error: 'synthetic failure',
        },
      ])
    )
    expect(summarizeToolDiagnostics(errorOnly)).toEqual({
      toolCallsCount: 0,
      toolCallNames: [],
    })
  })

  it('correlates call, result, and error by toolCallId without emitting content', () => {
    const secret = 'SYNTHETIC-SECRET-PAYLOAD'
    const diagnostics = collectStepToolDiagnostics(
      step([
        {
          type: 'tool-call',
          toolCallId: 'call-shared',
          toolName: 'KB_doc_query',
          input: { query: secret },
        },
        {
          type: 'tool-result',
          toolCallId: 'call-shared',
          toolName: 'KB_doc_query',
          output: { content: secret },
        },
        {
          type: 'tool-error',
          toolCallId: 'call-shared',
          toolName: 'KB_doc_query',
          input: { query: secret },
          error: secret,
        },
      ])
    )

    expect(diagnostics.map((diagnostic) => diagnostic.toolCallId)).toEqual([
      'call-shared',
      'call-shared',
      'call-shared',
    ])
    expect(diagnostics.map((diagnostic) => diagnostic.toolName)).toEqual([
      'KB_doc_query',
      'KB_doc_query',
      'KB_doc_query',
    ])
    expect(diagnostics[0]?.input.hash).toMatch(/^[0-9a-f]{12}$/)
    expect(diagnostics[1]?.output.hash).toMatch(/^[0-9a-f]{12}$/)
    // The raw input, output, and error text never reach the diagnostic.
    expect(JSON.stringify(diagnostics)).not.toContain(secret)
  })

  it('distinguishes absent, null, and empty values', () => {
    const outputState = (output?: unknown) =>
      collectStepToolDiagnostics(
        step([{ type: 'tool-result', toolCallId: 'c1', toolName: 't', output }])
      )[0]?.output

    const [call] = collectStepToolDiagnostics(
      step([
        { type: 'tool-call', toolCallId: 'c1', toolName: 't', input: { q: 1 } },
      ])
    )
    // A tool call has no output at all, which is not the same as a null one.
    expect(call?.output).toEqual({ state: 'absent', bytes: null, hash: null })
    expect(call?.input.state).toBe('present')

    expect(outputState()).toEqual({
      state: 'absent',
      bytes: null,
      hash: null,
    })
    expect(outputState(undefined)).toEqual({
      state: 'absent',
      bytes: null,
      hash: null,
    })
    expect(outputState(null)).toEqual({
      state: 'null',
      bytes: 4,
      hash: expect.any(String),
    })
    expect(outputState('')).toEqual({
      state: 'empty',
      bytes: 2,
      hash: expect.any(String),
    })
    expect(outputState({})).toEqual({
      state: 'empty',
      bytes: 2,
      hash: expect.any(String),
    })
    expect(outputState([])).toEqual({
      state: 'empty',
      bytes: 2,
      hash: expect.any(String),
    })

    const present = outputState({ content: 'evidence' })
    expect(present?.state).toBe('present')
    expect(present?.bytes).toBeGreaterThan(0)
    expect(present?.hash).toMatch(/^[0-9a-f]{12}$/)
  })

  it('supports legacy args and result part fields', () => {
    const [call, result] = collectStepToolDiagnostics(
      step([
        { type: 'tool-call', toolCallId: 'c1', toolName: 't', args: { q: 1 } },
        {
          type: 'tool-result',
          toolCallId: 'c1',
          toolName: 't',
          result: { ok: true },
        },
      ])
    )
    expect(call?.input.state).toBe('present')
    expect(call?.output.state).toBe('absent')
    expect(result?.input.state).toBe('absent')
    expect(result?.output.state).toBe('present')
  })

  it('ignores non-tool parts and reports missing identifiers', () => {
    const diagnostics = collectStepToolDiagnostics(
      step([
        { type: 'text', text: 'assistant text' },
        { type: 'reasoning', text: 'reasoning text' },
        { type: 'tool-call' },
      ])
    )
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]).toMatchObject({
      event: 'tool-call',
      toolName: 'unknown',
      toolCallId: null,
    })
  })

  it('handles an absent or empty step content list', () => {
    expect(collectStepToolDiagnostics({})).toEqual([])
    expect(collectStepToolDiagnostics({ content: [] })).toEqual([])
  })
})
