import { ElementType } from '@klicker-uzh/prisma'

// mock user 1
export const userOne = {
  id: '60068013-da49-4e47-988e-37fb44dabf9e',
  sub: '60068013-da49-4e47-988e-37fb44dabf9e',
  email: 'first@example.com',
  shortname: 'firstuser',
}

// mock user 2
export const userTwo = {
  id: 'd850db64-eb83-4b84-b7e0-a870ca99d415',
  sub: 'd850db64-eb83-4b84-b7e0-a870ca99d415',
  email: 'second@example.com',
  shortname: 'seconduser',
}

// questions with all possible combinations of sample solutions and answer feedbacks
export const questionsSLAF = [
  {
    name: 'SC NO SL NO AF',
    type: ElementType.SC,
    options: { hasSampleSolution: false, hasAnswerFeedbacks: false },
  },
  {
    name: 'SC WITH SL NO AF',
    type: ElementType.SC,
    options: { hasSampleSolution: true, hasAnswerFeedbacks: false },
  },
  {
    name: 'SC WITH SL WITH AF',
    type: ElementType.SC,
    options: { hasSampleSolution: true, hasAnswerFeedbacks: true },
  },
  {
    name: 'MC NO SL NO AF',
    type: ElementType.MC,
    options: { hasSampleSolution: false, hasAnswerFeedbacks: false },
  },
  {
    name: 'MC WITH SL NO AF',
    type: ElementType.MC,
    options: { hasSampleSolution: true, hasAnswerFeedbacks: false },
  },
  {
    name: 'MC WITH SL WITH AF',
    type: ElementType.MC,
    options: { hasSampleSolution: true, hasAnswerFeedbacks: true },
  },
  {
    name: 'KPRIM NO SL NO AF',
    type: ElementType.KPRIM,
    options: { hasSampleSolution: false, hasAnswerFeedbacks: false },
  },
  {
    name: 'KPRIM WITH SL NO AF',
    type: ElementType.KPRIM,
    options: { hasSampleSolution: true, hasAnswerFeedbacks: false },
  },
  {
    name: 'KPRIM WITH SL WITH AF',
    type: ElementType.KPRIM,
    options: { hasSampleSolution: true, hasAnswerFeedbacks: true },
  },
  {
    name: 'NUMERICAL NO SL',
    type: ElementType.NUMERICAL,
    options: { hasSampleSolution: false },
  },
  {
    name: 'NUMERICAL WITH SL',
    type: ElementType.NUMERICAL,
    options: { hasSampleSolution: true },
  },
  {
    name: 'FREE_TEXT NO SL',
    type: ElementType.FREE_TEXT,
    options: { hasSampleSolution: false },
  },
  {
    name: 'FREE_TEXT WITH SL',
    type: ElementType.FREE_TEXT,
    options: { hasSampleSolution: true },
  },
  {
    name: 'SELECTION NO SL',
    type: ElementType.SELECTION,
    options: { hasSampleSolution: false },
  },
  {
    name: 'SELECTION WITH SL',
    type: ElementType.SELECTION,
    options: { hasSampleSolution: true },
  },
  {
    name: 'CASE_STUDY NO SL',
    type: ElementType.CASE_STUDY,
    options: { hasSampleSolution: false },
  },
  {
    name: 'CASE_STUDY WITH SL',
    type: ElementType.CASE_STUDY,
    options: { hasSampleSolution: true },
  },
  { name: 'FLASHCARD', type: ElementType.FLASHCARD, options: {} },
  { name: 'CONTENT', type: ElementType.CONTENT, options: {} },
]
