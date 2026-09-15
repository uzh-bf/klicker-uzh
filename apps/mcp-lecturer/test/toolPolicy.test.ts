import { describe, expect, it } from 'vitest'
import type { LecturerMcpSession } from '../src/auth.js'
import {
  CUMULATIVE_WRITE,
  IDEMPOTENT_WRITE,
  LECTURER_MCP_TOOL_NAMES,
  LECTURER_MCP_TOOL_POLICIES,
  READ_ONLY,
  toolDefinition,
} from '../src/toolPolicy.js'

describe('lecturer MCP tool policy', () => {
  it('defines policy metadata for every registered tool', () => {
    expect(
      Object.keys(LECTURER_MCP_TOOL_POLICIES).sort((a, b) => a.localeCompare(b))
    ).toEqual([...LECTURER_MCP_TOOL_NAMES].sort((a, b) => a.localeCompare(b)))

    for (const toolName of LECTURER_MCP_TOOL_NAMES) {
      const policy = LECTURER_MCP_TOOL_POLICIES[toolName]

      expect(policy.audience).toBe('lecturer')
      expect(policy.annotations.openWorldHint).toBe(false)
      expect(policy.rbacScope.length).toBeGreaterThan(0)
      expect(policy.solutionExposure).toMatch(/^(none|lecturer-owned)$/)
    }
  })

  it('marks read tools as read-only manage-read tools', () => {
    for (const toolName of [
      'klicker_lecturer_capabilities',
      'klicker_lecturer_course_list',
      'klicker_lecturer_course_get',
      'klicker_lecturer_element_search',
      'klicker_lecturer_element_get',
    ] as const) {
      expect(LECTURER_MCP_TOOL_POLICIES[toolName]).toMatchObject({
        annotations: READ_ONLY,
        rbacScope: ['manage:read'],
        requiresHumanConfirmation: false,
      })
    }
  })

  it('marks draft and proposal tools with draft scope', () => {
    for (const toolName of [
      'klicker_lecturer_question_draft',
      'klicker_lecturer_choices_draft',
      'klicker_lecturer_feedback_draft',
    ] as const) {
      expect(LECTURER_MCP_TOOL_POLICIES[toolName]).toMatchObject({
        annotations: READ_ONLY,
        category: 'authoring',
        rbacScope: ['manage:draft'],
        requiresHumanConfirmation: false,
        solutionExposure: 'lecturer-owned',
      })
    }

    expect(
      LECTURER_MCP_TOOL_POLICIES.klicker_lecturer_element_create_draft_proposal
    ).toMatchObject({
      annotations: READ_ONLY,
      category: 'proposal',
      rbacScope: ['manage:draft'],
      requiresHumanConfirmation: true,
      solutionExposure: 'lecturer-owned',
    })
  })

  it('keeps write presets available for future lecturer tools', () => {
    expect(IDEMPOTENT_WRITE).toMatchObject({
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      readOnlyHint: false,
    })
    expect(CUMULATIVE_WRITE).toMatchObject({
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
      readOnlyHint: false,
    })
  })

  it('adds titles without mutating shared annotation presets', () => {
    const definition = toolDefinition(
      'klicker_lecturer_course_list',
      'List Courses'
    )

    expect(definition).toMatchObject({
      name: 'klicker_lecturer_course_list',
      annotations: {
        ...READ_ONLY,
        title: 'List Courses',
      },
    })
    expect(READ_ONLY).not.toHaveProperty('title')
  })

  // fastmcp evaluates canAccess when it builds the session and only registers
  // the tools that pass, so a rejected tool is unknown to that session rather
  // than merely hidden from tools/list.
  it('gates every tool on the scopes its policy declares', () => {
    const readOnlySession: LecturerMcpSession = {
      bearerToken: 'token',
      scopes: ['manage:read'],
      userId: 'lecturer-1',
    }
    const fullSession: LecturerMcpSession = {
      ...readOnlySession,
      scopes: ['manage:read', 'manage:draft'],
    }

    for (const name of LECTURER_MCP_TOOL_NAMES) {
      const { canAccess } = toolDefinition(name, name)
      const needsDraft =
        LECTURER_MCP_TOOL_POLICIES[name].rbacScope.includes('manage:draft')

      expect(canAccess(readOnlySession)).toBe(!needsDraft)
      expect(canAccess(fullSession)).toBe(true)
    }
  })
})
