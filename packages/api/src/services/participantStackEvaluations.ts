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
import {
  ElementStackType,
  ElementType,
  ResponseCorrectness,
  TimelineEntryType,
  type ElementInstance,
  type InstanceStatistics,
  type Participant,
  type Participation,
  type PrismaClient,
  type QuestionResponse,
} from '@klicker-uzh/prisma/client'
import type {
  CaseStudyElementData,
  CaseStudySolutionsObject,
  Choice,
  ChoicesElementData,
  ContentElementData,
  ElementData,
  ElementInstanceResults,
  ElementOptionsAnswerCollection,
  ElementOptionsCaseStudy,
  ElementResultsCaseStudy,
  ElementResultsChoices,
  ElementResultsContent,
  ElementResultsFlashcard,
  ElementResultsOpen,
  ElementResultsSelection,
  FlashcardElementData,
  FreeTextElementData,
  NumericalElementData,
  SelectionElementData,
  SingleCaseStudyResponse,
  SingleQuestionResponse,
  SingleQuestionResponseCaseStudy,
  SingleQuestionResponseChoices,
  SingleQuestionResponseContent,
  SingleQuestionResponseFlashcard,
  SingleQuestionResponseSelection,
  SingleQuestionResponseValue,
  StackResponseInput,
} from '@klicker-uzh/types'
import { FlashcardCorrectness, StackFeedbackStatus } from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  type PrismaTransactionClient,
} from '@klicker-uzh/util'
import dayjs from 'dayjs'
import { createHash } from 'node:crypto'

const POINTS_PER_INSTANCE = 10
const POINTS_AWARD_TIMEFRAME_DAYS = 6
const XP_AWARD_TIMEFRAME_DAYS = 1

const flashcardResultMap: Record<FlashcardCorrectness, StackFeedbackStatus> = {
  [FlashcardCorrectness.INCORRECT]: StackFeedbackStatus.INCORRECT,
  [FlashcardCorrectness.PARTIAL]: StackFeedbackStatus.PARTIAL,
  [FlashcardCorrectness.CORRECT]: StackFeedbackStatus.CORRECT,
}

type QuestionFeedbackDto = {
  ix: number
  feedback?: string | null
  correct?: boolean | null
  value: string
}

type BaseEvaluationDto = {
  instanceId: number
  elementType: ElementType
  pointsMultiplier: number
  explanation?: string | null
  feedbacks?: QuestionFeedbackDto[] | null
  numAnswers?: number | null
  score: number
  xp?: number | null
  pointsAwarded?: number | null
  percentile?: number | null
  newPointsFrom?: Date | null
  xpAwarded?: number | null
  newXpFrom?: Date | null
  correctness?: number | null
}

type ChoicesInstanceEvaluationDto = BaseEvaluationDto & {
  __typename: 'ChoicesInstanceEvaluation'
  choices?: { ix: number; count: number }[] | null
  lastResponse?: {
    __typename: 'SingleQuestionResponseChoices'
    choices: {
      __typename?: 'ChoicesResponseObject'
      ix: number
      selected: boolean
    }[]
  } | null
}

type NumericalInstanceEvaluationDto = BaseEvaluationDto & {
  __typename: 'NumericalInstanceEvaluation'
  responses?: { value: number; count: number }[] | null
  solutionRanges?:
    | {
        __typename?: 'NumericalSolutionRange'
        min?: number | null
        max?: number | null
      }[]
    | null
  exactSolutions?: number[] | null
  lastResponse?: {
    __typename: 'SingleQuestionResponseValue'
    value: string
  } | null
}

type FreeTextInstanceEvaluationDto = BaseEvaluationDto & {
  __typename: 'FreeTextInstanceEvaluation'
  answers?: { value: string; count: number }[] | null
  solutions?: string[] | null
  lastResponse?: {
    __typename: 'SingleQuestionResponseValue'
    value: string
  } | null
}

type SelectionInstanceEvaluationDto = BaseEvaluationDto & {
  __typename: 'SelectionInstanceEvaluation'
  selectionResponses?:
    | {
        __typename?: 'SingleSelectionResponse'
        answerId: number
        value: string
        count: number
      }[]
    | null
  answerSolutionIds?: number[] | null
  lastResponse?: {
    __typename: 'SingleQuestionResponseSelection'
    selection: number[]
  } | null
}

type CaseStudyInstanceEvaluationDto = BaseEvaluationDto & {
  __typename: 'CaseStudyInstanceEvaluation'
  assessments?:
    | (SingleCaseStudyResponse & {
        __typename?: 'SingleCaseStudyResponse'
      })[]
    | null
  studySolutions?:
    | {
        __typename?: 'CaseStudySolution'
        caseId: string
        solutions?:
          | {
              itemId: number
              criteriaSolutions: {
                criterionId: string
                min: number
                max: number
              }[]
            }[]
          | null
      }[]
    | null
  lastResponse?: {
    __typename: 'SingleQuestionResponseCaseStudy'
    assessment: {
      caseId: string
      itemResponses: {
        itemId: number
        criterionResponses: {
          criterionId: string
          response: number
          correct?: boolean | null
        }[]
      }[]
    }[]
  } | null
}

type FlashcardInstanceEvaluationDto = BaseEvaluationDto & {
  __typename: 'FlashcardInstanceEvaluation'
  lastResponse?: {
    __typename: 'SingleQuestionResponseFlashcard'
    correctness: FlashcardCorrectness
  } | null
}

type ContentInstanceEvaluationDto = BaseEvaluationDto & {
  __typename: 'ContentInstanceEvaluation'
  lastResponse?: {
    __typename: 'SingleQuestionResponseContent'
    viewed: boolean
  } | null
}

export type PreviousStackInstanceEvaluation =
  | CaseStudyInstanceEvaluationDto
  | ChoicesInstanceEvaluationDto
  | ContentInstanceEvaluationDto
  | FlashcardInstanceEvaluationDto
  | FreeTextInstanceEvaluationDto
  | NumericalInstanceEvaluationDto
  | SelectionInstanceEvaluationDto

export type PreviousStackEvaluation = {
  id: number
  status: StackFeedbackStatus
  score?: number | null
  evaluations: PreviousStackInstanceEvaluation[]
}

type EvaluationAggregationReturn = {
  evaluation: PreviousStackInstanceEvaluation | undefined
  newStatus: StackFeedbackStatus
  stackScore: number | undefined
}

function combineStackStatus({
  prevStatus,
  newStatus,
}: {
  prevStatus: StackFeedbackStatus
  newStatus: StackFeedbackStatus
}) {
  if (
    newStatus !== StackFeedbackStatus.INCORRECT &&
    newStatus !== StackFeedbackStatus.PARTIAL &&
    newStatus !== StackFeedbackStatus.CORRECT
  ) {
    return prevStatus
  }

  if (prevStatus === StackFeedbackStatus.UNANSWERED) return newStatus
  if (prevStatus === StackFeedbackStatus.CORRECT) {
    return newStatus === StackFeedbackStatus.CORRECT
      ? StackFeedbackStatus.CORRECT
      : StackFeedbackStatus.PARTIAL
  }
  if (prevStatus === StackFeedbackStatus.INCORRECT) {
    return newStatus === StackFeedbackStatus.INCORRECT
      ? StackFeedbackStatus.INCORRECT
      : StackFeedbackStatus.PARTIAL
  }

  return prevStatus
}

function toQuestionFeedback(choice: Choice): QuestionFeedbackDto {
  return {
    ix: choice.ix,
    value: choice.value,
    correct: choice.correct ?? null,
    feedback: choice.feedback ?? null,
  }
}

function withBaseEvaluation({
  elementType,
  explanation,
  feedbacks = null,
  instanceId,
  numAnswers = null,
  pointsMultiplier,
  score,
  xp = null,
  pointsAwarded = null,
  percentile = null,
  xpAwarded = null,
  newPointsFrom = null,
  newXpFrom = null,
  correctness = null,
}: {
  elementType: ElementType
  explanation?: string | null
  feedbacks?: QuestionFeedbackDto[] | null
  instanceId: number
  numAnswers?: number | null
  pointsMultiplier: number
  score: number
  xp?: number | null
  pointsAwarded?: number | null
  percentile?: number | null
  xpAwarded?: number | null
  newPointsFrom?: Date | null
  newXpFrom?: Date | null
  correctness?: number | null
}): BaseEvaluationDto {
  return {
    instanceId,
    elementType,
    pointsMultiplier,
    explanation,
    feedbacks,
    numAnswers,
    score,
    xp,
    pointsAwarded,
    percentile,
    newPointsFrom,
    xpAwarded,
    newXpFrom,
    correctness,
  }
}

function getPointsMultiplier(options: unknown) {
  if (!options || typeof options !== 'object') return undefined

  const multiplier = (options as { pointsMultiplier?: unknown })
    .pointsMultiplier
  return typeof multiplier === 'number' ? multiplier : undefined
}

function combineChoicesResults({
  choices,
  results,
  anonymousResults,
}: {
  choices: Choice[]
  results: ElementResultsChoices['choices']
  anonymousResults: ElementResultsChoices['choices']
}) {
  return choices.map((choice) => ({
    ix: choice.ix,
    count: (results[choice.ix] ?? 0) + (anonymousResults[choice.ix] ?? 0),
  }))
}

function combineNumericalResults({
  results,
  anonymousResults,
}: {
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
}) {
  return [
    ...Object.values(results.responses),
    ...Object.values(anonymousResults.responses),
  ].reduce<{ value: number; count: number }[]>((acc, response) => {
    const responseValue = parseFloat(response.value)
    const ix = acc.findIndex(
      (entry) => Math.abs(entry.value - responseValue) < Number.EPSILON
    )

    if (ix === -1) {
      acc.push({
        value: responseValue,
        count: response.count,
      })
    } else {
      acc[ix] = {
        ...acc[ix]!,
        count: acc[ix]!.count + response.count,
      }
    }

    return acc
  }, [])
}

function combineFreeTextResults({
  results,
  anonymousResults,
}: {
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
}) {
  return [
    ...Object.values(results.responses),
    ...Object.values(anonymousResults.responses),
  ].reduce<{ value: string; count: number }[]>((acc, response) => {
    const ix = acc.findIndex((entry) => entry.value === response.value)

    if (ix === -1) {
      acc.push({
        value: response.value,
        count: response.count,
      })
    } else {
      acc[ix] = {
        ...acc[ix]!,
        count: acc[ix]!.count + response.count,
      }
    }

    return acc
  }, [])
}

function combineSelectionResults({
  results,
  anonymousResults,
  answerOptions,
}: {
  results: ElementResultsSelection
  anonymousResults: ElementResultsSelection
  answerOptions: ElementOptionsAnswerCollection
}) {
  return answerOptions.entries.map((option) => ({
    __typename: 'SingleSelectionResponse' as const,
    answerId: option.id,
    value: option.value,
    count:
      (results.selections[option.id] ?? 0) +
      (anonymousResults.selections[option.id] ?? 0),
  }))
}

function reduceCaseStudyResults({
  results,
  anonymousResults,
  options,
}: {
  results: ElementResultsCaseStudy
  anonymousResults: ElementResultsCaseStudy
  options: ElementOptionsCaseStudy
}) {
  return options.cases.flatMap((caseObj) =>
    options.items
      ? options.items.flatMap((item) =>
          options.criteria.map((criterion) => {
            const caseId = caseObj.id
            const itemId = item.id
            const criterionId = criterion.id

            const resultValues = Object.values(
              results.assessments[caseId]?.[itemId]?.[criterionId] ?? {}
            ).map((response) => response.value)
            const anonymousResultValues = Object.values(
              anonymousResults.assessments[caseId]?.[itemId]?.[criterionId] ??
                {}
            ).map((response) => response.value)

            return {
              __typename: 'SingleCaseStudyResponse' as const,
              caseId,
              itemId,
              criterionId,
              responseValues: [
                ...new Set([...resultValues, ...anonymousResultValues]),
              ],
            }
          })
        )
      : []
  )
}

