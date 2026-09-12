import { MAX_TOOL_NAME_LENGTH } from '@/src/lib/config/toolNames'

export const REQUIRED_MCP_UNAVAILABLE_CODE = 'REQUIRED_MCP_UNAVAILABLE'

export class RequiredMCPUnavailableError extends Error {
  readonly code = REQUIRED_MCP_UNAVAILABLE_CODE

  constructor() {
    super('Required MCP tool is unavailable')
    this.name = 'RequiredMCPUnavailableError'
  }
}

export type MCPRuntimePolicy =
  | { required: false }
  | { required: true; toolAlias: string }

const TOOL_NAME_RE = new RegExp(`^[A-Za-z0-9_-]{1,${MAX_TOOL_NAME_LENGTH}}$`)

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Reads the reserved MCP runtime policy from the existing config JSON.
 * Configs without either reserved key retain the historical optional behavior.
 */
export function parseMCPRuntimePolicy(parameters: unknown): MCPRuntimePolicy {
  if (!isRecord(parameters)) return { required: false }

  const hasRequired = 'required' in parameters
  const hasToolAlias = 'toolAlias' in parameters
  if (!hasRequired && !hasToolAlias) return { required: false }

  if (
    !hasRequired ||
    !hasToolAlias ||
    parameters.required !== true ||
    typeof parameters.toolAlias !== 'string' ||
    !TOOL_NAME_RE.test(parameters.toolAlias)
  ) {
    throw new RequiredMCPUnavailableError()
  }

  return { required: true, toolAlias: parameters.toolAlias }
}
