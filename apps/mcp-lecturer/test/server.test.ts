import { describe, expect, it } from 'vitest'
import {
  LECTURER_MCP_TOOL_NAMES,
  getLecturerCapabilities,
} from '../src/server.js'

describe('lecturer MCP capabilities', () => {
  it('advertises only read-only scaffold capabilities', () => {
    const capabilities = getLecturerCapabilities({ mcpEndpoint: '/mcp' })

    expect(capabilities).toMatchObject({
      service: 'mcp-lecturer',
      transport: 'httpStream',
      autonomousWrites: false,
      proposalRequiredForWrites: true,
    })
    expect(capabilities.tools.map((tool) => tool.name)).toEqual([
      'klicker_lecturer_capabilities',
      'klicker_lecturer_course_list',
      'klicker_lecturer_course_get',
      'klicker_lecturer_element_search',
      'klicker_lecturer_element_get',
      'klicker_lecturer_question_draft',
      'klicker_lecturer_choices_draft',
      'klicker_lecturer_feedback_draft',
    ])
    expect(capabilities.tools.every((tool) => tool.readOnly)).toBe(true)
    expect(LECTURER_MCP_TOOL_NAMES).toEqual([
      'klicker_lecturer_capabilities',
      'klicker_lecturer_course_list',
      'klicker_lecturer_course_get',
      'klicker_lecturer_element_search',
      'klicker_lecturer_element_get',
      'klicker_lecturer_question_draft',
      'klicker_lecturer_choices_draft',
      'klicker_lecturer_feedback_draft',
    ])
  })
})