function evaluateChoicesAnswerCorrectness({
  elementData,
  response,
}: {
  elementData: ChoicesElementData
  response: SingleQuestionResponseChoices
}) {
  if (
    !response.choices ||
    ((elementData.type === ElementType.SC ||
      elementData.type === ElementType.MC) &&
      response.choices.length === 0)
  ) {
    return null
  }

  const solution = elementData.options.choices.reduce<number[]>(
    (acc, choice) => (choice.correct ? [...acc, choice.ix] : acc),
    []
  )

  if (elementData.type === ElementType.SC) {
    return gradeQuestionSC({
      responseCount: elementData.options.choices.length,
      response: response.choices,
      solution,
    })
  }
  if (elementData.type === ElementType.MC) {
    return gradeQuestionMC({
      responseCount: elementData.options.choices.length,
      response: response.choices,
      solution,
    })
  }

  return gradeQuestionKPRIM({
    responseCount: elementData.options.choices.length,
    response: response.choices,
    solution,
  })
}

function evaluateNumericalAnswerCorrectness({
  elementData,
  response,
}: {
  elementData: NumericalElementData
  response: SingleQuestionResponseValue
}) {
  if (response.value === null || typeof response.value === 'undefined') {
    return null
  }

  return gradeQuestionNumerical({
    response: parseFloat(String(response.value)),
    solutionRanges: elementData.options.solutionRanges ?? [],
    exactSolutions: elementData.options.exactSolutions ?? [],
  })
}

function evaluateFreeTextAnswerCorrectness({
  elementData,
  response,
}: {
  elementData: FreeTextElementData
  response: SingleQuestionResponseValue
}) {
  if (response.value === null || typeof response.value === 'undefined') {
    return null
  }

  return gradeQuestionFreeText({
    response: response.value,
    solutions: elementData.options.solutions ?? [],
  })
}

function evaluateSelectionAnswerCorrectness({
  elementData,
  response,
}: {
  elementData: SelectionElementData
  response: SingleQuestionResponseSelection
}) {
  if (!elementData.options.hasSampleSolution) return 1
  if (!response.selection || response.selection.length === 0) return null

  return gradeQuestionSelection({
    numberOfInputs: elementData.options.numberOfInputs!,
    response: response.selection,
    correctAnswers: elementData.options.answerCollectionSolutionIds,
  })
}

function evaluateCaseStudyAnswerCorrectness({
  elementData,
  response,
}: {
  elementData: CaseStudyElementData
  response: SingleQuestionResponseCaseStudy
}) {
  if (!elementData.options.hasSampleSolution) return 1
  if (!response.assessment || response.assessment.length === 0) return null

  const hasSolutions = elementData.options.cases.every(
    (caseItem) => caseItem.solutions && caseItem.solutions.length > 0
  )

  return hasSolutions
    ? gradeQuestionCaseStudy({
        response: response.assessment,
        solutions: elementData.options.cases.map((caseItem) => ({
          caseId: caseItem.id,
          itemSolutions: caseItem.solutions!,
        })),
      })
    : null
}

function getPreviousEvaluationFlashcard({
  instanceId,
  elementData,
  lastResponse,
}: {
  instanceId: number
  elementData: FlashcardElementData
  lastResponse: SingleQuestionResponseFlashcard
}): EvaluationAggregationReturn {
  return {
    evaluation: {
      __typename: 'FlashcardInstanceEvaluation',
      ...withBaseEvaluation({
        instanceId,
        elementType: ElementType.FLASHCARD,
        pointsMultiplier: elementData.pointsMultiplier,
        explanation: elementData.explanation,
        score: 0,
      }),
      lastResponse: {
        __typename: 'SingleQuestionResponseFlashcard',
        correctness: lastResponse.correctness,
      },
    },
    newStatus: flashcardResultMap[lastResponse.correctness],
    stackScore: undefined,
  }
}

function getPreviousEvaluationContent({
  instanceId,
  elementData,
  lastResponse,
}: {
  instanceId: number
  elementData: ContentElementData
  lastResponse: SingleQuestionResponseContent
}): EvaluationAggregationReturn {
  return {
    evaluation: {
      __typename: 'ContentInstanceEvaluation',
      ...withBaseEvaluation({
        instanceId,
        elementType: ElementType.CONTENT,
        pointsMultiplier: elementData.pointsMultiplier,
        explanation: elementData.explanation,
        score: 0,
        correctness: 1,
      }),
      lastResponse: {
        __typename: 'SingleQuestionResponseContent',
        viewed: lastResponse.viewed,
      },
    },
    newStatus: StackFeedbackStatus.CORRECT,
    stackScore: undefined,
  }
}

function getPreviousEvaluationChoices({
  instanceId,
  elementData,
  multiplier,
  results,
  anonymousResults,
  lastResponse,
}: {
  instanceId: number
  elementData: ChoicesElementData
  multiplier: number | undefined
  results: ElementResultsChoices
  anonymousResults: ElementResultsChoices
  lastResponse: SingleQuestionResponseChoices
}): EvaluationAggregationReturn {
  const correctness = evaluateChoicesAnswerCorrectness({
    elementData,
    response: lastResponse,
  })
  const score = computeSimpleAwardedPoints({
    points: POINTS_PER_INSTANCE,
    pointsPercentage: correctness,
    pointsMultiplier: multiplier,
  })
  const xp = computeAwardedXp({ pointsPercentage: correctness })

  return {
    evaluation: {
      __typename: 'ChoicesInstanceEvaluation',
      ...withBaseEvaluation({
        instanceId,
        elementType: elementData.type,
        pointsMultiplier: multiplier ?? 1,
        explanation: elementData.explanation,
        feedbacks: elementData.options.choices.map(toQuestionFeedback),
        numAnswers: results.total + anonymousResults.total,
        score,
        xp,
        pointsAwarded: score,
        percentile: correctness ?? 0,
        xpAwarded: xp,
        correctness,
      }),
      choices: combineChoicesResults({
        choices: elementData.options.choices,
        results: results.choices,
        anonymousResults: anonymousResults.choices,
      }),
      lastResponse: {
        __typename: 'SingleQuestionResponseChoices',
        choices: lastResponse.choices.map((choice) => ({
          __typename: 'ChoicesResponseObject',
          ix: choice.ix,
          selected: choice.selected,
        })),
      },
    },
    newStatus:
      correctness === 1
        ? StackFeedbackStatus.CORRECT
        : correctness === 0
          ? StackFeedbackStatus.INCORRECT
          : StackFeedbackStatus.PARTIAL,
    stackScore: score,
  }
}

function getPreviousEvaluationNumerical({
  instanceId,
  elementData,
  multiplier,
  results,
  anonymousResults,
  lastResponse,
}: {
  instanceId: number
  elementData: NumericalElementData
  multiplier: number | undefined
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
  lastResponse: SingleQuestionResponseValue
}): EvaluationAggregationReturn {
  const correctness = evaluateNumericalAnswerCorrectness({
    elementData,
    response: lastResponse,
  })
  const score = correctness
    ? correctness * POINTS_PER_INSTANCE * (multiplier ?? 1)
    : 0
  const xp = computeAwardedXp({ pointsPercentage: correctness })

  return {
    evaluation: {
      __typename: 'NumericalInstanceEvaluation',
      ...withBaseEvaluation({
        instanceId,
        elementType: ElementType.NUMERICAL,
        pointsMultiplier: multiplier ?? 1,
        explanation: elementData.explanation,
        feedbacks: [],
        numAnswers: results.total + anonymousResults.total,
        score,
        xp,
        pointsAwarded: score,
        percentile: correctness ?? 0,
        xpAwarded: xp,
        correctness,
      }),
      responses: combineNumericalResults({ results, anonymousResults }),
      solutionRanges:
        elementData.options.hasSampleSolution &&
        elementData.options.solutionRanges
          ? elementData.options.solutionRanges.map((range) => ({
              __typename: 'NumericalSolutionRange' as const,
              min: range.min ?? null,
              max: range.max ?? null,
            }))
          : [],
      exactSolutions:
        elementData.options.hasSampleSolution &&
        elementData.options.exactSolutions
          ? elementData.options.exactSolutions
          : [],
      lastResponse: {
        __typename: 'SingleQuestionResponseValue',
        value: lastResponse.value,
      },
    },
    newStatus:
      correctness === 1
        ? StackFeedbackStatus.CORRECT
        : correctness === 0
          ? StackFeedbackStatus.INCORRECT
          : StackFeedbackStatus.PARTIAL,
    stackScore: score,
  }
}

function getPreviousEvaluationFreeText({
  instanceId,
  elementData,
  multiplier,
  results,
  anonymousResults,
  lastResponse,
}: {
  instanceId: number
  elementData: FreeTextElementData
  multiplier: number | undefined
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
  lastResponse: SingleQuestionResponseValue
}): EvaluationAggregationReturn {
  const correctness = evaluateFreeTextAnswerCorrectness({
    elementData,
    response: lastResponse,
  })
  const score = correctness
    ? correctness * POINTS_PER_INSTANCE * (multiplier ?? 1)
    : 0
  const xp = computeAwardedXp({ pointsPercentage: correctness })

  return {
    evaluation: {
      __typename: 'FreeTextInstanceEvaluation',
      ...withBaseEvaluation({
        instanceId,
        elementType: ElementType.FREE_TEXT,
        pointsMultiplier: multiplier ?? 1,
        explanation: elementData.explanation,
        feedbacks: [],
        numAnswers: results.total + anonymousResults.total,
        score,
        xp,
        pointsAwarded: score,
        percentile: correctness ?? 0,
        xpAwarded: xp,
        correctness,
      }),
      answers: combineFreeTextResults({ results, anonymousResults }),
      solutions:
        elementData.options.hasSampleSolution && elementData.options.solutions
          ? elementData.options.solutions
          : [],
      lastResponse: {
        __typename: 'SingleQuestionResponseValue',
        value: lastResponse.value,
      },
    },
    newStatus:
      correctness === 1
        ? StackFeedbackStatus.CORRECT
        : correctness === 0
          ? StackFeedbackStatus.INCORRECT
          : StackFeedbackStatus.PARTIAL,
    stackScore: score,
  }
}

function getPreviousEvaluationSelection({
  instanceId,
  elementData,
  multiplier,
  results,
  anonymousResults,
  lastResponse,
}: {
  instanceId: number
  elementData: SelectionElementData
  multiplier: number | undefined
  results: ElementResultsSelection
  anonymousResults: ElementResultsSelection
  lastResponse: SingleQuestionResponseSelection
}): EvaluationAggregationReturn {
  const correctness = evaluateSelectionAnswerCorrectness({
    elementData,
    response: lastResponse,
  })
  const score = correctness
    ? Math.round(correctness * POINTS_PER_INSTANCE * (multiplier ?? 1))
    : 0
  const xp = computeAwardedXp({ pointsPercentage: correctness })

  return {
    evaluation: {
      __typename: 'SelectionInstanceEvaluation',
      ...withBaseEvaluation({
        instanceId,
        elementType: ElementType.SELECTION,
        pointsMultiplier: multiplier ?? 1,
        explanation: elementData.explanation,
        feedbacks: [],
        numAnswers: results.total + anonymousResults.total,
        score,
        xp,
        pointsAwarded: score,
        percentile: correctness ?? 0,
        xpAwarded: xp,
        correctness,
      }),
      selectionResponses: combineSelectionResults({
        results,
        anonymousResults,
        answerOptions: elementData.options.answerCollection!,
      }),
      answerSolutionIds: elementData.options.answerCollectionSolutionIds ?? [],
      lastResponse: {
        __typename: 'SingleQuestionResponseSelection',
        selection: lastResponse.selection,
      },
    },
    newStatus:
      correctness === 1
        ? StackFeedbackStatus.CORRECT
        : correctness === 0
          ? StackFeedbackStatus.INCORRECT
          : StackFeedbackStatus.PARTIAL,
    stackScore: score,
  }
}

