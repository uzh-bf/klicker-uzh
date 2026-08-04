export const LECTURER_MCP_TOOL_NAMES = [
  'klicker_lecturer_capabilities',
  'klicker_lecturer_course_list',
  'klicker_lecturer_course_get',
  'klicker_lecturer_element_search',
  'klicker_lecturer_element_get',
  'klicker_lecturer_question_draft',
  'klicker_lecturer_choices_draft',
  'klicker_lecturer_feedback_draft',
  'klicker_lecturer_element_create_draft_proposal',
] as const

export type LecturerMcpToolName = (typeof LECTURER_MCP_TOOL_NAMES)[number]

export type McpToolAnnotations = {
  destructiveHint: boolean
  idempotentHint: boolean
  openWorldHint: boolean
  readOnlyHint: boolean
  title?: string
}

export type ToolAudience = 'student' | 'lecturer' | 'any'
export type ToolCategory =
  | 'authoring'
  | 'course-read'
  | 'element-read'
  | 'meta'
  | 'proposal'
export type SolutionExposure = 'none' | 'lecturer-owned'

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

export const LECTURER_MCP_TOOL_POLICIES: Record<
  LecturerMcpToolName,
  ToolPolicy
> = {
  klicker_lecturer_capabilities: {
    annotations: READ_ONLY,
    audience: 'lecturer',
    category: 'meta',
    rbacScope: ['manage:read'],
    requiresHumanConfirmation: false,
    solutionExposure: 'none',
  },
  klicker_lecturer_choices_draft: {
    annotations: READ_ONLY,
    audience: 'lecturer',
    category: 'authoring',
    rbacScope: ['manage:draft'],
    requiresHumanConfirmation: false,
    solutionExposure: 'lecturer-owned',
  },
  klicker_lecturer_course_get: {
    annotations: READ_ONLY,
    audience: 'lecturer',
    category: 'course-read',
    rbacScope: ['manage:read'],
    requiresHumanConfirmation: false,
    solutionExposure: 'none',
  },
  klicker_lecturer_course_list: {
    annotations: READ_ONLY,
    audience: 'lecturer',
    category: 'course-read',
    rbacScope: ['manage:read'],
    requiresHumanConfirmation: false,
    solutionExposure: 'none',
  },
  klicker_lecturer_element_create_draft_proposal: {
    annotations: READ_ONLY,
    audience: 'lecturer',
    category: 'proposal',
    rbacScope: ['manage:draft'],
    requiresHumanConfirmation: true,
    solutionExposure: 'lecturer-owned',
  },
  klicker_lecturer_element_get: {
    annotations: READ_ONLY,
    audience: 'lecturer',
    category: 'element-read',
    rbacScope: ['manage:read'],
    requiresHumanConfirmation: false,
    solutionExposure: 'lecturer-owned',
  },
  klicker_lecturer_element_search: {
    annotations: READ_ONLY,
    audience: 'lecturer',
    category: 'element-read',
    rbacScope: ['manage:read'],
    requiresHumanConfirmation: false,
    solutionExposure: 'lecturer-owned',
  },
  klicker_lecturer_feedback_draft: {
    annotations: READ_ONLY,
    audience: 'lecturer',
    category: 'authoring',
    rbacScope: ['manage:draft'],
    requiresHumanConfirmation: false,
    solutionExposure: 'lecturer-owned',
  },
  klicker_lecturer_question_draft: {
    annotations: READ_ONLY,
    audience: 'lecturer',
    category: 'authoring',
    rbacScope: ['manage:draft'],
    requiresHumanConfirmation: false,
    solutionExposure: 'lecturer-owned',
  },
}

export function toolDefinition(
  name: LecturerMcpToolName,
  title: string
): { annotations: McpToolAnnotations; name: LecturerMcpToolName } {
  return {
    annotations: {
      ...LECTURER_MCP_TOOL_POLICIES[name].annotations,
      title,
    },
    name,
  }
}
