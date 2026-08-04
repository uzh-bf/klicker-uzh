import {
  ElementDisplayMode,
  ElementInstanceType,
  ElementType,
  type ElementInstance,
} from '@klicker-uzh/graphql/dist/ops'
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

// Map a validated proposal payload to the same artificial ElementInstance
// shape used elsewhere to preview not-yet-persisted questions (see
// useArtificialElementInstance). The top-level ElementInstance.options is
// never read by StudentElement, so it is intentionally omitted.
export function proposalPayloadToElementInstance(
  payload: ManageProposalPayload
): ElementInstance {
  const elementType = payload.type as ElementType

  const shared = {
    basePoints: payload.basePoints,
    content: payload.content,
    elementId: 0,
    explanation: payload.explanation,
    id: '0',
    name: payload.name,
    pointsMultiplier: payload.pointsMultiplier,
    type: elementType,
  }

  const elementData =
    payload.type === 'FREE_TEXT'
      ? {
          __typename: 'FreeTextElementData' as const,
          ...shared,
          options: {
            hasSampleSolution: payload.options.hasSampleSolution,
            restrictions: payload.options.restrictions,
          },
        }
      : {
          __typename: 'ChoicesElementData' as const,
          ...shared,
          options: {
            choices: payload.options.choices.map((choice, ix) => ({
              ...choice,
              ix: choice.ix ?? ix,
            })),
            displayMode: ElementDisplayMode.List,
            hasAnswerFeedbacks: payload.options.hasAnswerFeedbacks,
            hasSampleSolution: payload.options.hasSampleSolution,
          },
        }

  return {
    elementData,
    elementType,
    id: 0,
    type: ElementInstanceType.LiveQuiz,
  } as ElementInstance
}