function getPreviousEvaluationCaseStudy({
  instanceId,
  elementData,
  multiplier,
  results,
  anonymousResults,
  lastResponse,
}: {
  instanceId: number
  elementData: CaseStudyElementData
  multiplier: number | undefined
  results: ElementResultsCaseStudy
  anonymousResults: ElementResultsCaseStudy
  lastResponse: SingleQuestionResponseCaseStudy
}): EvaluationAggregationReturn {
  const correctness = evaluateCaseStudyAnswerCorrectness({
    elementData,
    response: lastResponse,
  })
  const score = correctness
    ? Math.round(correctness * POINTS_PER_INSTANCE * (multiplier ?? 1))
    : 0
  const xp = computeAwardedXp({ pointsPercentage: correctness })

  return {
    evaluation: {
      __typename: 'CaseStudyInstanceEvaluation',
      ...withBaseEvaluation({
        instanceId,
        elementType: ElementType.CASE_STUDY,
        pointsMultiplier: multiplier ?? 1,
        explanation: elementData.explanation,
        feedbacks: [],
        numAnswers: results.total + anonymousResults.total,
        score,
        xp,
        pointsAwarded: score,
        percentile: correctness ?? 0,
        xpAwarded: xp,
        correctness,
      }),
      assessments: reduceCaseStudyResults({
        results,
        anonymousResults,
        options: elementData.options,
      }),
      studySolutions: elementData.options.cases.map((caseItem) => ({
        __typename: 'CaseStudySolution',
        caseId: caseItem.id,
        solutions: elementData.options.hasSampleSolution
          ? caseItem.solutions
          : [],
      })),
      lastResponse: {
        __typename: 'SingleQuestionResponseCaseStudy',
        assessment: lastResponse.assessment,
      },
    },
    newStatus:
      correctness === 1
        ? StackFeedbackStatus.CORRECT
        : correctness === 0
          ? StackFeedbackStatus.INCORRECT
          : StackFeedbackStatus.PARTIAL,
    stackScore: score,
  }
}

function evaluatePreviousElement({
  element,
}: {
  element: {
    anonymousResults: unknown
    elementData: unknown
    id: number
    options: unknown
    responses: { lastResponse: unknown }[]
    results: unknown
  }
}): EvaluationAggregationReturn | null {
  const lastResponse = element.responses[0]?.lastResponse
  if (!lastResponse) return null

  const elementData = element.elementData as ElementData
  const multiplier = getPointsMultiplier(element.options)

  if (elementData.type === ElementType.FLASHCARD) {
    return getPreviousEvaluationFlashcard({
      instanceId: element.id,
      elementData,
      lastResponse: lastResponse as SingleQuestionResponseFlashcard,
    })
  }

  if (elementData.type === ElementType.CONTENT) {
    return getPreviousEvaluationContent({
      instanceId: element.id,
      elementData,
      lastResponse: lastResponse as SingleQuestionResponseContent,
    })
  }

  if (
    (elementData.type === ElementType.SC ||
      elementData.type === ElementType.MC ||
      elementData.type === ElementType.KPRIM) &&
    element.results &&
    typeof element.results === 'object' &&
    'choices' in element.results &&
    element.anonymousResults &&
    typeof element.anonymousResults === 'object' &&
    'choices' in element.anonymousResults
  ) {
    return getPreviousEvaluationChoices({
      instanceId: element.id,
      elementData,
      multiplier,
      results: element.results as ElementResultsChoices,
      anonymousResults: element.anonymousResults as ElementResultsChoices,
      lastResponse: lastResponse as SingleQuestionResponseChoices,
    })
  }

  if (
    elementData.type === ElementType.NUMERICAL &&
    element.results &&
    typeof element.results === 'object' &&
    'responses' in element.results &&
    element.anonymousResults &&
    typeof element.anonymousResults === 'object' &&
    'responses' in element.anonymousResults
  ) {
    return getPreviousEvaluationNumerical({
      instanceId: element.id,
      elementData,
      multiplier,
      results: element.results as ElementResultsOpen,
      anonymousResults: element.anonymousResults as ElementResultsOpen,
      lastResponse: lastResponse as SingleQuestionResponseValue,
    })
  }

  if (
    elementData.type === ElementType.FREE_TEXT &&
    element.results &&
    typeof element.results === 'object' &&
    'responses' in element.results &&
    element.anonymousResults &&
    typeof element.anonymousResults === 'object' &&
    'responses' in element.anonymousResults
  ) {
    return getPreviousEvaluationFreeText({
      instanceId: element.id,
      elementData,
      multiplier,
      results: element.results as ElementResultsOpen,
      anonymousResults: element.anonymousResults as ElementResultsOpen,
      lastResponse: lastResponse as SingleQuestionResponseValue,
    })
  }

  if (
    elementData.type === ElementType.SELECTION &&
    element.results &&
    typeof element.results === 'object' &&
    'selections' in element.results &&
    element.anonymousResults &&
    typeof element.anonymousResults === 'object' &&
    'selections' in element.anonymousResults
  ) {
    return getPreviousEvaluationSelection({
      instanceId: element.id,
      elementData,
      multiplier,
      results: element.results as ElementResultsSelection,
      anonymousResults: element.anonymousResults as ElementResultsSelection,
      lastResponse: lastResponse as SingleQuestionResponseSelection,
    })
  }

  if (
    elementData.type === ElementType.CASE_STUDY &&
    element.results &&
    typeof element.results === 'object' &&
    'assessments' in element.results &&
    element.anonymousResults &&
    typeof element.anonymousResults === 'object' &&
    'assessments' in element.anonymousResults
  ) {
    return getPreviousEvaluationCaseStudy({
      instanceId: element.id,
      elementData,
      multiplier,
      results: element.results as ElementResultsCaseStudy,
      anonymousResults: element.anonymousResults as ElementResultsCaseStudy,
      lastResponse: lastResponse as SingleQuestionResponseCaseStudy,
    })
  }

  throw new Error(
    `Evaluation aggregation for element type ${elementData.type} not implemented`
  )
}

export async function getPreviousStackEvaluation({
  participantId,
  prisma,
  stackId,
}: {
  participantId: string
  prisma: PrismaClient
  stackId: number
}): Promise<PreviousStackEvaluation | null> {
  const stack = await prisma.elementStack.findUnique({
    where: { id: stackId, type: ElementStackType.MICROLEARNING },
    select: {
      id: true,
      elements: {
        select: {
          id: true,
          elementData: true,
          results: true,
          anonymousResults: true,
          options: true,
          responses: {
            where: { participantId },
            select: {
              lastResponse: true,
            },
          },
        },
      },
    },
  })

  if (
    !stack ||
    !stack.elements ||
    !stack.elements[0] ||
    !stack.elements[0].responses
  ) {
    return null
  }

  const { evaluations, stackScore, stackFeedback } = stack.elements.reduce<{
    evaluations: PreviousStackInstanceEvaluation[]
    stackScore: number | undefined
    stackFeedback: StackFeedbackStatus
  }>(
    (acc, element) => {
      if (
        !element.responses ||
        element.responses.length === 0 ||
        !element.responses[0]
      ) {
        return acc
      }

      const result = evaluatePreviousElement({ element })
      if (!result?.evaluation) return acc

      acc.evaluations.push(result.evaluation)
      acc.stackFeedback = combineStackStatus({
        prevStatus: acc.stackFeedback,
        newStatus: result.newStatus,
      })
      if (typeof result.stackScore !== 'undefined') {
        acc.stackScore = (acc.stackScore ?? 0) + result.stackScore
      }

      return acc
    },
    {
      evaluations: [],
      stackScore: undefined,
      stackFeedback: StackFeedbackStatus.UNANSWERED,
    }
  )

  return {
    id: stack.id,
    status: stackFeedback,
    score: stackScore ?? null,
    evaluations,
  }
}

type ExistingResponseInstance = ElementInstance & {
  elementStack?: {
    practiceQuizId?: string | null
    microLearningId?: string | null
  } | null
  instanceStatistics: InstanceStatistics | null
  responses?: QuestionResponse[]
}

type ParticipationWithParticipant = Participation & {
  participant: Participant
}

type SpacedRepetitionResult = {
  efactor: number
  interval: number
  nextDueAt: Date
}

type ResponseInput =
  | SingleQuestionResponseChoices
  | SingleQuestionResponseValue
  | SingleQuestionResponseFlashcard
  | SingleQuestionResponseContent
  | SingleQuestionResponseSelection
  | SingleQuestionResponseCaseStudy

function combineNewCorrectnessParams({
  correct,
  partial,
  incorrect,
}: {
  correct: boolean
  partial: boolean
  incorrect: boolean
}) {
  return {
    lastAnsweredAt: new Date(),
    correctCount: correct ? 1 : 0,
    correctCountStreak: correct ? 1 : 0,
    lastCorrectAt: correct ? new Date() : undefined,
    partialCorrectCount: partial ? 1 : 0,
    lastPartialCorrectAt: partial ? new Date() : undefined,
    wrongCount: incorrect ? 1 : 0,
    lastWrongAt: incorrect ? new Date() : undefined,
  }
}

function combineCorrectnessParams({
  correct,
  partial,
  incorrect,
  existingResponse,
}: {
  correct: boolean
  partial: boolean
  incorrect: boolean
  existingResponse?: QuestionResponse | null
}) {
  return {
    lastAnsweredAt: new Date(),
    correctCount: {
      increment: correct ? 1 : 0,
    },
    correctCountStreak: {
      increment: correct
        ? 1
        : existingResponse
          ? -existingResponse.correctCountStreak
          : 0,
    },
    lastCorrectAt: correct ? new Date() : undefined,
    partialCorrectCount: {
      increment: partial ? 1 : 0,
    },
    lastPartialCorrectAt: partial ? new Date() : undefined,
    wrongCount: {
      increment: incorrect ? 1 : 0,
    },
    lastWrongAt: incorrect ? new Date() : undefined,
  }
}

function updateSpacedRepetition({
  eFactor,
  interval,
  streak,
  grade,
}: {
  eFactor: number
  interval: number
  streak: number
  grade: number
}): SpacedRepetitionResult {
  if (grade < 0 || grade > 1) {
    throw new Error('Grade must be between 0 and 1.')
  }

  const scaledGrade = grade * 5
  let newEfactor = Math.max(
    1.3,
    eFactor + (0.1 - (5 - scaledGrade) * (0.08 + (5 - scaledGrade) * 0.02))
  )
  newEfactor = parseFloat(newEfactor.toFixed(2))

  let newInterval: number
  if (scaledGrade < 3) {
    newInterval = 1
  } else if (streak === 1) {
    newInterval = 2
  } else if (streak === 2) {
    newInterval = 6
  } else {
    newInterval = Math.ceil(interval * newEfactor)
  }

  return {
    efactor: newEfactor,
    interval: Math.min(newInterval, 36500),
    nextDueAt: dayjs().add(Math.min(newInterval, 36500), 'day').toDate(),
  }
}

function computeNewAverageTimes({
  existingInstance,
  existingResponse,
  answerTime,
}: {
  existingInstance: ExistingResponseInstance
  existingResponse: QuestionResponse | null
  answerTime: number
}) {
  const existingParticipantCount =
    existingInstance.instanceStatistics!.uniqueParticipantCount
  const existingInstanceTime =
    existingInstance.instanceStatistics!.averageTimeSpent
  const newAverageResponseTime = existingResponse
    ? (existingResponse.averageTimeSpent * existingResponse.trialsCount +
        answerTime) /
      (existingResponse.trialsCount + 1)
    : answerTime
  const newAverageInstanceTime = existingResponse
    ? (existingInstanceTime! * existingParticipantCount -
        existingResponse.averageTimeSpent +
        answerTime) /
      existingParticipantCount
    : ((existingInstanceTime ?? 0) * existingParticipantCount + answerTime) /
      (existingParticipantCount + 1)

  return { newAverageResponseTime, newAverageInstanceTime }
}

