import type {
  ElementData,
  ElementInstance,
  ElementStack,
} from '@klicker-uzh/graphql/dist/ops'
import {
  ElementDisplayMode,
  ElementInstanceType,
  ElementStackType,
  ElementType,
  FlashcardCorrectness,
  StackFeedbackStatus,
} from '@klicker-uzh/graphql/dist/ops'
import type { StackStudentResponseType } from '@klicker-uzh/shared-components/src/StudentElement'
import assert from 'node:assert/strict'
import {
  createMemoryOfflinePracticeStorage,
  listOfflinePracticeAttempts,
  type OfflinePracticeSnapshot,
} from '../src/lib/offlinePracticeStorage'
import {
  attachPracticeStackEvaluations,
  createLocalPracticeStackFeedback,
  serializePracticeStackResponses,
  submitPracticeStackOffline,
  submitPracticeStackOnline,
} from '../src/lib/practiceStackResponse'

function element(
  id: number,
  elementType: ElementType,
  elementData: ElementData
): ElementInstance {
  return {
    __typename: 'ElementInstance',
    id,
    type: ElementInstanceType.PracticeQuiz,
    elementType,
    elementData,
  } as ElementInstance
}

function baseElementData(id: number, type: ElementType) {
  return {
    elementId: id,
    id: String(id),
    name: `${type} element`,
    content: `${type} content`,
    explanation: `${type} explanation`,
    basePoints: true,
    pointsMultiplier: 1,
    type,
  }
}

const stack = {
  __typename: 'ElementStack',
  id: 100,
  type: ElementStackType.PracticeQuiz,
  displayName: 'Downloaded stack',
  elements: [
    element(1, ElementType.Sc, {
      __typename: 'ChoicesElementData',
      ...baseElementData(1, ElementType.Sc),
      options: {
        hasSampleSolution: true,
        hasAnswerFeedbacks: true,
        displayMode: ElementDisplayMode.List,
        choices: [
          { ix: 0, value: 'A', correct: true, feedback: 'yes' },
          { ix: 1, value: 'B', correct: false, feedback: 'no' },
        ],
      },
    } as ElementData),
    element(2, ElementType.Mc, {
      __typename: 'ChoicesElementData',
      ...baseElementData(2, ElementType.Mc),
      options: {
        hasSampleSolution: true,
        hasAnswerFeedbacks: true,
        displayMode: ElementDisplayMode.List,
        choices: [
          { ix: 0, value: 'A', correct: true },
          { ix: 1, value: 'B', correct: true },
          { ix: 2, value: 'C', correct: false },
        ],
      },
    } as ElementData),
    element(3, ElementType.Kprim, {
      __typename: 'ChoicesElementData',
      ...baseElementData(3, ElementType.Kprim),
      options: {
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
        displayMode: ElementDisplayMode.Grid,
        choices: [
          { ix: 0, value: 'A', correct: true },
          { ix: 1, value: 'B', correct: true },
          { ix: 2, value: 'C', correct: true },
          { ix: 3, value: 'D', correct: true },
        ],
      },
    } as ElementData),
    element(4, ElementType.Numerical, {
      __typename: 'NumericalElementData',
      ...baseElementData(4, ElementType.Numerical),
      options: {
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
        accuracy: 2,
        exactSolutions: [42],
        solutionRanges: [],
      },
    } as ElementData),
    element(5, ElementType.FreeText, {
      __typename: 'FreeTextElementData',
      ...baseElementData(5, ElementType.FreeText),
      options: {
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
        solutions: ['answer'],
      },
    } as ElementData),
    element(6, ElementType.Selection, {
      __typename: 'SelectionElementData',
      ...baseElementData(6, ElementType.Selection),
      options: {
        hasSampleSolution: true,
        numberOfInputs: 2,
        answerCollection: {
          id: 10,
          entries: [
            { id: 11, value: 'Alpha' },
            { id: 12, value: 'Beta' },
            { id: 13, value: 'Gamma' },
          ],
        },
        answerCollectionSolutionIds: [11, 12],
      },
    } as ElementData),
    element(7, ElementType.CaseStudy, {
      __typename: 'CaseStudyElementData',
      ...baseElementData(7, ElementType.CaseStudy),
      options: {
        hasSampleSolution: true,
        answerCollectionId: 10,
        items: [{ id: 1, value: 'Item' }],
        criteria: [
          {
            id: 'criterion-a',
            name: 'Criterion',
            min: 0,
            max: 5,
            step: 1,
          },
        ],
        cases: [
          {
            id: 'case-a',
            title: 'Case',
            description: 'Case description',
            solutions: [
              {
                itemId: 1,
                criteriaSolutions: [
                  { criterionId: 'criterion-a', min: 2, max: 3 },
                ],
              },
            ],
          },
        ],
      },
    } as ElementData),
    element(8, ElementType.Flashcard, {
      __typename: 'FlashcardElementData',
      ...baseElementData(8, ElementType.Flashcard),
    } as ElementData),
    element(9, ElementType.Content, {
      __typename: 'ContentElementData',
      ...baseElementData(9, ElementType.Content),
    } as ElementData),
  ],
} as ElementStack

