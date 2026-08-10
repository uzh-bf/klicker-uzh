import { describe, expect, test } from 'vitest'
import { mapAssistantStepContent } from '../src/lib/server/persistedAssistantContent'

describe('persisted assistant content', () => {
  test('sanitizes a thrown error attached to an existing tool call', () => {
    const sensitiveError = new Error(
      'Bearer private-token from upstream response body'
    )

    const content = mapAssistantStepContent([
      {
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'library_search',
            input: { query: 'safe input' },
          },
          {
            type: 'tool-error',
            toolCallId: 'call-1',
            toolName: 'library_search',
            error: sensitiveError,
          },
        ],
      },
    ])

    expect(content).toEqual([
      {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'library_search',
        args: { query: 'safe input' },
        result: 'Tool execution failed',
        isError: true,
      },
    ])
    expect(JSON.stringify(content)).not.toContain(sensitiveError.message)
  })

  test('sanitizes a string error when no matching call part was emitted', () => {
    const sensitiveError = 'private upstream response with secret material'

    const content = mapAssistantStepContent([
      {
        content: [
          {
            type: 'tool-error',
            toolCallId: 'call-2',
            toolName: 'library_lookup',
            input: { id: 'public-id' },
            error: sensitiveError,
          },
        ],
      },
    ])

    expect(content).toEqual([
      {
        type: 'tool-call',
        toolCallId: 'call-2',
        toolName: 'library_lookup',
        args: { id: 'public-id' },
        result: 'Tool execution failed',
        isError: true,
      },
    ])
    expect(JSON.stringify(content)).not.toContain(sensitiveError)
  })

  test('sanitizes an MCP error result and its sensitive content', () => {
    const sensitiveError = 'upstream body with private-token'

    const content = mapAssistantStepContent([
      {
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-mcp-error',
            toolName: 'library_search',
            input: { query: 'safe input' },
          },
          {
            type: 'tool-result',
            toolCallId: 'call-mcp-error',
            toolName: 'library_search',
            output: {
              isError: true,
              content: [{ type: 'text', text: sensitiveError }],
            },
          },
        ],
      },
    ])

    expect(content).toEqual([
      {
        type: 'tool-call',
        toolCallId: 'call-mcp-error',
        toolName: 'library_search',
        args: { query: 'safe input' },
        result: 'Tool execution failed',
        isError: true,
      },
    ])
    expect(JSON.stringify(content)).not.toContain(sensitiveError)
  })

  test('preserves successful text, reasoning, and tool results', () => {
    expect(
      mapAssistantStepContent([
        {
          content: [
            { type: 'reasoning', text: 'Inspect the source.' },
            {
              type: 'tool-call',
              toolCallId: 'call-3',
              toolName: 'library_search',
              input: { query: 'alpha' },
            },
            {
              type: 'tool-result',
              toolCallId: 'call-3',
              toolName: 'library_search',
              output: { content: [{ type: 'text', text: 'Safe result' }] },
            },
            { type: 'text', text: 'Final answer.' },
          ],
        },
      ])
    ).toEqual([
      { type: 'reasoning', text: 'Inspect the source.' },
      {
        type: 'tool-call',
        toolCallId: 'call-3',
        toolName: 'library_search',
        args: { query: 'alpha' },
        result: { content: [{ type: 'text', text: 'Safe result' }] },
      },
      { type: 'text', text: 'Final answer.' },
    ])
  })
})
