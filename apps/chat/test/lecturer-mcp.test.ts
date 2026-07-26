import {
  filterToolsByDraftScope,
  getLecturerMcpUrl,
} from '@/src/services/lecturerMcp'
import type { ToolSet } from 'ai'
import { describe, expect, test } from 'vitest'

describe('lecturer MCP adapter', () => {
  test('prefers the explicit lecturer MCP URL', () => {
    expect(
      getLecturerMcpUrl({
        MCP_LECTURER_URL: 'https://mcp.example.test/lecturer',
        NODE_ENV: 'production',
      } as NodeJS.ProcessEnv)
    ).toBe('https://mcp.example.test/lecturer')
  })

  test('derives the development MCP URL from lecturer MCP env vars', () => {
    expect(
      getLecturerMcpUrl({
        MCP_LECTURER_PATH: 'custom-mcp',
        MCP_LECTURER_PORT: '7091',
        NODE_ENV: 'development',
      } as NodeJS.ProcessEnv)
    ).toBe('http://localhost:7091/custom-mcp')
  })

  test('derives the production MCP URL from lecturer MCP host env vars', () => {
    const url = new URL(
      getLecturerMcpUrl({
        MCP_LECTURER_HOST: 'lecturer-mcp.internal',
        MCP_LECTURER_PATH: 'custom-mcp',
        MCP_LECTURER_PORT: '7091',
        MCP_LECTURER_SCHEME: 'http',
        NODE_ENV: 'production',
      } as NodeJS.ProcessEnv) ?? ''
    )

    expect(url.protocol).toBe('http:')
    expect(url.host).toBe('lecturer-mcp.internal:7091')
    expect(url.pathname).toBe('/custom-mcp')
  })

  test('stays disabled in production without an explicit URL', () => {
    expect(
      getLecturerMcpUrl({
        NODE_ENV: 'production',
      } as NodeJS.ProcessEnv)
    ).toBeNull()
  })
})

const ALL_LECTURER_TOOL_NAMES = [
  'klicker_lecturer_capabilities',
  'klicker_lecturer_course_list',
  'klicker_lecturer_course_get',
  'klicker_lecturer_element_search',
  'klicker_lecturer_element_get',
  'klicker_lecturer_question_draft',
  'klicker_lecturer_choices_draft',
  'klicker_lecturer_feedback_draft',
  'klicker_lecturer_element_create_draft_proposal',
]

function fakeToolSet(names: string[]): ToolSet {
  return Object.fromEntries(
    names.map((name) => [name, { description: name }])
  ) as unknown as ToolSet
}

describe('filterToolsByDraftScope', () => {
  test('keeps every advertised tool when the session has manage:draft scope', () => {
    const tools = fakeToolSet(ALL_LECTURER_TOOL_NAMES)
    expect(Object.keys(filterToolsByDraftScope(tools, true)).sort()).toEqual(
      [...ALL_LECTURER_TOOL_NAMES].sort()
    )
  })

  test('drops draft/proposal tools when the session lacks manage:draft scope', () => {
    const tools = fakeToolSet(ALL_LECTURER_TOOL_NAMES)
    const filtered = filterToolsByDraftScope(tools, false)

    expect(Object.keys(filtered).sort()).toEqual(
      [
        'klicker_lecturer_capabilities',
        'klicker_lecturer_course_get',
        'klicker_lecturer_course_list',
        'klicker_lecturer_element_get',
        'klicker_lecturer_element_search',
      ].sort()
    )
    expect(filtered).not.toHaveProperty('klicker_lecturer_question_draft')
    expect(filtered).not.toHaveProperty('klicker_lecturer_choices_draft')
    expect(filtered).not.toHaveProperty('klicker_lecturer_feedback_draft')
    expect(filtered).not.toHaveProperty(
      'klicker_lecturer_element_create_draft_proposal'
    )
  })

  test('is a no-op on an already read-only toolset', () => {
    const readOnlyTools = fakeToolSet([
      'klicker_lecturer_capabilities',
      'klicker_lecturer_course_list',
    ])
    expect(filterToolsByDraftScope(readOnlyTools, false)).toEqual(readOnlyTools)
  })
})
