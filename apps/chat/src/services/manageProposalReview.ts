import type { ManageProposalPayload } from './proposalToElementInstance'

type ChoicesProposalReview = {
  choices: Array<{
    correct: boolean
    feedback?: string
    value: string
  }>
  content: string
  correctAnswerLabel: 'Correct answer' | 'Correct answers'
  explanation?: string
  kind: 'choices'
  typeLabel: 'Multiple choice' | 'Single choice'
}

type FreeTextProposalReview = {
  content: string
  explanation?: string
  kind: 'freeText'
  maxLength?: number
  solutions: string[]
  typeLabel: 'Free text'
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
      explanation: payload.explanation,
      kind: 'freeText',
      maxLength: payload.options.restrictions.maxLength,
      solutions: payload.options.solutions ?? [],
      typeLabel: 'Free text',
    }
  }

  return {
    choices: payload.options.choices.map((choice) => ({
      correct: choice.correct,
      feedback: choice.feedback,
      value: choice.value,
    })),
    content: payload.content,
    correctAnswerLabel:
      payload.type === 'SC' ? 'Correct answer' : 'Correct answers',
    explanation: payload.explanation,
    kind: 'choices',
    typeLabel: payload.type === 'SC' ? 'Single choice' : 'Multiple choice',
  }
}
