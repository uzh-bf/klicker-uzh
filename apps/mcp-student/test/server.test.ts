import { describe, expect, it } from 'vitest'
import { getStudentCapabilities } from '../src/capabilities.js'
import { STUDENT_MCP_TOOL_NAMES } from '../src/toolPolicy.js'

describe('student MCP capabilities', () => {
  it('advertises service metadata and policy summaries for every tool', () => {
    const capabilities = getStudentCapabilities({ mcpEndpoint: '/mcp' })

    expect(capabilities).toMatchObject({
      service: 'mcp-student',
      version: '0.1.0',
      transport: 'httpStream',
      endpoint: '/mcp',
      autonomousWrites: false,
      proposalRequiredForWrites: false,
      humanConfirmationRequiredForWrites: true,
    })
    expect(capabilities.tools.map((tool) => tool.name)).toEqual(
      STUDENT_MCP_TOOL_NAMES
    )

    expect(
      capabilities.tools.find(
        (tool) => tool.name === 'klicker_student_capabilities'
      )
    ).toMatchObject({
      annotations: { readOnlyHint: true },
      category: 'meta',
      rbacScope: ['student:practice:read'],
      requiresHumanConfirmation: false,
      solutionExposure: 'none',
    })
    expect(
      capabilities.tools.find(
        (tool) => tool.name === 'submit_practice_stack_answer'
      )
    ).toMatchObject({
      annotations: { readOnlyHint: false },
      category: 'practice-write',
      rbacScope: ['student:practice:submit'],
      requiresHumanConfirmation: true,
      solutionExposure: 'submission-gated',
    })
  })
})