const studentResponse: StackStudentResponseType = {
  1: { type: ElementType.Sc, response: { 0: true }, valid: true },
  2: { type: ElementType.Mc, response: { 0: true }, valid: true },
  3: {
    type: ElementType.Kprim,
    response: { 0: true, 1: true, 2: true, 3: false },
    valid: true,
  },
  4: { type: ElementType.Numerical, response: '42', valid: true },
  5: { type: ElementType.FreeText, response: 'Answer', valid: true },
  6: { type: ElementType.Selection, response: { 0: 11, 1: 12 }, valid: true },
  7: {
    type: ElementType.CaseStudy,
    response: {
      'case-a': {
        1: {
          'criterion-a': 2,
        },
      },
    },
    valid: true,
  },
  8: {
    type: ElementType.Flashcard,
    response: FlashcardCorrectness.Partial,
    valid: true,
  },
  9: { type: ElementType.Content, response: true, valid: true },
}

const snapshot = {
  schemaVersion: 1,
  quizRevision: 'quiz-id:2026-06-07T10:00:00.000Z',
  downloadedAt: '2026-06-07T10:00:00.000Z',
  validUntil: '2026-07-07T10:00:00.000Z',
  assetManifest: [],
  quiz: {
    id: 'quiz-id',
    displayName: 'Downloaded quiz',
    course: {
      id: 'course-id',
      displayName: 'Course',
    },
  },
} as unknown as OfflinePracticeSnapshot

const noSampleSolutionStack = {
  __typename: 'ElementStack',
  id: 101,
  type: ElementStackType.PracticeQuiz,
  displayName: 'No sample solution stack',
  elements: [
    element(10, ElementType.Sc, {
      __typename: 'ChoicesElementData',
      ...baseElementData(10, ElementType.Sc),
      options: {
        hasSampleSolution: false,
        hasAnswerFeedbacks: false,
        displayMode: ElementDisplayMode.List,
        choices: [
          { ix: 0, value: 'A', correct: true },
          { ix: 1, value: 'B', correct: false },
        ],
      },
    } as ElementData),
    element(11, ElementType.Numerical, {
      __typename: 'NumericalElementData',
      ...baseElementData(11, ElementType.Numerical),
      options: {
        hasSampleSolution: false,
        hasAnswerFeedbacks: false,
        exactSolutions: [99],
        solutionRanges: [{ min: 100, max: 110 }],
      },
    } as ElementData),
    element(12, ElementType.FreeText, {
      __typename: 'FreeTextElementData',
      ...baseElementData(12, ElementType.FreeText),
      options: {
        hasSampleSolution: false,
        hasAnswerFeedbacks: false,
        solutions: ['hidden'],
      },
    } as ElementData),
  ],
} as ElementStack

const noSampleSolutionResponses = [
  {
    instanceId: 10,
    type: ElementType.Sc,
    choicesResponse: [{ ix: 1, selected: true }],
  },
  {
    instanceId: 11,
    type: ElementType.Numerical,
    numericalResponse: 13,
  },
  {
    instanceId: 12,
    type: ElementType.FreeText,
    freeTextResponse: 'wrong',
  },
]

