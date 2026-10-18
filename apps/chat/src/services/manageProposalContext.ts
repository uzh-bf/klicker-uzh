import {
  type ManageElementCreateProposal,
  readManageProposalToken,
} from './manageProposals'

type ProposalTokenSettings = { issuer: string; secret: string }

export async function resolveLatestManageProposalContext(
  proposalTokens: readonly string[],
  userId: string,
  settings: ProposalTokenSettings
): Promise<ManageElementCreateProposal | null> {
  for (let index = proposalTokens.length - 1; index >= 0; index -= 1) {
    try {
      return await readManageProposalToken(
        proposalTokens[index],
        userId,
        settings
      )
    } catch {
      // A stale, tampered, or foreign token must not break an otherwise valid
      // chat turn. Keep looking for the latest valid signed proposal.
    }
  }

  return null
}