function computeUpdatedInstanceStatistics({
  participation,
  existingResponse,
  newAverageInstanceTime,
  answerCorrect,
  answerPartial,
  answerIncorrect,
  instanceInPracticeQuiz,
}: {
  participation: Participation | null
  existingResponse: QuestionResponse | null
  newAverageInstanceTime?: number
  answerCorrect: boolean
  answerPartial: boolean
  answerIncorrect: boolean
  instanceInPracticeQuiz: boolean
}) {
  return participation
    ? {
        update: {
          uniqueParticipantCount: {
            increment: Number(!existingResponse),
          },
          averageTimeSpent: newAverageInstanceTime ?? 0,
          correctCount: {
            increment: Number(answerCorrect),
          },
          partialCorrectCount: {
            increment: Number(answerPartial),
          },
          wrongCount: {
            increment: Number(answerIncorrect),
          },
          firstCorrectCount: {
            increment: Number(
              answerCorrect && !existingResponse && instanceInPracticeQuiz
            ),
          },
          firstPartialCorrectCount: {
            increment: Number(
              answerPartial && !existingResponse && instanceInPracticeQuiz
            ),
          },
          firstWrongCount: {
            increment: Number(
              answerIncorrect && !existingResponse && instanceInPracticeQuiz
            ),
          },
          lastCorrectCount: {
            increment:
              Number(answerCorrect && instanceInPracticeQuiz) -
              Number(
                existingResponse?.lastResponseCorrectness ===
                  ResponseCorrectness.CORRECT
              ),
          },
          lastPartialCorrectCount: {
            increment:
              Number(answerPartial && instanceInPracticeQuiz) -
              Number(
                existingResponse?.lastResponseCorrectness ===
                  ResponseCorrectness.PARTIAL
              ),
          },
          lastWrongCount: {
            increment:
              Number(answerIncorrect && instanceInPracticeQuiz) -
              Number(
                existingResponse?.lastResponseCorrectness ===
                  ResponseCorrectness.WRONG
              ),
          },
        },
      }
    : {
        update: {
          anonymousCorrectCount: {
            increment: Number(answerCorrect),
          },
          anonymousPartialCorrectCount: {
            increment: Number(answerPartial),
          },
          anonymousWrongCount: {
            increment: Number(answerIncorrect),
          },
        },
      }
}

function updateChoicesResults({
  previousResults,
  response,
}: {
  previousResults: ElementResultsChoices
  response: SingleQuestionResponseChoices
}) {
  const choices = response.choices
  if (!choices || choices.length === 0) {
    return { results: previousResults, modified: false }
  }

  const updatedChoices = choices.reduce(
    (acc, choiceResponse) => {
      acc[choiceResponse.ix] = (acc[choiceResponse.ix] ?? 0) + 1
      return acc
    },
    { ...previousResults.choices }
  )

  return {
    results: {
      ...previousResults,
      choices: updatedChoices,
      total: previousResults.total + 1,
    },
    modified: true,
  }
}

function updateNumericalResults({
  previousResults,
  elementData,
  response,
  correct,
}: {
  previousResults: ElementResultsOpen
  elementData: NumericalElementData
  response: SingleQuestionResponseValue
  correct?: boolean
}) {
  if (
    typeof response.value === 'undefined' ||
    response.value === null ||
    response.value === ''
  ) {
    return { results: previousResults, modified: false }
  }

  const parsedValue = parseFloat(response.value)
  if (
    Number.isNaN(parsedValue) ||
    (typeof elementData.options.restrictions?.min === 'number' &&
      parsedValue < elementData.options.restrictions.min) ||
    (typeof elementData.options.restrictions?.max === 'number' &&
      parsedValue > elementData.options.restrictions.max) ||
    parsedValue > 1e30 ||
    parsedValue < -1e30
  ) {
    return { results: previousResults, modified: false }
  }

  const value = String(parsedValue)
  const hashedValue = createHash('md5').update(value).digest('hex')
  const previousEntry = previousResults.responses[hashedValue]

  return {
    results: {
      ...previousResults,
      responses: {
        ...previousResults.responses,
        [hashedValue]: previousEntry
          ? {
              ...previousEntry,
              count: previousEntry.count + 1,
            }
          : {
              value,
              count: 1,
              correct,
            },
      },
      total: previousResults.total + 1,
    },
    modified: true,
  }
}

function updateFreeTextResults({
  previousResults,
  elementData,
  response,
  correct,
}: {
  previousResults: ElementResultsOpen
  elementData: FreeTextElementData
  response: SingleQuestionResponseValue
  correct?: boolean
}) {
  if (
    typeof response.value === 'undefined' ||
    response.value === null ||
    response.value === '' ||
    (typeof elementData.options.restrictions?.maxLength === 'number' &&
      response.value.length > elementData.options.restrictions.maxLength)
  ) {
    return { results: previousResults, modified: false }
  }

  const value = response.value.trim().toLowerCase()
  const hashedValue = createHash('md5').update(value).digest('hex')
  const previousEntry = previousResults.responses[hashedValue]

  return {
    results: {
      ...previousResults,
      responses: {
        ...previousResults.responses,
        [hashedValue]: previousEntry
          ? {
              ...previousEntry,
              count: previousEntry.count + 1,
            }
          : {
              value,
              count: 1,
              correct,
            },
      },
      total: previousResults.total + 1,
    },
    modified: true,
  }
}

function updateSelectionResults({
  previousResults,
  response,
}: {
  previousResults: ElementResultsSelection
  response: SingleQuestionResponseSelection
}) {
  if (!response.selection || response.selection.length === 0) {
    return { results: previousResults, modified: false }
  }

  const updatedSelections = { ...previousResults.selections }
  response.selection.forEach((ix) => {
    if (ix in updatedSelections && typeof updatedSelections[ix] === 'number') {
      updatedSelections[ix] = updatedSelections[ix] + 1
    }
  })

  return {
    results: {
      selections: updatedSelections,
      total: previousResults.total + 1,
    },
    modified: true,
  }
}

function convertCaseStudySolutionsObject({
  elementData,
}: {
  elementData: CaseStudyElementData
}): CaseStudySolutionsObject | undefined {
  return elementData.options.hasSampleSolution
    ? elementData.options.cases.reduce<CaseStudySolutionsObject>(
        (acc, caseObj) => {
          acc[caseObj.id] = caseObj.solutions!.reduce(
            (itemAcc, { itemId, criteriaSolutions }) => {
              itemAcc[String(itemId)] = criteriaSolutions.reduce(
                (criterionAcc, { criterionId, min, max }) => {
                  criterionAcc[criterionId] = { min, max }
                  return criterionAcc
                },
                {}
              )
              return itemAcc
            },
            {}
          )
          return acc
        },
        {}
      )
    : undefined
}

function updateCaseStudyResults({
  previousResults,
  response,
  solutions,
}: {
  previousResults: ElementResultsCaseStudy
  response: SingleQuestionResponseCaseStudy
  solutions?: CaseStudySolutionsObject
}) {
  if (!response.assessment || response.assessment.length === 0) {
    return { results: previousResults, modified: false }
  }

  const newAssessments = { ...previousResults.assessments }
  response.assessment.forEach((caseResponse) => {
    const caseId = caseResponse.caseId

    caseResponse.itemResponses.forEach((itemResponse) => {
      const itemId = itemResponse.itemId

      itemResponse.criterionResponses.forEach((criterionResponse) => {
        const criterionId = criterionResponse.criterionId
        const responseValue = criterionResponse.response
        const responseHash = createHash('md5')
          .update(String(responseValue))
          .digest('hex')
        const existingCombinedResponses =
          newAssessments[caseId]?.[String(itemId)]?.[criterionId]
        const sampleSolution =
          solutions?.[caseId]?.[String(itemId)]?.[criterionId]
        const responseCorrectness = sampleSolution
          ? responseValue >= sampleSolution.min - Number.EPSILON &&
            responseValue <= sampleSolution.max + Number.EPSILON
          : undefined

        if (!existingCombinedResponses) {
          throw new Error('Existing combined responses are missing')
        }

        newAssessments[caseId]![String(itemId)]![criterionId]![responseHash] =
          existingCombinedResponses[responseHash]
            ? {
                ...existingCombinedResponses[responseHash]!,
                count: existingCombinedResponses[responseHash]!.count + 1,
              }
            : {
                value: responseValue,
                count: 1,
                correct: responseCorrectness,
              }
      })
    })
  })

  return {
    results: {
      assessments: newAssessments,
      total: previousResults.total + 1,
    },
    modified: true,
  }
}

function updateQuestionResults({
  existingInstance,
  participation,
  response,
  caseStudySolutions,
}: {
  existingInstance: ExistingResponseInstance
  participation: ParticipationWithParticipant | null
  response: ResponseInput
  caseStudySolutions?: CaseStudySolutionsObject
}): {
  correctness: number | null
  results: ElementInstanceResults
  modified: boolean
} {
  const elementData = existingInstance.elementData as ElementData
  const previousResults = (
    participation ? existingInstance.results : existingInstance.anonymousResults
  ) as ElementInstanceResults

  if (
    (elementData.type === ElementType.SC ||
      elementData.type === ElementType.MC ||
      elementData.type === ElementType.KPRIM) &&
    'choices' in previousResults &&
    'choices' in response
  ) {
    const correctness = elementData.options.hasSampleSolution
      ? evaluateChoicesAnswerCorrectness({ elementData, response })
      : 1
    return {
      ...updateChoicesResults({ previousResults, response }),
      correctness,
    }
  }

  if (
    elementData.type === ElementType.NUMERICAL &&
    'responses' in previousResults &&
    'value' in response
  ) {
    const correctness = elementData.options.hasSampleSolution
      ? evaluateNumericalAnswerCorrectness({ elementData, response })
      : 1
    return {
      ...updateNumericalResults({
        previousResults,
        elementData,
        response,
        correct: correctness === 1,
      }),
      correctness,
    }
  }

  if (
    elementData.type === ElementType.FREE_TEXT &&
    'responses' in previousResults &&
    'value' in response
  ) {
    const correctness = elementData.options.hasSampleSolution
      ? evaluateFreeTextAnswerCorrectness({ elementData, response })
      : 1
    return {
      ...updateFreeTextResults({
        previousResults,
        elementData,
        response,
        correct: correctness === 1,
      }),
      correctness,
    }
  }

  if (
    elementData.type === ElementType.SELECTION &&
    'selections' in previousResults &&
    'selection' in response
  ) {
    const correctness = elementData.options.hasSampleSolution
      ? evaluateSelectionAnswerCorrectness({ elementData, response })
      : 1
    return {
      ...updateSelectionResults({ previousResults, response }),
      correctness,
    }
  }

  if (
    elementData.type === ElementType.CASE_STUDY &&
    'assessments' in previousResults &&
    'assessment' in response
  ) {
    const correctness = elementData.options.hasSampleSolution
      ? evaluateCaseStudyAnswerCorrectness({ elementData, response })
      : 1
    return {
      ...updateCaseStudyResults({
        previousResults,
        response,
        solutions: caseStudySolutions,
      }),
      correctness,
    }
  }

  return {
    correctness: null,
    results: previousResults,
    modified: true,
  }
}

