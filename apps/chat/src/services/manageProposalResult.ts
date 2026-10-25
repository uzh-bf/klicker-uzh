import { unfenceToolResultText } from './toolFenceSyntax'

export const MANAGE_PROPOSAL_TOOL_PART_TYPE =
  'tool-klicker_lecturer_element_create_draft_proposal'

export type ManageProposalResult = {
  kind: string
  proposalToken?: string
  summary?: string
  requiresConfirmation: boolean
  payload: unknown
}

export function isManageProposalResult(
  value: unknown
): value is ManageProposalResult {
  if (!value || typeof value !== 'object') return false

  const record = value as Record<string, unknown>
  return (
    typeof record.kind === 'string' &&
    typeof record.requiresConfirmation === 'boolean' &&
    'payload' in record &&
    (record.proposalToken === undefined ||
      typeof record.proposalToken === 'string') &&
    (record.summary === undefined || typeof record.summary === 'string')
  )
}

export function getManageProposalResult(
  value: unknown
): ManageProposalResult | null {
  if (isManageProposalResult(value)) return value
  if (!value || typeof value !== 'object') return null

  const content = (value as { content?: unknown }).content
  if (!Array.isArray(content)) return null

  for (const item of content) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (record.type !== 'text' || typeof record.text !== 'string') continue

    try {
      const parsed = JSON.parse(unfenceToolResultText(record.text))
      if (isManageProposalResult(parsed)) return parsed
    } catch {
      // Ignore non-JSON MCP text payloads and keep looking.
    }
  }

  return null
}

export function getManageProposalTokenFromToolPart(
  value: unknown
): string | null {
  if (!value || typeof value !== 'object') return null

  const part = value as Record<string, unknown>
  if (
    part.type !== MANAGE_PROPOSAL_TOOL_PART_TYPE ||
    part.state !== 'output-available'
  ) {
    return null
  }

  const proposal = getManageProposalResult(part.output)
  const token = proposal?.proposalToken?.trim()
  return token || null
}