async function run() {
  const responses = serializePracticeStackResponses(studentResponse)
  const responseById = new Map(
    responses.map((response) => [response.instanceId, response])
  )

  assert.deepEqual(responseById.get(1), {
    instanceId: 1,
    type: ElementType.Sc,
    choicesResponse: [{ ix: 0, selected: true }],
  })
  assert.deepEqual(responseById.get(3), {
    instanceId: 3,
    type: ElementType.Kprim,
    choicesResponse: [
      { ix: 0, selected: true },
      { ix: 1, selected: true },
      { ix: 2, selected: true },
    ],
  })
  assert.deepEqual(responseById.get(4), {
    instanceId: 4,
    type: ElementType.Numerical,
    numericalResponse: 42,
  })
  assert.deepEqual(responseById.get(6), {
    instanceId: 6,
    type: ElementType.Selection,
    selectionResponse: [11, 12],
  })
  assert.deepEqual(responseById.get(7), {
    instanceId: 7,
    type: ElementType.CaseStudy,
    caseStudyResponse: [
      {
        caseId: 'case-a',
        itemResponses: [
          {
            itemId: 1,
            criterionResponses: [{ criterionId: 'criterion-a', response: 2 }],
          },
        ],
      },
    ],
  })

  const feedback = createLocalPracticeStackFeedback({ stack, responses })
  assert.equal(feedback.status, StackFeedbackStatus.Partial)
  assert.equal(feedback.score, 58)
  assert.equal(feedback.evaluations?.length, 7)

  const evaluationById = new Map(
    feedback.evaluations?.map((evaluation) => [
      evaluation.instanceId,
      evaluation,
    ])
  )
  assert.equal(evaluationById.get(1)?.correctness, 1)
  assert.ok(
    Math.abs((evaluationById.get(2)?.correctness ?? 0) - 1 / 3) < Number.EPSILON
  )
  assert.equal(evaluationById.get(3)?.correctness, 0.5)
  assert.equal(evaluationById.get(4)?.score, 10)
  assert.equal(evaluationById.get(5)?.score, 10)
  assert.equal(evaluationById.get(6)?.score, 10)
  assert.equal(evaluationById.get(7)?.score, 10)
  assert.equal(evaluationById.get(8), undefined)
  assert.equal(evaluationById.get(9), undefined)

  const caseStudyEvaluation = evaluationById.get(7)
  assert.equal(caseStudyEvaluation?.__typename, 'CaseStudyInstanceEvaluation')
  if (caseStudyEvaluation?.__typename !== 'CaseStudyInstanceEvaluation') {
    throw new Error('Expected case study evaluation')
  }
  assert.deepEqual(caseStudyEvaluation.assessments, [
    {
      __typename: 'SingleCaseStudyResponse',
      caseId: 'case-a',
      itemId: 1,
      criterionId: 'criterion-a',
      responseValues: [2],
    },
  ])

  const storedResponse = attachPracticeStackEvaluations({
    studentResponse,
    evaluations: feedback.evaluations,
  })
  assert.equal(
    storedResponse[1]?.evaluation?.__typename,
    'ChoicesInstanceEvaluation'
  )
  assert.equal(storedResponse[8]?.evaluation, undefined)

  const noSampleSolutionFeedback = createLocalPracticeStackFeedback({
    stack: noSampleSolutionStack,
    responses: noSampleSolutionResponses,
  })
  assert.equal(noSampleSolutionFeedback.status, StackFeedbackStatus.Correct)
  assert.equal(noSampleSolutionFeedback.score, 30)

  const noSampleEvaluationById = new Map(
    noSampleSolutionFeedback.evaluations?.map((evaluation) => [
      evaluation.instanceId,
      evaluation,
    ])
  )
  assert.equal(noSampleEvaluationById.get(10)?.correctness, 1)
  assert.equal(noSampleEvaluationById.get(11)?.correctness, 1)
  assert.equal(noSampleEvaluationById.get(12)?.correctness, 1)

  const noSampleNumericalEvaluation = noSampleEvaluationById.get(11)
  assert.equal(
    noSampleNumericalEvaluation?.__typename,
    'NumericalInstanceEvaluation'
  )
  if (
    noSampleNumericalEvaluation?.__typename !== 'NumericalInstanceEvaluation'
  ) {
    throw new Error('Expected numerical evaluation')
  }
  assert.deepEqual(noSampleNumericalEvaluation.exactSolutions, [])
  assert.deepEqual(noSampleNumericalEvaluation.solutionRanges, [])

  const noSampleFreeTextEvaluation = noSampleEvaluationById.get(12)
  assert.equal(
    noSampleFreeTextEvaluation?.__typename,
    'FreeTextInstanceEvaluation'
  )
  if (noSampleFreeTextEvaluation?.__typename !== 'FreeTextInstanceEvaluation') {
    throw new Error('Expected free text evaluation')
  }
  assert.deepEqual(noSampleFreeTextEvaluation.solutions, [])

  let onlineVariables: unknown
  const onlineFeedback = await submitPracticeStackOnline({
    respondToElementStack: async ({ variables }) => {
      onlineVariables = variables
      return {
        data: {
          respondToElementStack: feedback,
        },
      }
    },
    isOwner: false,
    stackId: stack.id,
    courseId: 'course-id',
    stackAnswerTime: 12,
    responses,
  })
  assert.deepEqual(onlineVariables, {
    isOwner: false,
    stackId: stack.id,
    courseId: 'course-id',
    stackAnswerTime: 12,
    responses,
  })
  assert.deepEqual(onlineFeedback, feedback)

  const storage = createMemoryOfflinePracticeStorage()
  const offlineFeedback = await submitPracticeStackOffline({
    participantId: 'participant-id',
    snapshot,
    stack,
    responses,
    stackAnswerTime: 12,
    storage,
  })
  const attempts = await listOfflinePracticeAttempts(
    'participant-id',
    storage,
    'pending'
  )
  assert.equal(attempts.length, 1)
  assert.equal(attempts[0]?.quizRevision, snapshot.quizRevision)
  assert.deepEqual(attempts[0]?.localEvaluation, offlineFeedback)
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
