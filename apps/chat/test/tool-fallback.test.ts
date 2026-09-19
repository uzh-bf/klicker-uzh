import { describe, expect, test } from 'vitest'
import { formatToolName } from '../src/components/tool-labels'

describe('tool fallback labels', () => {
  test('uses human labels for lecturer MCP tools', () => {
    expect(formatToolName('klicker_lecturer_element_search')).toEqual({
      server: null,
      tool: 'Searched question pool',
    })
    expect(formatToolName('klicker_lecturer_element_get')).toEqual({
      server: null,
      tool: 'Opened question details',
    })
  })

  test('falls back to server and tool segments for unknown tool names', () => {
    expect(formatToolName('custom_tool_name')).toEqual({
      server: 'custom',
      tool: 'tool name',
    })
  })
})
