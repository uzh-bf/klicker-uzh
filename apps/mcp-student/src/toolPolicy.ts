export const STUDENT_MCP_TOOL_NAMES = [
  'klicker_student_capabilities',
  'lookup_relevant_practice_stacks',
  'get_practice_stack_for_quiz',
  'submit_practice_stack_answer',
] as const

export type StudentMcpToolName = (typeof STUDENT_MCP_TOOL_NAMES)[number]

export type McpToolAnnotations = {
  destructiveHint: boolean
  idempotentHint: boolean
  openWorldHint: boolean
  readOnlyHint: boolean
  title?: string
}

export type ToolAudience = 'student' | 'lecturer' | 'any'
export type ToolCategory = 'meta' | 'practice-read' | 'practice-write'
export type SolutionExposure = 'none' | 'submission-gated'

export type ToolPolicy = {
  annotations: Omit<McpToolAnnotations, 'title'>
  audience: ToolAudience
  category: ToolCategory
  rbacScope: readonly string[]
  requiresHumanConfirmation: boolean
  solutionExposure: SolutionExposure
}

export const READ_ONLY: Omit<McpToolAnnotations, 'title'> = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: true,
}

export const IDEMPOTENT_WRITE: Omit<McpToolAnnotations, 'title'> = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: false,
}

export const CUMULATIVE_WRITE: Omit<McpToolAnnotations, 'title'> = {
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
  readOnlyHint: false,
}

export const STUDENT_MCP_TOOL_POLICIES: Record<StudentMcpToolName, ToolPolicy> =
  {
    get_practice_stack_for_quiz: {
      annotations: READ_ONLY,
      audience: 'student',
      category: 'practice-read',
      rbacScope: ['student:practice:read'],
      requiresHumanConfirmation: false,
      solutionExposure: 'none',
    },
    klicker_student_capabilities: {
      annotations: READ_ONLY,
      audience: 'student',
      category: 'meta',
      rbacScope: ['student:practice:read'],
      requiresHumanConfirmation: false,
      solutionExposure: 'none',
    },
    lookup_relevant_practice_stacks: {
      annotations: READ_ONLY,
      audience: 'student',
      category: 'practice-read',
      rbacScope: ['student:practice:read'],
      requiresHumanConfirmation: false,
      solutionExposure: 'none',
    },
    submit_practice_stack_answer: {
      annotations: CUMULATIVE_WRITE,
      audience: 'student',
      category: 'practice-write',
      rbacScope: ['student:practice:submit'],
      requiresHumanConfirmation: true,
      solutionExposure: 'submission-gated',
    },
  }

export function toolDefinition(
  name: StudentMcpToolName,
  title: string
): { annotations: McpToolAnnotations; name: StudentMcpToolName } {
  return {
    annotations: {
      ...STUDENT_MCP_TOOL_POLICIES[name].annotations,
      title,
    },
    name,
  }
}
