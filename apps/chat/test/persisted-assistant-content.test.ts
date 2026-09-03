import { describe, expect, test } from 'vitest'
import {
  buildAbortedAssistantContent,
  mapAssistantStepContent,
} from '../src/lib/server/persistedAssistantContent'

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

  test('persists only the opaque response-example tool status', () => {
    const content = mapAssistantStepContent([
      {
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-response-example',
            toolName: 'search_response_examples',
            input: { query: 'current question' },
          },
          {
            type: 'tool-result',
            toolCallId: 'call-response-example',
            toolName: 'search_response_examples',
            output: {
              kind: 'response-example-search',
              status: 'completed',
            },
          },
        ],
      },
    ])

    expect(content).toEqual([
      {
        type: 'tool-call',
        toolCallId: 'call-response-example',
        toolName: 'search_response_examples',
        args: { query: 'current question' },
        result: {
          kind: 'response-example-search',
          status: 'completed',
        },
      },
    ])
    expect(JSON.stringify(content)).not.toContain('referenceAnswer')
  })

  test('preserves finished steps and appends only unfinished text and reasoning', () => {
    expect(
      buildAbortedAssistantContent(
        [
          {
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-finished',
                toolName: 'KB_doc_query',
                input: { query: 'alpha' },
              },
              {
                type: 'tool-result',
                toolCallId: 'call-finished',
                toolName: 'KB_doc_query',
                output: { sources_used: 1 },
              },
              { type: 'text', text: 'Finished step text.' },
            ],
          },
        ],
        [
          { type: 'reasoning', text: 'Unfinished reasoning.' },
          { type: 'text', text: 'Unfinished answer text.' },
        ]
      )
    ).toEqual([
      {
        type: 'tool-call',
        toolCallId: 'call-finished',
        toolName: 'KB_doc_query',
        args: { query: 'alpha' },
        result: { sources_used: 1 },
      },
      { type: 'text', text: 'Finished step text.' },
      { type: 'reasoning', text: 'Unfinished reasoning.' },
      { type: 'text', text: 'Unfinished answer text.' },
      { type: 'data', name: 'chat-stopped', data: {} },
    ])
  })

  test('does not add whitespace-only unfinished content', () => {
    expect(
      buildAbortedAssistantContent(
        [
          {
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-only',
                toolName: 'KB_doc_query',
                input: {},
              },
              {
                type: 'tool-result',
                toolCallId: 'call-only',
                toolName: 'KB_doc_query',
                output: { sources_used: 1 },
              },
            ],
          },
        ],
        [
          { type: 'text', text: ' \n' },
          { type: 'reasoning', text: '\t' },
        ]
      )
    ).toEqual([
      {
        type: 'tool-call',
        toolCallId: 'call-only',
        toolName: 'KB_doc_query',
        args: {},
        result: { sources_used: 1 },
      },
      { type: 'data', name: 'chat-stopped', data: {} },
    ])
  })

  test('persists only the stopped marker when nothing streamed before abort', () => {
    expect(buildAbortedAssistantContent(undefined, [])).toEqual([
      { type: 'data', name: 'chat-stopped', data: {} },
    ])
  })
})