function computeAwardedPointsAndXP({
  score,
  xp,
  existingResponse,
  participation,
  instance,
}: {
  score: number
  xp: number
  existingResponse: QuestionResponse | null
  participation: Participation | null
  instance: ExistingResponseInstance
}) {
  const participationActive = participation?.isActive ?? false

  if (existingResponse) {
    const pointsOutsideTimeframe =
      !existingResponse.lastAwardedAt ||
      dayjs(existingResponse.lastAwardedAt).isBefore(
        dayjs().subtract(
          (instance.options as { resetTimeDays?: number | null })
            .resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS,
          'days'
        )
      )

    const lastAwardedAt =
      participationActive &&
      (pointsOutsideTimeframe || !existingResponse.lastAwardedAt)
        ? new Date()
        : (existingResponse.lastAwardedAt ?? undefined)
    const newPointsFrom =
      participationActive && lastAwardedAt
        ? dayjs(lastAwardedAt)
            .add(
              (instance.options as { resetTimeDays?: number | null })
                .resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS,
              'days'
            )
            .toDate()
        : undefined

    const xpOutsideTimeframe =
      !existingResponse.lastXpAwardedAt ||
      dayjs(existingResponse.lastXpAwardedAt).isBefore(
        dayjs().subtract(XP_AWARD_TIMEFRAME_DAYS, 'days')
      )
    const lastXpAwardedAt =
      xpOutsideTimeframe || !existingResponse.lastXpAwardedAt
        ? new Date()
        : existingResponse.lastXpAwardedAt

    return {
      pointsAwarded: participationActive
        ? pointsOutsideTimeframe
          ? score
          : 0
        : null,
      newPointsFrom,
      lastAwardedAt,
      xpAwarded: xpOutsideTimeframe ? xp : 0,
      newXpFrom: dayjs(lastXpAwardedAt)
        .add(XP_AWARD_TIMEFRAME_DAYS, 'days')
        .toDate(),
      lastXpAwardedAt,
    }
  }

  const lastAwardedAt = participationActive ? new Date() : undefined
  return {
    pointsAwarded: participationActive ? score : null,
    newPointsFrom: participationActive
      ? dayjs(lastAwardedAt)
          .add(
            (instance.options as { resetTimeDays?: number | null })
              .resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS,
            'days'
          )
          .toDate()
      : undefined,
    lastAwardedAt,
    xpAwarded: xp,
    newXpFrom: dayjs(lastAwardedAt)
      .add(XP_AWARD_TIMEFRAME_DAYS, 'days')
      .toDate(),
    lastXpAwardedAt: new Date(),
  }
}

function computeAggregatedResponsesOpen({
  instance,
  existingResponse,
  responseValue,
  correctness,
}: {
  instance: ExistingResponseInstance
  existingResponse: QuestionResponse | null
  responseValue: string
  correctness: number
}) {
  const previous = (existingResponse?.aggregatedResponses ??
    getInitialInstanceResults(
      instance.elementData as ElementData
    )) as ElementResultsOpen
  const hashedValue = createHash('md5').update(responseValue).digest('hex')
  const previousEntry = previous.responses[hashedValue]

  return {
    ...previous,
    responses: {
      ...previous.responses,
      [hashedValue]: previousEntry
        ? {
            ...previousEntry,
            count: previousEntry.count + 1,
          }
        : {
            value: responseValue,
            count: 1,
            correct: correctness === 1,
          },
    },
    total: previous.total + 1,
  }
}

function computeAggregatedResponsesQuestion({
  instance,
  existingResponse,
  response,
  correctness,
  caseStudySolutions,
}: {
  instance: ExistingResponseInstance
  existingResponse: QuestionResponse | null
  response: ResponseInput
  correctness?: number | null
  caseStudySolutions?: CaseStudySolutionsObject
}): ElementInstanceResults | null {
  if (
    (instance.elementType === ElementType.SC ||
      instance.elementType === ElementType.MC ||
      instance.elementType === ElementType.KPRIM) &&
    'choices' in response
  ) {
    const previous = (existingResponse?.aggregatedResponses ??
      getInitialInstanceResults(
        instance.elementData as ElementData
      )) as ElementResultsChoices
    return updateChoicesResults({
      previousResults: previous,
      response,
    }).results
  }

  if (
    (instance.elementType === ElementType.NUMERICAL ||
      instance.elementType === ElementType.FREE_TEXT) &&
    'value' in response
  ) {
    return computeAggregatedResponsesOpen({
      instance,
      existingResponse,
      responseValue:
        instance.elementType === ElementType.NUMERICAL
          ? String(parseFloat(response.value))
          : response.value.trim().toLowerCase(),
      correctness: correctness ?? 0,
    })
  }

  if (
    instance.elementType === ElementType.SELECTION &&
    'selection' in response
  ) {
    const previous = (existingResponse?.aggregatedResponses ??
      getInitialInstanceResults(
        instance.elementData as ElementData
      )) as ElementResultsSelection
    return updateSelectionResults({
      previousResults: previous,
      response,
    }).results
  }

  if (
    instance.elementType === ElementType.CASE_STUDY &&
    'assessment' in response
  ) {
    const previous = (existingResponse?.aggregatedResponses ??
      getInitialInstanceResults(
        instance.elementData as ElementData
      )) as ElementResultsCaseStudy
    return updateCaseStudyResults({
      previousResults: previous,
      response,
      solutions: caseStudySolutions,
    }).results
  }

  return null
}

async function createQuestionResponseDetail({
  prisma,
  id,
  participantId,
  courseId,
  response,
  score,
  pointsAwarded,
  xpAwarded,
  answerTime,
  practiceQuizId,
  microLearningId,
}: {
  prisma: PrismaTransactionClient
  id: number
  participantId: string
  courseId: string
  response: ResponseInput
  score: number
  pointsAwarded: number | null
  xpAwarded: number
  answerTime: number
  practiceQuizId?: string
  microLearningId?: string
}) {
  await prisma.questionResponseDetail.create({
    data: {
      score,
      pointsAwarded,
      xpAwarded,
      timeSpent: answerTime,
      response: response as SingleQuestionResponse,
      participant: {
        connect: { id: participantId },
      },
      elementInstance: {
        connect: { id },
      },
      practiceQuiz: practiceQuizId
        ? { connect: { id: practiceQuizId } }
        : undefined,
      microLearning: microLearningId
        ? { connect: { id: microLearningId } }
        : undefined,
      participation: {
        connect: {
          courseId_participantId: {
            courseId,
            participantId,
          },
        },
      },
    },
  })
}

async function upsertQuestionResponse({
  prisma,
  id,
  participantId,
  courseId,
  response,
  correctness,
  score,
  pointsAwarded,
  lastAwardedAt,
  xpAwarded,
  lastXpAwardedAt,
  newAverageResponseTime,
  existingResponse,
  newAggResponses,
  practiceQuizId,
  microLearningId,
  resultSpacedRepetition,
}: {
  prisma: PrismaTransactionClient
  id: number
  participantId: string
  courseId: string
  response: ResponseInput
  correctness: number
  score: number
  pointsAwarded: number | null
  lastAwardedAt: Date
  xpAwarded: number
  lastXpAwardedAt: Date
  newAverageResponseTime: number
  existingResponse: QuestionResponse | null
  newAggResponses: ElementInstanceResults
  practiceQuizId?: string
  microLearningId?: string
  resultSpacedRepetition: SpacedRepetitionResult
}) {
  const responseCorrectness =
    correctness === 1
      ? ResponseCorrectness.CORRECT
      : correctness === 0
        ? ResponseCorrectness.WRONG
        : ResponseCorrectness.PARTIAL

  await prisma.questionResponse.upsert({
    where: {
      participantId_elementInstanceId: {
        participantId,
        elementInstanceId: id,
      },
    },
    create: {
      totalScore: score,
      totalPointsAwarded: pointsAwarded,
      totalXpAwarded: xpAwarded,
      trialsCount: 1,
      averageTimeSpent: newAverageResponseTime ?? 0,
      lastAwardedAt,
      lastXpAwardedAt,
      firstResponse: response as SingleQuestionResponse,
      firstResponseCorrectness: responseCorrectness,
      lastResponse: response as SingleQuestionResponse,
      lastResponseCorrectness: responseCorrectness,
      aggregatedResponses: newAggResponses,
      participant: {
        connect: { id: participantId },
      },
      elementInstance: {
        connect: { id },
      },
      practiceQuiz: practiceQuizId
        ? { connect: { id: practiceQuizId } }
        : undefined,
      microLearning: microLearningId
        ? { connect: { id: microLearningId } }
        : undefined,
      course: {
        connect: { id: courseId },
      },
      participation: {
        connect: {
          courseId_participantId: {
            courseId,
            participantId,
          },
        },
      },
      ...combineNewCorrectnessParams({
        correct: correctness === 1,
        partial: correctness > 0 && correctness < 1,
        incorrect: correctness === 0,
      }),
      eFactor: resultSpacedRepetition.efactor,
      nextDueAt: resultSpacedRepetition.nextDueAt,
      interval: resultSpacedRepetition.interval,
    },
    update: {
      lastResponse: response as SingleQuestionResponse,
      lastResponseCorrectness: responseCorrectness,
      aggregatedResponses: newAggResponses,
      lastAwardedAt,
      lastXpAwardedAt,
      trialsCount: {
        increment: 1,
      },
      averageTimeSpent: newAverageResponseTime ?? 0,
      totalScore: {
        increment: score,
      },
      totalPointsAwarded:
        typeof pointsAwarded === 'number' ? { increment: pointsAwarded } : null,
      totalXpAwarded: {
        increment: xpAwarded,
      },
      ...combineCorrectnessParams({
        correct: correctness === 1,
        partial: correctness > 0 && correctness < 1,
        incorrect: correctness === 0,
        existingResponse,
      }),
      eFactor: resultSpacedRepetition.efactor,
      nextDueAt: resultSpacedRepetition.nextDueAt,
      interval: resultSpacedRepetition.interval,
    },
  })
}

async function incrementParticipantXp({
  prisma,
  participantId,
  xpAwarded,
}: {
  prisma: PrismaTransactionClient
  participantId: string
  xpAwarded: number
}) {
  await prisma.participant.update({
    where: { id: participantId },
    data: {
      xp: {
        increment: xpAwarded,
      },
    },
  })
}

async function updateLeaderboardOnQuestionResponse({
  prisma,
  participantId,
  courseId,
  pointsAwarded,
}: {
  prisma: PrismaTransactionClient
  participantId: string
  courseId: string
  pointsAwarded: number
}) {
  await prisma.leaderboardEntry.upsert({
    where: {
      type_participantId_courseId: {
        type: 'COURSE',
        courseId,
        participantId,
      },
    },
    create: {
      type: 'COURSE',
      score: pointsAwarded,
      participant: {
        connect: { id: participantId },
      },
      course: {
        connect: { id: courseId },
      },
      participation: {
        connect: {
          courseId_participantId: {
            courseId,
            participantId,
          },
        },
      },
    },
    update: {
      score: {
        increment: pointsAwarded,
      },
    },
  })
}

async function upsertDailyTimelineEntry({
  prisma,
  participantId,
  courseId,
  xpAwarded,
  pointsAwarded,
}: {
  prisma: PrismaTransactionClient
  participantId: string
  courseId: string
  xpAwarded?: number
  pointsAwarded?: number
}) {
  const participation = await prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId,
        participantId,
      },
    },
  })

  if (!participation) return

  await prisma.timelineEntry.upsert({
    where: {
      participationId_courseId_timestamp_type: {
        participationId: participation.id,
        courseId,
        timestamp: new Date(),
        type: TimelineEntryType.DAILY,
      },
    },
    create: {
      type: TimelineEntryType.DAILY,
      timestamp: new Date(),
      collectedPoints: participation.isActive ? pointsAwarded : 0,
      collectedXp: xpAwarded,
      computedAt: new Date(),
      course: {
        connect: { id: courseId },
      },
      participation: {
        connect: { id: participation.id },
      },
    },
    update: {
      collectedPoints:
        typeof pointsAwarded === 'number'
          ? { increment: pointsAwarded }
          : undefined,
      collectedXp:
        typeof xpAwarded === 'number' ? { increment: xpAwarded } : undefined,
      computedAt: new Date(),
    },
  })
}

