import type { ManageProposalPayload } from './proposalToElementInstance'

type ChoicesProposalReview = {
  choices: Array<{
    correct: boolean
    feedback?: string
    value: string
  }>
  content: string
  elementType: 'MC' | 'SC'
  explanation?: string
  kind: 'choices'
}

type FreeTextProposalReview = {
  content: string
  elementType: 'FREE_TEXT'
  explanation?: string
  kind: 'freeText'
  maxLength?: number
  solutions: string[]
}

export type ManageProposalReview =
  | ChoicesProposalReview
  | FreeTextProposalReview

export function buildManageProposalReview(
  payload: ManageProposalPayload
): ManageProposalReview {
  if (payload.type === 'FREE_TEXT') {
    return {
      content: payload.content,
      elementType: 'FREE_TEXT',
      explanation: payload.explanation,
      kind: 'freeText',
      maxLength: payload.options.restrictions.maxLength,
      solutions: payload.options.solutions ?? [],
    }
  }

  return {
    choices: payload.options.choices.map((choice) => ({
      correct: choice.correct,
      feedback: choice.feedback,
      value: choice.value,
    })),
    content: payload.content,
    elementType: payload.type,
    explanation: payload.explanation,
    kind: 'choices',
  }
}
