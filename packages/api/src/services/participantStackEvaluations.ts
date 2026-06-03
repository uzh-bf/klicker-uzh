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
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import type {
  CaseStudyElementData,
  Choice,
  ChoicesElementData,
  ContentElementData,
  ElementData,
  ElementOptionsAnswerCollection,
  ElementOptionsCaseStudy,
  ElementResultsCaseStudy,
  ElementResultsChoices,
  ElementResultsOpen,
  ElementResultsSelection,
  FlashcardElementData,
  FreeTextElementData,
  NumericalElementData,
  SelectionElementData,
  SingleCaseStudyResponse,
  SingleQuestionResponseCaseStudy,
  SingleQuestionResponseChoices,
  SingleQuestionResponseContent,
  SingleQuestionResponseFlashcard,
  SingleQuestionResponseSelection,
  SingleQuestionResponseValue,
} from '@klicker-uzh/types'
import { FlashcardCorrectness, StackFeedbackStatus } from '@klicker-uzh/types'

const POINTS_PER_INSTANCE = 10

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
    newPointsFrom: null,
    xpAwarded,
    newXpFrom: null,
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