function getResponseCorrectnessStatus(correctness: number | null) {
  if (correctness === 1) return StackFeedbackStatus.CORRECT
  if (correctness === 0) return StackFeedbackStatus.INCORRECT
  return StackFeedbackStatus.PARTIAL
}

function toSubmittedEvaluation({
  existingInstance,
  evaluation,
  response,
  pointsAwarded,
  newPointsFrom,
  xpAwarded,
  newXpFrom,
  correctness,
}: {
  existingInstance: ExistingResponseInstance
  evaluation: Omit<BaseEvaluationDto, 'instanceId' | 'lastResponse'> & {
    choices?: { ix: number; count: number }[] | null
    responses?: { value: number; count: number }[] | null
    answers?: { value: string; count: number }[] | null
    selectionResponses?:
      | {
          __typename?: 'SingleSelectionResponse'
          answerId: number
          value: string
          count: number
        }[]
      | null
    assessments?: (SingleCaseStudyResponse & {
      __typename?: 'SingleCaseStudyResponse'
    })[]
    studySolutions?: CaseStudyInstanceEvaluationDto['studySolutions']
    solutionRanges?: NumericalInstanceEvaluationDto['solutionRanges']
    exactSolutions?: number[] | null
    solutions?: string[] | null
    answerSolutionIds?: number[] | null
  }
  response: ResponseInput
  pointsAwarded?: number | null
  newPointsFrom?: Date | null
  xpAwarded?: number | null
  newXpFrom?: Date | null
  correctness: number | null
}): PreviousStackInstanceEvaluation | null {
  const base = {
    ...evaluation,
    instanceId: existingInstance.id,
    pointsAwarded,
    newPointsFrom,
    xpAwarded,
    newXpFrom,
    correctness,
  }

  if (
    existingInstance.elementType === ElementType.SC ||
    existingInstance.elementType === ElementType.MC ||
    existingInstance.elementType === ElementType.KPRIM
  ) {
    return {
      __typename: 'ChoicesInstanceEvaluation',
      ...base,
      choices: evaluation.choices ?? [],
      lastResponse: {
        __typename: 'SingleQuestionResponseChoices',
        choices: (response as SingleQuestionResponseChoices).choices.map(
          (choice) => ({
            __typename: 'ChoicesResponseObject' as const,
            ix: choice.ix,
            selected: choice.selected,
          })
        ),
      },
    }
  }

  if (existingInstance.elementType === ElementType.NUMERICAL) {
    return {
      __typename: 'NumericalInstanceEvaluation',
      ...base,
      responses: evaluation.responses ?? [],
      solutionRanges: evaluation.solutionRanges ?? [],
      exactSolutions: evaluation.exactSolutions ?? [],
      lastResponse: {
        __typename: 'SingleQuestionResponseValue',
        value: (response as SingleQuestionResponseValue).value,
      },
    }
  }

  if (existingInstance.elementType === ElementType.FREE_TEXT) {
    return {
      __typename: 'FreeTextInstanceEvaluation',
      ...base,
      answers: evaluation.answers ?? [],
      solutions: evaluation.solutions ?? [],
      lastResponse: {
        __typename: 'SingleQuestionResponseValue',
        value: (response as SingleQuestionResponseValue).value,
      },
    }
  }

  if (existingInstance.elementType === ElementType.SELECTION) {
    return {
      __typename: 'SelectionInstanceEvaluation',
      ...base,
      selectionResponses: evaluation.selectionResponses ?? [],
      answerSolutionIds: evaluation.answerSolutionIds ?? [],
      lastResponse: {
        __typename: 'SingleQuestionResponseSelection',
        selection: (response as SingleQuestionResponseSelection).selection,
      },
    }
  }

  if (existingInstance.elementType === ElementType.CASE_STUDY) {
    return {
      __typename: 'CaseStudyInstanceEvaluation',
      ...base,
      assessments: evaluation.assessments ?? [],
      studySolutions: evaluation.studySolutions ?? [],
      lastResponse: {
        __typename: 'SingleQuestionResponseCaseStudy',
        assessment: (response as SingleQuestionResponseCaseStudy).assessment,
      },
    }
  }

  return null
}

function computeQuestionEvaluation({
  existingInstance,
  results,
  anonymousResults,
  correctness,
  response,
}: {
  existingInstance: ExistingResponseInstance
  results: ElementInstanceResults
  anonymousResults: ElementInstanceResults
  correctness: number | null
  response: ResponseInput
}) {
  const elementData = existingInstance.elementData as ElementData
  const multiplier = getPointsMultiplier(existingInstance.options)

  if (
    (elementData.type === ElementType.SC ||
      elementData.type === ElementType.MC ||
      elementData.type === ElementType.KPRIM) &&
    'choices' in results &&
    'choices' in anonymousResults
  ) {
    const score = computeSimpleAwardedPoints({
      points: POINTS_PER_INSTANCE,
      pointsPercentage: correctness,
      pointsMultiplier: multiplier,
    })
    const xp = computeAwardedXp({ pointsPercentage: correctness })

    return toSubmittedEvaluation({
      existingInstance,
      response,
      correctness,
      evaluation: {
        ...withBaseEvaluation({
          instanceId: existingInstance.id,
          elementType: elementData.type,
          pointsMultiplier: multiplier ?? 1,
          explanation: elementData.explanation,
          feedbacks: elementData.options.choices.map(toQuestionFeedback),
          numAnswers: results.total + anonymousResults.total,
          score,
          xp,
          percentile: correctness ?? 0,
        }),
        choices: combineChoicesResults({
          choices: elementData.options.choices,
          results: results.choices,
          anonymousResults: anonymousResults.choices,
        }),
      },
    })
  }

  if (
    elementData.type === ElementType.NUMERICAL &&
    'responses' in results &&
    'responses' in anonymousResults
  ) {
    const score = correctness
      ? correctness * POINTS_PER_INSTANCE * (multiplier ?? 1)
      : 0
    const xp = computeAwardedXp({ pointsPercentage: correctness })

    return toSubmittedEvaluation({
      existingInstance,
      response,
      correctness,
      evaluation: {
        ...withBaseEvaluation({
          instanceId: existingInstance.id,
          elementType: ElementType.NUMERICAL,
          pointsMultiplier: multiplier ?? 1,
          explanation: elementData.explanation,
          feedbacks: [],
          numAnswers: results.total + anonymousResults.total,
          score,
          xp,
          percentile: correctness ?? 0,
        }),
        responses: combineNumericalResults({ results, anonymousResults }),
        solutionRanges:
          elementData.options.hasSampleSolution &&
          elementData.options.solutionRanges
            ? elementData.options.solutionRanges.map((range) => ({
                __typename: 'NumericalSolutionRange' as const,
                min: range.min ?? null,
                max: range.max ?? null,
              }))
            : [],
        exactSolutions:
          elementData.options.hasSampleSolution &&
          elementData.options.exactSolutions
            ? elementData.options.exactSolutions
            : [],
      },
    })
  }

  if (
    elementData.type === ElementType.FREE_TEXT &&
    'responses' in results &&
    'responses' in anonymousResults
  ) {
    const score = correctness
      ? correctness * POINTS_PER_INSTANCE * (multiplier ?? 1)
      : 0
    const xp = computeAwardedXp({ pointsPercentage: correctness })

    return toSubmittedEvaluation({
      existingInstance,
      response,
      correctness,
      evaluation: {
        ...withBaseEvaluation({
          instanceId: existingInstance.id,
          elementType: ElementType.FREE_TEXT,
          pointsMultiplier: multiplier ?? 1,
          explanation: elementData.explanation,
          feedbacks: [],
          numAnswers: results.total + anonymousResults.total,
          score,
          xp,
          percentile: correctness ?? 0,
        }),
        answers: combineFreeTextResults({ results, anonymousResults }),
        solutions:
          elementData.options.hasSampleSolution && elementData.options.solutions
            ? elementData.options.solutions
            : [],
      },
    })
  }

  if (
    elementData.type === ElementType.SELECTION &&
    'selections' in results &&
    'selections' in anonymousResults
  ) {
    const score = correctness
      ? Math.round(correctness * POINTS_PER_INSTANCE * (multiplier ?? 1))
      : 0
    const xp = computeAwardedXp({ pointsPercentage: correctness })

    return toSubmittedEvaluation({
      existingInstance,
      response,
      correctness,
      evaluation: {
        ...withBaseEvaluation({
          instanceId: existingInstance.id,
          elementType: ElementType.SELECTION,
          pointsMultiplier: multiplier ?? 1,
          explanation: elementData.explanation,
          feedbacks: [],
          numAnswers: results.total + anonymousResults.total,
          score,
          xp,
          percentile: correctness ?? 0,
        }),
        selectionResponses: combineSelectionResults({
          results,
          anonymousResults,
          answerOptions: elementData.options.answerCollection!,
        }),
        answerSolutionIds:
          elementData.options.answerCollectionSolutionIds ?? [],
      },
    })
  }

  if (
    elementData.type === ElementType.CASE_STUDY &&
    'assessments' in results &&
    'assessments' in anonymousResults
  ) {
    const score = correctness
      ? Math.round(correctness * POINTS_PER_INSTANCE * (multiplier ?? 1))
      : 0
    const xp = computeAwardedXp({ pointsPercentage: correctness })

    return toSubmittedEvaluation({
      existingInstance,
      response,
      correctness,
      evaluation: {
        ...withBaseEvaluation({
          instanceId: existingInstance.id,
          elementType: ElementType.CASE_STUDY,
          pointsMultiplier: multiplier ?? 1,
          explanation: elementData.explanation,
          feedbacks: [],
          numAnswers: results.total + anonymousResults.total,
          score,
          xp,
          percentile: correctness ?? 0,
        }),
        assessments: reduceCaseStudyResults({
          results,
          anonymousResults,
          options: elementData.options,
        }),
        studySolutions: elementData.options.cases.map((caseItem) => ({
          __typename: 'CaseStudySolution',
          caseId: caseItem.id,
          solutions: elementData.options.hasSampleSolution
            ? caseItem.solutions
            : [],
        })),
      },
    })
  }

  return null
}

