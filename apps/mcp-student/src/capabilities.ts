import type { RuntimeSettings } from './config.js'
import {
  STUDENT_MCP_TOOL_NAMES,
  STUDENT_MCP_TOOL_POLICIES,
  type McpToolAnnotations,
  type StudentMcpToolName,
  type ToolPolicy,
} from './toolPolicy.js'

type StudentToolCapability = {
  annotations: Omit<McpToolAnnotations, 'title'>
  category: ToolPolicy['category']
  description: string
  name: StudentMcpToolName
  rbacScope: readonly string[]
  readOnly: boolean
  requiresHumanConfirmation: boolean
  solutionExposure: ToolPolicy['solutionExposure']
}

export type StudentMcpCapabilities = {
  autonomousWrites: false
  endpoint: `/${string}`
  humanConfirmationRequiredForWrites: true
  proposalRequiredForWrites: false
  service: 'mcp-student'
  tools: StudentToolCapability[]
  transport: 'httpStream'
  version: '0.1.0'
}

const STUDENT_TOOL_CAPABILITY_DESCRIPTIONS: Record<StudentMcpToolName, string> =
  {
    get_practice_stack_for_quiz:
      'Fetch full answer-safe render data for a selected practice stack.',
    klicker_student_capabilities:
      'Describe the student MCP service capabilities and tool policy surface.',
    lookup_relevant_practice_stacks:
      'Find answer-safe practice-stack candidates related to the current chat topic.',
    submit_practice_stack_answer:
      'Submit a completed structured stack answer and return backend grading.',
  }

function studentToolCapability(
  name: StudentMcpToolName
): StudentToolCapability {
  const policy = STUDENT_MCP_TOOL_POLICIES[name]

  return {
    annotations: policy.annotations,
    category: policy.category,
    description: STUDENT_TOOL_CAPABILITY_DESCRIPTIONS[name],
    name,
    rbacScope: policy.rbacScope,
    readOnly: policy.annotations.readOnlyHint,
    requiresHumanConfirmation: policy.requiresHumanConfirmation,
    solutionExposure: policy.solutionExposure,
  }
}

export function getStudentCapabilities(
  settings: Pick<RuntimeSettings, 'mcpEndpoint'>
): StudentMcpCapabilities {
  return {
    service: 'mcp-student',
    version: '0.1.0',
    transport: 'httpStream',
    endpoint: settings.mcpEndpoint,
    autonomousWrites: false,
    proposalRequiredForWrites: false,
    humanConfirmationRequiredForWrites: true,
    tools: STUDENT_MCP_TOOL_NAMES.map(studentToolCapability),
  }
}
