import { describe, expect, test } from 'vitest'
import { normalizeLiveToolOutput, SAFE_TOOL_ERROR } from '../src/lib/toolOutput'

describe('live tool output', () => {
  test('sanitizes MCP-declared error envelopes', () => {
    const sensitive = 'private upstream response with token'
    const output = normalizeLiveToolOutput({
      isError: true,
      content: [{ type: 'text', text: sensitive }],
    })

    expect(output).toEqual({ result: SAFE_TOOL_ERROR, isError: true })
    expect(JSON.stringify(output)).not.toContain(sensitive)
  })

  test('sanitizes explicit tool-output-error events', () => {
    expect(normalizeLiveToolOutput('private detail', true)).toEqual({
      result: SAFE_TOOL_ERROR,
      isError: true,
    })
  })

  test('preserves successful output', () => {
    const result = { content: [{ type: 'text', text: 'Safe result' }] }
    expect(normalizeLiveToolOutput(result)).toEqual({
      result,
      isError: false,
    })
  })
})