async function respondToQuestion({
  prisma,
  id,
  courseId,
  response,
  answerTime,
  participation,
  participantId,
  skipTracking = false,
}: {
  prisma: PrismaClient
  id: number
  courseId: string
  response: ResponseInput
  answerTime: number
  participation: ParticipationWithParticipant | null
  participantId?: string
  skipTracking?: boolean
}) {
  return await prisma.$transaction(async (tx) => {
    const existingInstance = (await tx.elementInstance.findUnique({
      where: { id },
      include: {
        elementStack: true,
        instanceStatistics: true,
        responses: participantId
          ? {
              where: {
                participantId,
              },
            }
          : false,
      },
    })) as ExistingResponseInstance | null

    if (!existingInstance || !existingInstance.elementData) return null

    const existingResponse =
      existingInstance.responses &&
      existingInstance.responses.length > 0 &&
      existingInstance.responses[0]
        ? existingInstance.responses[0]
        : null
    const elementData = existingInstance.elementData as ElementData
    const caseStudySolutions =
      elementData.type === ElementType.CASE_STUDY
        ? convertCaseStudySolutionsObject({ elementData })
        : undefined
    const { correctness, results, modified } = updateQuestionResults({
      existingInstance,
      participation,
      response,
      caseStudySolutions,
    })

    if (!modified || results === null) return null

    const { newAverageResponseTime, newAverageInstanceTime } = participation
      ? computeNewAverageTimes({
          existingInstance,
          existingResponse,
          answerTime,
        })
      : {
          newAverageInstanceTime: undefined,
          newAverageResponseTime: answerTime,
        }
    const statisticsUpdate = computeUpdatedInstanceStatistics({
      participation,
      existingResponse,
      newAverageInstanceTime,
      answerCorrect: correctness === 1,
      answerPartial: (correctness ?? 0) < 1 && (correctness ?? 0) > 0,
      answerIncorrect: correctness === 0,
      instanceInPracticeQuiz: !!existingInstance.elementStack?.practiceQuizId,
    })
    const updatedInstance = !skipTracking
      ? ((await tx.elementInstance.update({
          where: { id },
          data: {
            results: participation ? results : undefined,
            anonymousResults: participation ? undefined : results,
            instanceStatistics: statisticsUpdate,
          },
          include: {
            elementStack: true,
            instanceStatistics: true,
          },
        })) as ExistingResponseInstance)
      : existingInstance
    const evaluation = computeQuestionEvaluation({
      existingInstance: updatedInstance,
      results: updatedInstance.results as ElementInstanceResults,
      anonymousResults:
        updatedInstance.anonymousResults as ElementInstanceResults,
      correctness,
      response,
    })
    const status = getResponseCorrectnessStatus(evaluation?.percentile ?? 0)

    if (!evaluation || !participation || !participantId) {
      return {
        evaluation,
        status,
      }
    }

    const score = evaluation.score ?? 0
    const xp = evaluation.xp ?? 0
    const {
      pointsAwarded,
      newPointsFrom,
      lastAwardedAt,
      lastXpAwardedAt,
      xpAwarded,
      newXpFrom,
    } = computeAwardedPointsAndXP({
      score,
      xp,
      existingResponse,
      participation,
      instance: updatedInstance,
    })

    if (!skipTracking) {
      const newAggResponses = computeAggregatedResponsesQuestion({
        instance: updatedInstance,
        existingResponse,
        response,
        correctness,
        caseStudySolutions,
      })

      if (!newAggResponses) {
        throw new Error(
          `Failed to compute aggregated responses for question type ${updatedInstance.elementType}`
        )
      }

      const streakIncrement = (evaluation.percentile ?? 0) === 1 ? 1 : 0
      const resultSpacedRepetition = updateSpacedRepetition({
        eFactor: existingResponse?.eFactor ?? 2.5,
        interval: existingResponse?.interval ?? 1,
        streak: (existingResponse?.correctCountStreak ?? 0) + streakIncrement,
        grade: evaluation.percentile ?? 0,
      })

      await createQuestionResponseDetail({
        prisma: tx,
        id,
        participantId,
        courseId,
        response,
        score,
        pointsAwarded,
        xpAwarded,
        answerTime,
        practiceQuizId:
          updatedInstance.elementStack?.practiceQuizId ?? undefined,
        microLearningId:
          updatedInstance.elementStack?.microLearningId ?? undefined,
      })
      await upsertQuestionResponse({
        prisma: tx,
        id,
        participantId,
        courseId,
        response,
        correctness: evaluation.percentile ?? 0,
        score,
        pointsAwarded,
        lastAwardedAt: lastAwardedAt ?? new Date(),
        xpAwarded,
        lastXpAwardedAt: lastXpAwardedAt ?? new Date(),
        newAverageResponseTime,
        existingResponse,
        newAggResponses,
        practiceQuizId:
          updatedInstance.elementStack?.practiceQuizId ?? undefined,
        microLearningId:
          updatedInstance.elementStack?.microLearningId ?? undefined,
        resultSpacedRepetition,
      })

      if (xpAwarded > 0) {
        await incrementParticipantXp({
          prisma: tx,
          participantId,
          xpAwarded,
        })
      }

      if (typeof pointsAwarded === 'number' && pointsAwarded !== null) {
        await updateLeaderboardOnQuestionResponse({
          prisma: tx,
          participantId,
          courseId,
          pointsAwarded,
        })
      }

      if (
        xpAwarded > 0 ||
        (typeof pointsAwarded === 'number' && pointsAwarded !== null)
      ) {
        await upsertDailyTimelineEntry({
          prisma: tx,
          participantId,
          courseId,
          xpAwarded,
          pointsAwarded: pointsAwarded ?? undefined,
        })
      }
    }

    return {
      status,
      evaluation: {
        ...evaluation,
        pointsAwarded,
        newPointsFrom,
        xpAwarded,
        newXpFrom,
      } as PreviousStackInstanceEvaluation,
    }
  })
}

function updateFlashcardResults({
  previousResults,
  response,
}: {
  previousResults: ElementResultsFlashcard
  response: FlashcardCorrectness
}) {
  return {
    ...previousResults,
    [response]: (previousResults[response] ?? 0) + 1,
    total: previousResults.total + 1,
  }
}

async function createFlashcardResponseDetail({
  prisma,
  id,
  response,
  courseId,
  answerTime,
  existingInstance,
  participantId,
}: {
  prisma: PrismaTransactionClient
  id: number
  response: FlashcardCorrectness
  courseId: string
  answerTime: number
  existingInstance: ExistingResponseInstance
  participantId: string
}) {
  await prisma.questionResponseDetail.create({
    data: {
      response: {
        correctness: response,
      },
      timeSpent: answerTime,
      participant: {
        connect: { id: participantId },
      },
      elementInstance: {
        connect: { id },
      },
      practiceQuiz: existingInstance.elementStack?.practiceQuizId
        ? { connect: { id: existingInstance.elementStack.practiceQuizId } }
        : undefined,
      microLearning: existingInstance.elementStack?.microLearningId
        ? { connect: { id: existingInstance.elementStack.microLearningId } }
        : undefined,
      participation: {
        connect: {
          courseId_participantId: {
            courseId,
            participantId,
          },
        },
      },
    },
  })
}

async function upsertFlashcardResponse({
  prisma,
  id,
  participantId,
  courseId,
  response,
  newAverageResponseTime,
  existingInstance,
  existingResponse,
}: {
  prisma: PrismaTransactionClient
  id: number
  participantId: string
  courseId: string
  response: FlashcardCorrectness
  newAverageResponseTime: number
  existingInstance: ExistingResponseInstance
  existingResponse: QuestionResponse | null
}) {
  const previousAggregated = existingResponse?.aggregatedResponses
  const aggregatedResponses =
    previousAggregated && FlashcardCorrectness.CORRECT in previousAggregated
      ? (previousAggregated as ElementResultsFlashcard)
      : {
          [FlashcardCorrectness.INCORRECT]: 0,
          [FlashcardCorrectness.PARTIAL]: 0,
          [FlashcardCorrectness.CORRECT]: 0,
          total: 0,
        }
  const correctness =
    response === FlashcardCorrectness.CORRECT
      ? 1
      : response === FlashcardCorrectness.PARTIAL
        ? 0.5
        : 0
  const responseCorrectness =
    correctness === 1
      ? ResponseCorrectness.CORRECT
      : correctness === 0
        ? ResponseCorrectness.WRONG
        : ResponseCorrectness.PARTIAL
  const resultSpacedRepetition = updateSpacedRepetition({
    eFactor: existingResponse?.eFactor ?? 2.5,
    interval: existingResponse?.interval ?? 1,
    streak:
      (existingResponse?.correctCountStreak ?? 0) +
      Number(response === FlashcardCorrectness.CORRECT),
    grade: correctness,
  })

  await prisma.questionResponse.upsert({
    where: {
      participantId_elementInstanceId: {
        participantId,
        elementInstanceId: id,
      },
    },
    create: {
      participant: {
        connect: { id: participantId },
      },
      averageTimeSpent: newAverageResponseTime ?? 0,
      elementInstance: {
        connect: { id },
      },
      practiceQuiz: existingInstance.elementStack?.practiceQuizId
        ? { connect: { id: existingInstance.elementStack.practiceQuizId } }
        : undefined,
      microLearning: existingInstance.elementStack?.microLearningId
        ? { connect: { id: existingInstance.elementStack.microLearningId } }
        : undefined,
      course: {
        connect: { id: courseId },
      },
      participation: {
        connect: {
          courseId_participantId: {
            courseId,
            participantId,
          },
        },
      },
      firstResponse: {
        correctness: response,
      },
      firstResponseCorrectness: responseCorrectness,
      lastResponse: {
        correctness: response,
      },
      lastResponseCorrectness: responseCorrectness,
      aggregatedResponses: {
        ...aggregatedResponses,
        total: 1,
        [response]: 1,
      },
      trialsCount: 1,
      ...combineNewCorrectnessParams({
        correct: response === FlashcardCorrectness.CORRECT,
        partial: response === FlashcardCorrectness.PARTIAL,
        incorrect: response === FlashcardCorrectness.INCORRECT,
      }),
      eFactor: resultSpacedRepetition.efactor,
      interval: resultSpacedRepetition.interval,
      nextDueAt: resultSpacedRepetition.nextDueAt,
    },
    update: {
      lastResponse: {
        correctness: response,
      },
      lastResponseCorrectness: responseCorrectness,
      averageTimeSpent: newAverageResponseTime ?? 0,
      aggregatedResponses: {
        ...aggregatedResponses,
        [response]: aggregatedResponses[response] + 1,
        total: aggregatedResponses.total + 1,
      },
      trialsCount: {
        increment: 1,
      },
      ...combineCorrectnessParams({
        correct: response === FlashcardCorrectness.CORRECT,
        partial: response === FlashcardCorrectness.PARTIAL,
        incorrect: response === FlashcardCorrectness.INCORRECT,
        existingResponse,
      }),
      eFactor: resultSpacedRepetition.efactor,
      interval: resultSpacedRepetition.interval,
      nextDueAt: resultSpacedRepetition.nextDueAt,
    },
  })
}

async function respondToFlashcard({
  prisma,
  id,
  courseId,
  response,
  answerTime,
  participation,
  participantId,
  skipTracking = false,
}: {
  prisma: PrismaClient
  id: number
  courseId: string
  response: FlashcardCorrectness
  answerTime: number
  participation: ParticipationWithParticipant | null
  participantId?: string
  skipTracking?: boolean
}) {
  const result = {
    grading: flashcardResultMap[response],
    score: null,
  }

  if (skipTracking) return result

  return await prisma.$transaction(async (tx) => {
    const existingInstance = (await tx.elementInstance.findUnique({
      where: {
        id,
        elementType: ElementType.FLASHCARD,
      },
      include: {
        elementStack: true,
        instanceStatistics: true,
        responses: participantId
          ? {
              where: {
                participantId,
              },
            }
          : false,
      },
    })) as ExistingResponseInstance | null

    if (
      !existingInstance ||
      !(
        FlashcardCorrectness.CORRECT in
        (existingInstance.results as ElementResultsFlashcard)
      ) ||
      !(
        FlashcardCorrectness.PARTIAL in
        (existingInstance.anonymousResults as ElementResultsFlashcard)
      )
    ) {
      return null
    }

    const existingResponse =
      existingInstance.responses &&
      existingInstance.responses.length > 0 &&
      existingInstance.responses[0]
        ? existingInstance.responses[0]
        : null
    const newResults = updateFlashcardResults({
      previousResults: (participation
        ? existingInstance.results
        : existingInstance.anonymousResults) as ElementResultsFlashcard,
      response,
    })
    const { newAverageResponseTime, newAverageInstanceTime } = participation
      ? computeNewAverageTimes({
          existingInstance,
          existingResponse,
          answerTime,
        })
      : {
          newAverageInstanceTime: undefined,
          newAverageResponseTime: answerTime,
        }
    const statisticsUpdate = computeUpdatedInstanceStatistics({
      participation,
      existingResponse,
      newAverageInstanceTime,
      answerCorrect: response === FlashcardCorrectness.CORRECT,
      answerPartial: response === FlashcardCorrectness.PARTIAL,
      answerIncorrect: response === FlashcardCorrectness.INCORRECT,
      instanceInPracticeQuiz: !!existingInstance.elementStack?.practiceQuizId,
    })

    await tx.elementInstance.update({
      where: { id },
      data: {
        results: participation ? newResults : undefined,
        anonymousResults: participation ? undefined : newResults,
        instanceStatistics: statisticsUpdate,
      },
    })

    if (!participantId || !participation) return result

    await createFlashcardResponseDetail({
      prisma: tx,
      id,
      response,
      courseId,
      answerTime,
      existingInstance,
      participantId,
    })
    await upsertFlashcardResponse({
      prisma: tx,
      id,
      participantId,
      courseId,
      response,
      newAverageResponseTime,
      existingInstance,
      existingResponse,
    })

    return result
  })
}

