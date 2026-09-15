import {
  manageElementCreateProposalSchema,
  type ManageElementCreateProposal,
} from './manageProposalSchema'

export type ManageProposalPayload = ManageElementCreateProposal['payload']

// Validate an arbitrary tool-result envelope against the signed proposal
// schema before it is ever mapped to a renderable element preview. Returns
// null on any mismatch so callers can fall back to the raw JSON view instead
// of risking a crashed preview card.
export function parseManageProposalPayload(
  value: unknown
): ManageProposalPayload | null {
  const parsed = manageElementCreateProposalSchema.safeParse(value)
  return parsed.success ? parsed.data.payload : null
}
