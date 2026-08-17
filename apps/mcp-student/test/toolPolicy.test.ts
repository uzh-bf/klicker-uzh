import { describe, expect, it } from 'vitest'
import {
  CUMULATIVE_WRITE,
  IDEMPOTENT_WRITE,
  READ_ONLY,
  STUDENT_MCP_TOOL_NAMES,
  STUDENT_MCP_TOOL_POLICIES,
  toolDefinition,
} from '../src/toolPolicy.js'

describe('student MCP tool policy', () => {
  it('defines policy metadata for every registered tool', () => {
    expect(
      Object.keys(STUDENT_MCP_TOOL_POLICIES).sort((a, b) => a.localeCompare(b))
    ).toEqual([...STUDENT_MCP_TOOL_NAMES].sort((a, b) => a.localeCompare(b)))

    for (const toolName of STUDENT_MCP_TOOL_NAMES) {
      const policy = STUDENT_MCP_TOOL_POLICIES[toolName]

      expect(policy.audience).toBe('student')
      expect(policy.annotations.openWorldHint).toBe(false)
      expect(policy.rbacScope.length).toBeGreaterThan(0)
      expect(policy.solutionExposure).toMatch(/^(none|submission-gated)$/)
    }
  })

  it('marks the capability tool as read-only metadata', () => {
    expect(
      STUDENT_MCP_TOOL_POLICIES.klicker_student_capabilities
    ).toMatchObject({
      annotations: READ_ONLY,
      category: 'meta',
      rbacScope: ['student:practice:read'],
      requiresHumanConfirmation: false,
      solutionExposure: 'none',
    })
  })

  it('classifies answer submission as a confirmed cumulative write', () => {
    expect(
      STUDENT_MCP_TOOL_POLICIES.submit_practice_stack_answer
    ).toMatchObject({
      annotations: CUMULATIVE_WRITE,
      category: 'practice-write',
      rbacScope: ['student:practice:submit'],
      requiresHumanConfirmation: true,
      solutionExposure: 'submission-gated',
    })
  })

  it('keeps read tools non-destructive and read-only', () => {
    expect(
      STUDENT_MCP_TOOL_POLICIES.lookup_relevant_practice_stacks
    ).toMatchObject({
      annotations: READ_ONLY,
      category: 'practice-read',
      requiresHumanConfirmation: false,
    })
    expect(STUDENT_MCP_TOOL_POLICIES.get_practice_stack_for_quiz).toMatchObject(
      {
        annotations: READ_ONLY,
        category: 'practice-read',
        requiresHumanConfirmation: false,
      }
    )
  })

  it('keeps the idempotent write preset available for future student tools', () => {
    expect(IDEMPOTENT_WRITE).toMatchObject({
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      readOnlyHint: false,
    })
  })

  it('adds titles without mutating shared annotation presets', () => {
    const definition = toolDefinition(
      'lookup_relevant_practice_stacks',
      'Lookup'
    )

    expect(definition).toMatchObject({
      name: 'lookup_relevant_practice_stacks',
      annotations: {
        ...READ_ONLY,
        title: 'Lookup',
      },
    })
    expect(READ_ONLY).not.toHaveProperty('title')
  })
})