async function createContentResponseDetail({
  prisma,
  id,
  courseId,
  answerTime,
  existingInstance,
  participantId,
}: {
  prisma: PrismaTransactionClient
  id: number
  courseId: string
  answerTime: number
  existingInstance: ExistingResponseInstance
  participantId: string
}) {
  await prisma.questionResponseDetail.create({
    data: {
      response: {
        viewed: true,
      },
      timeSpent: answerTime,
      participant: {
        connect: { id: participantId },
      },
      elementInstance: {
        connect: { id },
      },
      practiceQuiz: existingInstance.elementStack?.practiceQuizId
        ? { connect: { id: existingInstance.elementStack.practiceQuizId } }
        : undefined,
      microLearning: existingInstance.elementStack?.microLearningId
        ? { connect: { id: existingInstance.elementStack.microLearningId } }
        : undefined,
      participation: {
        connect: {
          courseId_participantId: {
            courseId,
            participantId,
          },
        },
      },
    },
  })
}

async function upsertContentResponse({
  prisma,
  id,
  participantId,
  courseId,
  newAverageResponseTime,
  existingInstance,
  aggregatedResponses,
  resultSpacedRepetition,
}: {
  prisma: PrismaTransactionClient
  id: number
  participantId: string
  courseId: string
  newAverageResponseTime: number
  existingInstance: ExistingResponseInstance
  aggregatedResponses: ElementResultsContent
  resultSpacedRepetition: SpacedRepetitionResult
}) {
  await prisma.questionResponse.upsert({
    where: {
      participantId_elementInstanceId: {
        participantId,
        elementInstanceId: id,
      },
    },
    create: {
      participant: {
        connect: { id: participantId },
      },
      averageTimeSpent: newAverageResponseTime ?? 0,
      elementInstance: {
        connect: { id },
      },
      practiceQuiz: existingInstance.elementStack?.practiceQuizId
        ? { connect: { id: existingInstance.elementStack.practiceQuizId } }
        : undefined,
      microLearning: existingInstance.elementStack?.microLearningId
        ? { connect: { id: existingInstance.elementStack.microLearningId } }
        : undefined,
      course: {
        connect: { id: courseId },
      },
      participation: {
        connect: {
          courseId_participantId: {
            courseId,
            participantId,
          },
        },
      },
      firstResponse: {
        viewed: true,
      },
      firstResponseCorrectness: ResponseCorrectness.CORRECT,
      lastResponse: {
        viewed: true,
      },
      lastResponseCorrectness: ResponseCorrectness.CORRECT,
      trialsCount: 1,
      aggregatedResponses: {
        total: 1,
      },
      correctCount: 1,
      correctCountStreak: 1,
      lastAnsweredAt: new Date(),
      lastCorrectAt: new Date(),
      eFactor: resultSpacedRepetition.efactor,
      interval: resultSpacedRepetition.interval,
      nextDueAt: resultSpacedRepetition.nextDueAt,
    },
    update: {
      averageTimeSpent: newAverageResponseTime ?? 0,
      lastResponse: {
        viewed: true,
      },
      lastResponseCorrectness: ResponseCorrectness.CORRECT,
      trialsCount: {
        increment: 1,
      },
      aggregatedResponses: {
        total: aggregatedResponses.total + 1,
      },
      correctCount: {
        increment: 1,
      },
      correctCountStreak: {
        increment: 1,
      },
      lastAnsweredAt: new Date(),
      lastCorrectAt: new Date(),
      eFactor: resultSpacedRepetition.efactor,
      interval: resultSpacedRepetition.interval,
      nextDueAt: resultSpacedRepetition.nextDueAt,
    },
  })
}

async function respondToContent({
  prisma,
  id,
  courseId,
  answerTime,
  participation,
  participantId,
  skipTracking = false,
}: {
  prisma: PrismaClient
  id: number
  courseId: string
  answerTime: number
  participation: ParticipationWithParticipant | null
  participantId?: string
  skipTracking?: boolean
}) {
  const result = {
    grading: StackFeedbackStatus.CORRECT,
    score: null,
  }

  if (skipTracking) return result

  return await prisma.$transaction(async (tx) => {
    const existingInstance = (await tx.elementInstance.findUnique({
      where: {
        id,
        elementType: ElementType.CONTENT,
      },
      include: {
        elementStack: true,
        instanceStatistics: true,
        responses: participantId
          ? {
              where: {
                participantId,
              },
            }
          : false,
      },
    })) as ExistingResponseInstance | null

    if (!existingInstance) return null

    const existingResponse =
      existingInstance.responses &&
      existingInstance.responses.length > 0 &&
      existingInstance.responses[0]
        ? existingInstance.responses[0]
        : null
    const { newAverageResponseTime, newAverageInstanceTime } = participation
      ? computeNewAverageTimes({
          existingInstance,
          existingResponse,
          answerTime,
        })
      : {
          newAverageInstanceTime: undefined,
          newAverageResponseTime: answerTime,
        }
    const statisticsUpdate = computeUpdatedInstanceStatistics({
      participation,
      existingResponse,
      newAverageInstanceTime,
      answerCorrect: true,
      answerPartial: false,
      answerIncorrect: false,
      instanceInPracticeQuiz: !!existingInstance.elementStack?.practiceQuizId,
    })
    const previousResults = (
      participation
        ? existingInstance.results
        : existingInstance.anonymousResults
    ) as ElementResultsContent
    const newResults = { total: previousResults.total + 1 }

    await tx.elementInstance.update({
      where: { id },
      data: {
        results: participation ? newResults : undefined,
        anonymousResults: participation ? undefined : newResults,
        instanceStatistics: statisticsUpdate,
      },
    })

    if (!participantId || !participation) return result

    await createContentResponseDetail({
      prisma: tx,
      id,
      courseId,
      answerTime,
      existingInstance,
      participantId,
    })

    const aggregatedResponses = (existingResponse?.aggregatedResponses ?? {
      total: 0,
    }) as ElementResultsContent
    const resultSpacedRepetition = updateSpacedRepetition({
      eFactor: existingResponse?.eFactor ?? 2.5,
      interval: existingResponse?.interval ?? 1,
      streak: (existingResponse?.correctCountStreak ?? 0) + 1,
      grade: 1,
    })

    await upsertContentResponse({
      prisma: tx,
      id,
      participantId,
      courseId,
      newAverageResponseTime,
      existingInstance,
      aggregatedResponses,
      resultSpacedRepetition,
    })

    return result
  })
}

async function respondToElement({
  prisma,
  participantId,
  response,
  courseId,
  answerTime,
  skipTracking = false,
}: {
  prisma: PrismaClient
  participantId?: string
  response: StackResponseInput
  courseId: string
  answerTime: number
  skipTracking?: boolean
}) {
  const participation = participantId
    ? ((await prisma.participation.findUnique({
        where: {
          courseId_participantId: {
            courseId,
            participantId,
          },
        },
        include: {
          participant: true,
        },
      })) as ParticipationWithParticipant | null)
    : null

  if (response.type === ElementType.FLASHCARD && response.flashcardResponse) {
    const result = await respondToFlashcard({
      prisma,
      id: response.instanceId,
      courseId,
      response: response.flashcardResponse,
      answerTime,
      participation,
      participantId,
      skipTracking,
    })

    return result &&
      (result.grading === StackFeedbackStatus.CORRECT ||
        result.grading === StackFeedbackStatus.PARTIAL ||
        result.grading === StackFeedbackStatus.INCORRECT)
      ? { grading: result.grading, score: null, evaluation: null }
      : { grading: null, score: null, evaluation: null }
  }

  if (
    response.type === ElementType.CONTENT &&
    response.contentReponse === true
  ) {
    const result = await respondToContent({
      prisma,
      id: response.instanceId,
      courseId,
      answerTime,
      participation,
      participantId,
      skipTracking,
    })

    return result &&
      (result.grading === StackFeedbackStatus.CORRECT ||
        result.grading === StackFeedbackStatus.PARTIAL ||
        result.grading === StackFeedbackStatus.INCORRECT)
      ? { grading: result.grading, score: null, evaluation: null }
      : { grading: null, score: null, evaluation: null }
  }

  let questionResponse: ResponseInput | null = null
  if (
    response.type === ElementType.SC ||
    response.type === ElementType.MC ||
    response.type === ElementType.KPRIM
  ) {
    questionResponse = { choices: response.choicesResponse ?? [] }
  } else if (response.type === ElementType.NUMERICAL) {
    questionResponse = { value: String(response.numericalResponse) }
  } else if (response.type === ElementType.FREE_TEXT) {
    questionResponse = { value: response.freeTextResponse ?? '' }
  } else if (response.type === ElementType.SELECTION) {
    questionResponse = {
      selection:
        response.selectionResponse?.filter(
          (entry) =>
            entry !== -1 && typeof entry !== 'undefined' && entry !== null
        ) ?? [],
    }
  } else if (response.type === ElementType.CASE_STUDY) {
    questionResponse = { assessment: response.caseStudyResponse ?? [] }
  }

  if (!questionResponse) {
    throw new Error(
      `Submission of practice quiz stack answers not implemented for type ${response.type}`
    )
  }

  const result = await respondToQuestion({
    prisma,
    id: response.instanceId,
    courseId,
    response: questionResponse,
    answerTime,
    participation,
    participantId,
    skipTracking,
  })

  return result
    ? {
        grading: result.status,
        score: result.evaluation?.score ?? 0,
        evaluation: result.evaluation,
      }
    : { grading: null, score: null, evaluation: null }
}

export async function respondToElementStack({
  courseId,
  isOwner,
  participantId,
  prisma,
  responses,
  stackAnswerTime,
  stackId,
}: {
  courseId: string
  isOwner?: boolean
  participantId?: string
  prisma: PrismaClient
  responses: StackResponseInput[]
  stackAnswerTime: number
  stackId: number
}): Promise<PreviousStackEvaluation | null> {
  if (participantId) {
    const stack = await prisma.elementStack.findUnique({
      where: { id: stackId },
      include: {
        microLearning: true,
        elements: {
          include: {
            responses: {
              where: {
                participantId,
              },
            },
          },
        },
      },
    })

    if (
      !isOwner &&
      stack?.microLearning &&
      (stack.elements.some((element) => element.responses.length > 0) ||
        dayjs().isAfter(dayjs(stack.microLearning.scheduledEndAt)))
    ) {
      return null
    }
  }

  let stackScore: number | undefined = undefined
  let stackFeedback = StackFeedbackStatus.UNANSWERED
  const evaluations: PreviousStackInstanceEvaluation[] = []
  const elementAnswerTime =
    responses.length > 0 ? Math.round(stackAnswerTime / responses.length) : 0

  for (const response of responses) {
    const { grading, score, evaluation } = await respondToElement({
      prisma,
      participantId,
      response,
      courseId,
      answerTime: elementAnswerTime,
      skipTracking: isOwner,
    })

    if (grading) {
      stackFeedback = combineStackStatus({
        prevStatus: stackFeedback,
        newStatus: grading,
      })
    }

    if (score !== null) {
      stackScore =
        typeof stackScore === 'undefined' ? score : stackScore + score
    }

    if (evaluation) {
      evaluations.push(evaluation)
    }
  }

  return {
    id: stackId,
    status: stackFeedback,
    score: stackScore ?? null,
    evaluations,
  }
}
