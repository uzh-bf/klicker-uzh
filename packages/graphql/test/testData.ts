import { ElementType, ObjectAccess } from '@klicker-uzh/prisma'

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

// answer collection 1
export const answerCollection1 = {
  name: 'Answer Collection 1',
  description: 'This is the first answer collection',
  entries: ['entry1', 'entry2', 'entry3', 'entry4'],
}

// answer collection 2
export const answerCollection2 = {
  name: 'Answer Collection 2',
  description: 'This is the second answer collection',
  entries: ['entry5', 'entry6', 'entry7', 'entry8'],
}

// catalog collection 1 (public)
export const catalogCollection1 = {
  name: 'Public Catalog Collection',
  access: ObjectAccess.PUBLIC,
}

// catalog collection 2 (restricted)
export const catalogCollection2 = {
  name: 'Restricted Catalog Collection',
  access: ObjectAccess.RESTRICTED,
}
