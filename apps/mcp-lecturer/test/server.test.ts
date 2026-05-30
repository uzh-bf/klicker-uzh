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
    ])
    expect(capabilities.tools.every((tool) => tool.readOnly)).toBe(true)
    expect(LECTURER_MCP_TOOL_NAMES).toEqual(['klicker_lecturer_capabilities'])
  })
})
