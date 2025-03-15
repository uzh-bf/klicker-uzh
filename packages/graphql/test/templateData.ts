import { ElementType } from '@klicker-uzh/prisma'

// mock user 1
export const userOne = {
  id: 'b086deed-291d-4dc3-9271-c84d4c2840f2',
  sub: 'b086deed-291d-4dc3-9271-c84d4c2840f2',
  email: 'first@example.com',
  shortname: 'firstuser',
}

// mock user 2
export const userTwo = {
  id: '5deec433-7ead-4c9c-9f6d-96cd5ef1758a',
  sub: '5deec433-7ead-4c9c-9f6d-96cd5ef1758a',
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
