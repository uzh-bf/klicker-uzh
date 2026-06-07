import {
  computeAwardedXp,
  computeSimpleAwardedPoints,
  gradeQuestionCaseStudy,
  gradeQuestionFreeText,
  gradeQuestionKPRIM,
  gradeQuestionMC,
  gradeQuestionNumerical,
  gradeQuestionSC,
  gradeQuestionSelection,
} from '@klicker-uzh/grading'
import type {
  CaseStudyCaseResponse,
  ElementInstance,
  ElementStack,
  RespondToElementStackMutation,
  RespondToElementStackMutationVariables,
  StackResponseInput,
} from '@klicker-uzh/graphql/dist/ops'
import {
  ElementType,
  FlashcardCorrectness,
  FlashcardCorrectnessType,
  StackFeedbackStatus,
} from '@klicker-uzh/graphql/dist/ops'
import type {
  CaseStudyStudentResponseType,
  StackStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import {
  saveOfflinePracticeAttempt,
  type OfflinePracticeSnapshot,
  type OfflinePracticeStorageAdapter,
} from './offlinePracticeStorage'

const POINTS_PER_INSTANCE = 10

export type PracticeStackFeedback = NonNullable<
  RespondToElementStackMutation['respondToElementStack']
>
type PracticeStackEvaluation = NonNullable<
  PracticeStackFeedback['evaluations']
>[number]

export type PracticeStackSubmitMutation = (options: {
  variables: RespondToElementStackMutationVariables
}) => Promise<{ data?: RespondToElementStackMutation | null }>

export interface SubmitPracticeStackOnlineArgs {
  respondToElementStack: PracticeStackSubmitMutation
  isOwner: boolean
  stackId: number
  courseId: string
  stackAnswerTime: number
  responses: StackResponseInput[]
}

export interface SubmitPracticeStackOfflineArgs {
  participantId: string
  snapshot: OfflinePracticeSnapshot
  stack: ElementStack
  responses: StackResponseInput[]
  stackAnswerTime: number
  storage?: OfflinePracticeStorageAdapter
}

export function serializePracticeStackResponses(
  studentResponse: StackStudentResponseType
): StackResponseInput[] {
  return Object.entries(studentResponse).map(([instanceId, value]) => {
    const parsedInstanceId = parseInt(instanceId)

    if (value.type === ElementType.Flashcard) {
      return {
        instanceId: parsedInstanceId,
        type: ElementType.Flashcard,
        flashcardResponse: toInputFlashcardCorrectness(value.response),
      }
    }

    if (value.type === ElementType.Content) {
      return {
        instanceId: parsedInstanceId,
        type: ElementType.Content,
        contentReponse: value.response,
      }
    }

    if (
      value.type === ElementType.Sc ||
      value.type === ElementType.Mc ||
      value.type === ElementType.Kprim
    ) {
      return {
        instanceId: parsedInstanceId,
        type: value.type,
        choicesResponse: Object.entries(value.response ?? {})
          .filter(([, selected]) => selected)
          .map(([ix, selected]) => ({
            ix: parseInt(ix),
            selected: selected ?? false,
          })),
      }
    }

    if (value.type === ElementType.Numerical) {
      return {
        instanceId: parsedInstanceId,
        type: ElementType.Numerical,
        numericalResponse: parseFloat(value.response ?? ''),
      }
    }

    if (value.type === ElementType.FreeText) {
      return {
        instanceId: parsedInstanceId,
        type: ElementType.FreeText,
        freeTextResponse: value.response,
      }
    }

    if (value.type === ElementType.Selection) {
      return {
        instanceId: parsedInstanceId,
        type: ElementType.Selection,
        selectionResponse: Object.values(value.response ?? {}).map((entry) =>
          typeof entry === 'undefined' || entry === null ? -1 : entry
        ),
      }
    }

    if (value.type === ElementType.CaseStudy) {
      return {
        instanceId: parsedInstanceId,
        type: ElementType.CaseStudy,
        caseStudyResponse: serializeCaseStudyResponse(value.response ?? {}),
      }
    }

    throw new Error(`Unsupported practice response type: ${value.type}`)
  })
}

export async function submitPracticeStackOnline({
  respondToElementStack,
  isOwner,
  stackId,
  courseId,
  stackAnswerTime,
  responses,
}: SubmitPracticeStackOnlineArgs): Promise<PracticeStackFeedback | null> {
  const result = await respondToElementStack({
    variables: {
      isOwner,
      stackId,
      courseId,
      stackAnswerTime,
      responses,
    },
  })

  return result.data?.respondToElementStack ?? null
}

export async function submitPracticeStackOffline({
  participantId,
  snapshot,
  stack,
  responses,
  stackAnswerTime,
  storage,
}: SubmitPracticeStackOfflineArgs): Promise<PracticeStackFeedback> {
  const localEvaluation = createLocalPracticeStackFeedback({
    stack,
    responses,
  })
  const now = new Date().toISOString()

  await saveOfflinePracticeAttempt(
    participantId,
    {
      clientAttemptId: createOfflinePracticeAttemptId(),
      participantId,
      courseId: snapshot.quiz.course?.id ?? '',
      quizId: snapshot.quiz.id,
      quizRevision: snapshot.quizRevision,
      stackId: stack.id,
      responses,
      answerTime: stackAnswerTime,
      localEvaluation,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    },
    storage
  )

  return localEvaluation
}

export function createLocalPracticeStackFeedback({
  stack,
  responses,
}: {
  stack: ElementStack
  responses: StackResponseInput[]
}): PracticeStackFeedback {
  let status = StackFeedbackStatus.Unanswered
  let score: number | null = null
  const evaluations: PracticeStackEvaluation[] = []

  for (const response of responses) {
    const element = stack.elements?.find(
      (stackElement) => stackElement.id === response.instanceId
    )
    if (!element) continue

    const result = createLocalPracticeInstanceResult({ element, response })
    if (result.status) {
      status = combinePracticeStackStatus(status, result.status)
    }
    if (typeof result.score === 'number') {
      score = (score ?? 0) + result.score
    }
    if (result.evaluation) {
      evaluations.push(result.evaluation)
    }
  }

  return {
    __typename: 'StackFeedback',
    id: stack.id,
    status,
    score,
    evaluations,
  }
}

export function attachPracticeStackEvaluations({
  studentResponse,
  evaluations,
}: {
  studentResponse: StackStudentResponseType
  evaluations?: PracticeStackFeedback['evaluations'] | null
}): StackStudentResponseType {
  return Object.entries(studentResponse).reduce<StackStudentResponseType>(
    (acc, [key, value]) => {
      return {
        ...acc,
        [key]: {
          ...value,
          evaluation: evaluations?.find(
            (evaluation) => evaluation.instanceId === parseInt(key)
          ),
        },
      }
    },
    {}
  )
}

function serializeCaseStudyResponse(
  response: CaseStudyStudentResponseType
): CaseStudyCaseResponse[] {
  return Object.entries(response).map(([caseId, caseResponse]) => ({
    caseId,
    itemResponses: Object.entries(caseResponse).map(
      ([itemId, itemResponse]) => ({
        itemId: parseInt(itemId),
        criterionResponses: Object.entries(itemResponse).flatMap(
          ([criterionId, criterionResponse]) => {
            if (typeof criterionResponse === 'undefined') return []

            return {
              criterionId,
              response: criterionResponse,
            }
          }
        ),
      })
    ),
  }))
}

function createLocalPracticeInstanceResult({
  element,
  response,
}: {
  element: ElementInstance
  response: StackResponseInput
}): {
  status: StackFeedbackStatus | null
  score: number | null
  evaluation: PracticeStackEvaluation | null
} {
  const elementData = element.elementData
  const pointsMultiplier =
    element.options?.pointsMultiplier ?? elementData.pointsMultiplier ?? 1

  if (response.type === ElementType.Flashcard) {
    return {
      status: getFlashcardFeedbackStatus(response.flashcardResponse),
      score: null,
      evaluation: null,
    }
  }

  if (response.type === ElementType.Content) {
    return {
      status: response.contentReponse ? StackFeedbackStatus.Correct : null,
      score: null,
      evaluation: null,
    }
  }

  if (
    elementData.__typename === 'ChoicesElementData' &&
    (response.type === ElementType.Sc ||
      response.type === ElementType.Mc ||
      response.type === ElementType.Kprim)
  ) {
    const choicesResponse = response.choicesResponse ?? []
    const hasSampleSolution = elementData.options.hasSampleSolution === true
    const solution = hasSampleSolution
      ? elementData.options.choices.reduce<number[]>(
          (acc, choice) => (choice.correct ? [...acc, choice.ix] : acc),
          []
        )
      : []
    const correctness = !hasSampleSolution
      ? 1
      : response.type === ElementType.Sc
        ? gradeQuestionSC({
            responseCount: elementData.options.choices.length,
            response: choicesResponse,
            solution,
          })
        : response.type === ElementType.Mc
          ? gradeQuestionMC({
              responseCount: elementData.options.choices.length,
              response: choicesResponse,
              solution,
            })
          : gradeQuestionKPRIM({
              responseCount: elementData.options.choices.length,
              response: choicesResponse,
              solution,
            })
    const score = computeSimpleAwardedPoints({
      points: POINTS_PER_INSTANCE,
      pointsPercentage: correctness,
      pointsMultiplier,
    })

    return {
      status: getPracticeFeedbackStatus(correctness),
      score,
      evaluation: {
        __typename: 'ChoicesInstanceEvaluation',
        instanceId: element.id,
        elementType: response.type,
        pointsMultiplier,
        explanation: elementData.explanation,
        feedbacks: createChoiceFeedbacks(elementData.options.choices),
        choices: elementData.options.choices.map((choice) => ({
          __typename: 'SingleChoiceResponse',
          ix: choice.ix,
          count: choicesResponse.some(
            (choiceResponse) => choiceResponse.ix === choice.ix
          )
            ? 1
            : 0,
        })),
        numAnswers: 1,
        score,
        xp: computeAwardedXp({ pointsPercentage: correctness }),
        pointsAwarded: null,
        percentile: correctness ?? 0,
        newPointsFrom: null,
        xpAwarded: null,
        newXpFrom: null,
        correctness,
        lastResponse: {
          __typename: 'SingleQuestionResponseChoices',
          choices: choicesResponse,
        },
      },
    }
  }

  if (
    elementData.__typename === 'NumericalElementData' &&
    response.type === ElementType.Numerical
  ) {
    const responseValue = response.numericalResponse
    const hasSampleSolution = elementData.options.hasSampleSolution === true
    const correctness = !hasSampleSolution
      ? 1
      : typeof responseValue === 'number' && !Number.isNaN(responseValue)
        ? gradeQuestionNumerical({
            response: responseValue,
            solutionRanges: elementData.options.solutionRanges ?? [],
            exactSolutions: elementData.options.exactSolutions ?? [],
          })
        : null
    const score = computeOpenQuestionScore(correctness, pointsMultiplier)

    return {
      status: getPracticeFeedbackStatus(correctness),
      score,
      evaluation: {
        __typename: 'NumericalInstanceEvaluation',
        instanceId: element.id,
        elementType: ElementType.Numerical,
        pointsMultiplier,
        explanation: elementData.explanation,
        feedbacks: [],
        responses:
          typeof responseValue === 'number' && !Number.isNaN(responseValue)
            ? [
                {
                  __typename: 'SingleNumericalResponse',
                  value: responseValue,
                  count: 1,
                },
              ]
            : [],
        numAnswers: 1,
        score,
        xp: computeAwardedXp({ pointsPercentage: correctness }),
        pointsAwarded: null,
        percentile: correctness ?? 0,
        newPointsFrom: null,
        xpAwarded: null,
        newXpFrom: null,
        exactSolutions: hasSampleSolution
          ? (elementData.options.exactSolutions ?? [])
          : [],
        solutionRanges:
          hasSampleSolution && elementData.options.solutionRanges
            ? elementData.options.solutionRanges.map((range) => ({
                __typename: 'NumericalSolutionRange',
                min: range.min,
                max: range.max,
              }))
            : [],
        correctness,
        lastResponse: {
          __typename: 'SingleQuestionResponseValue',
          value: String(response.numericalResponse ?? ''),
        },
      },
    }
  }

  if (
    elementData.__typename === 'FreeTextElementData' &&
    response.type === ElementType.FreeText
  ) {
    const responseValue = response.freeTextResponse ?? ''
    const hasSampleSolution = elementData.options.hasSampleSolution === true
    const correctness = hasSampleSolution
      ? gradeQuestionFreeText({
          response: responseValue,
          solutions: elementData.options.solutions ?? [],
        })
      : 1
    const score = computeOpenQuestionScore(correctness, pointsMultiplier)

    return {
      status: getPracticeFeedbackStatus(correctness),
      score,
      evaluation: {
        __typename: 'FreeTextInstanceEvaluation',
        instanceId: element.id,
        elementType: ElementType.FreeText,
        pointsMultiplier,
        explanation: elementData.explanation,
        feedbacks: [],
        answers: [
          {
            __typename: 'SingleFreeTextResponse',
            value: responseValue,
            count: 1,
          },
        ],
        numAnswers: 1,
        score,
        xp: computeAwardedXp({ pointsPercentage: correctness }),
        pointsAwarded: null,
        percentile: correctness ?? 0,
        newPointsFrom: null,
        xpAwarded: null,
        newXpFrom: null,
        solutions: hasSampleSolution
          ? (elementData.options.solutions ?? [])
          : [],
        correctness,
        lastResponse: {
          __typename: 'SingleQuestionResponseValue',
          value: responseValue,
        },
      },
    }
  }

  if (
    elementData.__typename === 'SelectionElementData' &&
    response.type === ElementType.Selection
  ) {
    const selectionResponse = (response.selectionResponse ?? []).filter(
      (entry) => entry !== -1 && typeof entry !== 'undefined' && entry !== null
    )
    const hasSampleSolution = elementData.options.hasSampleSolution === true
    const correctness = !hasSampleSolution
      ? 1
      : gradeQuestionSelection({
          numberOfInputs: elementData.options.numberOfInputs ?? 0,
          response: selectionResponse,
          correctAnswers: elementData.options.answerCollectionSolutionIds,
        })
    const score = computeRoundedQuestionScore(correctness, pointsMultiplier)

    return {
      status: getPracticeFeedbackStatus(correctness),
      score,
      evaluation: {
        __typename: 'SelectionInstanceEvaluation',
        instanceId: element.id,
        elementType: ElementType.Selection,
        pointsMultiplier,
        explanation: elementData.explanation,
        feedbacks: [],
        selectionResponses:
          elementData.options.answerCollection?.entries?.map((entry) => ({
            __typename: 'SingleSelectionResponse',
            answerId: entry.id,
            value: entry.value,
            count: selectionResponse.includes(entry.id) ? 1 : 0,
          })) ?? [],
        numAnswers: 1,
        score,
        xp: computeAwardedXp({ pointsPercentage: correctness }),
        pointsAwarded: null,
        percentile: correctness ?? 0,
        newPointsFrom: null,
        xpAwarded: null,
        newXpFrom: null,
        answerSolutionIds: hasSampleSolution
          ? (elementData.options.answerCollectionSolutionIds ?? [])
          : [],
        correctness,
        lastResponse: {
          __typename: 'SingleQuestionResponseSelection',
          selection: selectionResponse,
        },
      },
    }
  }

  if (
    elementData.__typename === 'CaseStudyElementData' &&
    response.type === ElementType.CaseStudy
  ) {
    const caseStudyResponse = response.caseStudyResponse ?? []
    const hasSampleSolution = elementData.options.hasSampleSolution === true
    const correctness = !hasSampleSolution
      ? 1
      : gradeQuestionCaseStudy({
          response: caseStudyResponse,
          solutions: elementData.options.cases.map((caseItem) => ({
            caseId: caseItem.id,
            itemSolutions: caseItem.solutions ?? [],
          })),
        })
    const score = computeRoundedQuestionScore(correctness, pointsMultiplier)

    return {
      status: getPracticeFeedbackStatus(correctness),
      score,
      evaluation: {
        __typename: 'CaseStudyInstanceEvaluation',
        instanceId: element.id,
        elementType: ElementType.CaseStudy,
        pointsMultiplier,
        explanation: elementData.explanation,
        feedbacks: [],
        assessments: caseStudyResponse.flatMap((caseResponse) =>
          caseResponse.itemResponses.flatMap((itemResponse) =>
            itemResponse.criterionResponses.map((criterionResponse) => ({
              __typename: 'SingleCaseStudyResponse',
              caseId: caseResponse.caseId,
              itemId: itemResponse.itemId,
              criterionId: criterionResponse.criterionId,
              responseValues: [criterionResponse.response],
            }))
          )
        ),
        studySolutions: elementData.options.cases.map((caseItem) => ({
          __typename: 'CaseStudySolution',
          caseId: caseItem.id,
          solutions: !hasSampleSolution ? [] : (caseItem.solutions ?? []),
        })),
        numAnswers: 1,
        score,
        xp: computeAwardedXp({ pointsPercentage: correctness }),
        pointsAwarded: null,
        percentile: correctness ?? 0,
        newPointsFrom: null,
        xpAwarded: null,
        newXpFrom: null,
        correctness,
        lastResponse: {
          __typename: 'SingleQuestionResponseCaseStudy',
          assessment: caseStudyResponse.map((caseResponse) => ({
            __typename: 'SingleQuestionResponseCaseStudyCase',
            caseId: caseResponse.caseId,
            itemResponses: caseResponse.itemResponses.map((itemResponse) => ({
              __typename: 'SingleQuestionResponseCaseStudyItem',
              itemId: itemResponse.itemId,
              criterionResponses: itemResponse.criterionResponses.map(
                (criterionResponse) => ({
                  __typename: 'SingleQuestionResponseCaseStudyCriterion',
                  criterionId: criterionResponse.criterionId,
                  response: criterionResponse.response,
                  correct: getCaseStudyCriterionCorrectness({
                    element,
                    caseId: caseResponse.caseId,
                    itemId: itemResponse.itemId,
                    criterionId: criterionResponse.criterionId,
                    response: criterionResponse.response,
                  }),
                })
              ),
            })),
          })),
        },
      },
    }
  }

  return {
    status: null,
    score: null,
    evaluation: null,
  }
}

function createChoiceFeedbacks(
  choices: Array<{
    ix: number
    value: string
    correct?: boolean | null
    feedback?: string | null
  }>
) {
  return choices.map((choice) => ({
    __typename: 'QuestionFeedback' as const,
    ix: choice.ix,
    value: choice.value,
    correct: choice.correct ?? null,
    feedback: choice.feedback ?? null,
  }))
}

function toInputFlashcardCorrectness(
  correctness: FlashcardCorrectness | undefined
) {
  if (correctness === FlashcardCorrectness.Correct) {
    return FlashcardCorrectnessType.Correct
  }
  if (correctness === FlashcardCorrectness.Partial) {
    return FlashcardCorrectnessType.Partial
  }
  return FlashcardCorrectnessType.Incorrect
}

function getFlashcardFeedbackStatus(
  correctness: FlashcardCorrectnessType | undefined | null
) {
  if (correctness === FlashcardCorrectnessType.Correct) {
    return StackFeedbackStatus.Correct
  }
  if (correctness === FlashcardCorrectnessType.Partial) {
    return StackFeedbackStatus.Partial
  }
  if (correctness === FlashcardCorrectnessType.Incorrect) {
    return StackFeedbackStatus.Incorrect
  }
  return null
}

function getPracticeFeedbackStatus(correctness: number | null | undefined) {
  if (correctness === 1) return StackFeedbackStatus.Correct
  if (typeof correctness === 'number' && correctness > 0) {
    return StackFeedbackStatus.Partial
  }
  return StackFeedbackStatus.Incorrect
}

function combinePracticeStackStatus(
  prevStatus: StackFeedbackStatus,
  newStatus: StackFeedbackStatus
) {
  if (prevStatus === StackFeedbackStatus.Unanswered) return newStatus
  if (prevStatus === StackFeedbackStatus.Correct) {
    return newStatus === StackFeedbackStatus.Correct
      ? StackFeedbackStatus.Correct
      : StackFeedbackStatus.Partial
  }
  if (prevStatus === StackFeedbackStatus.Incorrect) {
    return newStatus === StackFeedbackStatus.Incorrect
      ? StackFeedbackStatus.Incorrect
      : StackFeedbackStatus.Partial
  }
  return prevStatus
}

function computeOpenQuestionScore(
  correctness: number | null | undefined,
  pointsMultiplier: number
) {
  return correctness ? correctness * POINTS_PER_INSTANCE * pointsMultiplier : 0
}

function computeRoundedQuestionScore(
  correctness: number | null | undefined,
  pointsMultiplier: number
) {
  return correctness
    ? Math.round(correctness * POINTS_PER_INSTANCE * pointsMultiplier)
    : 0
}

function getCaseStudyCriterionCorrectness({
  element,
  caseId,
  itemId,
  criterionId,
  response,
}: {
  element: ElementInstance
  caseId: string
  itemId: number
  criterionId: string
  response: number
}) {
  if (element.elementData.__typename !== 'CaseStudyElementData') return null

  const criterionSolution = element.elementData.options.cases
    .find((caseItem) => caseItem.id === caseId)
    ?.solutions?.find((solution) => solution.itemId === itemId)
    ?.criteriaSolutions.find((solution) => solution.criterionId === criterionId)

  if (!criterionSolution) return null

  return (
    response >= criterionSolution.min - Number.EPSILON &&
    response <= criterionSolution.max + Number.EPSILON
  )
}

function createOfflinePracticeAttemptId() {
  return `offline-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
}
