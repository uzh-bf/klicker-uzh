import { describe, expect, it } from 'vitest'
import { getLecturerCapabilities } from '../src/capabilities.js'
import { LECTURER_MCP_TOOL_NAMES } from '../src/toolPolicy.js'

describe('lecturer MCP capabilities', () => {
  it('advertises service metadata and policy summaries for every tool', () => {
    const capabilities = getLecturerCapabilities({ mcpEndpoint: '/mcp' })

    expect(capabilities).toMatchObject({
      service: 'mcp-lecturer',
      version: '0.1.0',
      transport: 'httpStream',
      endpoint: '/mcp',
      autonomousWrites: false,
      proposalRequiredForWrites: true,
      humanConfirmationRequiredForWrites: true,
    })
    expect(capabilities.tools.map((tool) => tool.name)).toEqual(
      LECTURER_MCP_TOOL_NAMES
    )
    expect(capabilities.tools.every((tool) => tool.readOnly)).toBe(true)
    expect(
      capabilities.tools.find(
        (tool) => tool.name === 'klicker_lecturer_capabilities'
      )
    ).toMatchObject({
      annotations: { readOnlyHint: true },
      category: 'meta',
      rbacScope: ['manage:read'],
      requiresHumanConfirmation: false,
      solutionExposure: 'none',
    })
    expect(
      capabilities.tools.find(
        (tool) => tool.name === 'klicker_lecturer_element_create_draft_proposal'
      )
    ).toMatchObject({
      annotations: { readOnlyHint: true },
      category: 'proposal',
      rbacScope: ['manage:draft'],
      requiresHumanConfirmation: true,
      solutionExposure: 'lecturer-owned',
    })
  })
})
