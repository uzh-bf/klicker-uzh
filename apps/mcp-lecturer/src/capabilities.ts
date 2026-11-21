import type { RuntimeSettings } from './config.js'
import {
  LECTURER_MCP_TOOL_NAMES,
  LECTURER_MCP_TOOL_POLICIES,
  type LecturerMcpToolName,
  type McpToolAnnotations,
  type ToolPolicy,
} from './toolPolicy.js'

type LecturerToolCapability = {
  annotations: Omit<McpToolAnnotations, 'title'>
  category: ToolPolicy['category']
  description: string
  name: LecturerMcpToolName
  rbacScope: readonly string[]
  readOnly: boolean
  requiresHumanConfirmation: boolean
  solutionExposure: ToolPolicy['solutionExposure']
}

export type LecturerMcpCapabilities = {
  autonomousWrites: false
  endpoint: `/${string}`
  humanConfirmationRequiredForWrites: true
  proposalRequiredForWrites: true
  service: 'mcp-lecturer'
  tools: LecturerToolCapability[]
  transport: 'httpStream'
  version: '0.1.0'
}

const LECTURER_TOOL_CAPABILITY_DESCRIPTIONS: Record<
  LecturerMcpToolName,
  string
> = {
  klicker_lecturer_capabilities:
    'Describe the lecturer MCP scaffold and currently available safe tools.',
  klicker_lecturer_choices_draft:
    'Create validated non-persisted answer-choice draft scaffolding.',
  klicker_lecturer_course_get:
    'Get compact metadata and activity counts for one readable course.',
  klicker_lecturer_course_list:
    'List compact courses the authenticated lecturer can read.',
  klicker_lecturer_element_create_draft_proposal:
    'Create a signed confirmation proposal for a DRAFT question. This never persists data until the lecturer confirms it in Manage assistant UI.',
  klicker_lecturer_element_get:
    'Get one readable question element with capped sanitized details.',
  klicker_lecturer_element_search:
    'Search readable question elements with capped plain-text snippets.',
  klicker_lecturer_feedback_draft:
    'Create validated non-persisted answer-feedback draft scaffolding.',
  klicker_lecturer_question_draft:
    'Create a validated non-persisted question draft payload for lecturer review.',
}

function lecturerToolCapability(
  name: LecturerMcpToolName
): LecturerToolCapability {
  const policy = LECTURER_MCP_TOOL_POLICIES[name]

  return {
    annotations: policy.annotations,
    category: policy.category,
    description: LECTURER_TOOL_CAPABILITY_DESCRIPTIONS[name],
    name,
    rbacScope: policy.rbacScope,
    readOnly: policy.annotations.readOnlyHint,
    requiresHumanConfirmation: policy.requiresHumanConfirmation,
    solutionExposure: policy.solutionExposure,
  }
}

export function getLecturerCapabilities(
  settings: Pick<RuntimeSettings, 'mcpEndpoint'>
): LecturerMcpCapabilities {
  return {
    service: 'mcp-lecturer',
    version: '0.1.0',
    transport: 'httpStream',
    endpoint: settings.mcpEndpoint,
    autonomousWrites: false,
    humanConfirmationRequiredForWrites: true,
    proposalRequiredForWrites: true,
    tools: LECTURER_MCP_TOOL_NAMES.map(lecturerToolCapability),
  }
}
