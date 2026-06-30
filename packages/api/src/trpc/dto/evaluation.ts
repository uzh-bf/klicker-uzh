import {
  ElementBlockStatus,
  ElementType,
  PublicationStatus,
  type ConfusionTimestep,
  type Locale,
} from '@klicker-uzh/prisma/client'
import type {
  Choice,
  ElementData,
  ElementOptionsAnswerCollection,
  ElementOptionsCaseStudy,
  ElementOptionsChoices,
  ElementOptionsFreeText,
  ElementOptionsNumerical,
  ElementOptionsSelection,
  ElementResultsCaseStudy,
  ElementResultsChoices,
  ElementResultsContent,
  ElementResultsFlashcard,
  ElementResultsOpen,
  ElementResultsSelection,
} from '@klicker-uzh/types'
import { FlashcardCorrectness } from '@klicker-uzh/types'

type EvaluationElementInstanceSource = {
  id: number
  elementData: unknown
  results: unknown
  anonymousResults: unknown
}

type EvaluationStackSource = {
  id: number
  order: number
  elements: EvaluationElementInstanceSource[]
  active?: boolean
  displayName?: string | null
  description?: string | null
  status?: ElementBlockStatus | null
  expiresAt?: Date | null
  timeLimit?: number | null
}

type ActivityEvaluationSource = {
  id: string
  name: string
  displayName?: string | null
  description?: string | null
  courseId?: string | null
  stacks: EvaluationStackSource[]
}

type LiveQuizEvaluationSource = {
  id: string
  name: string
  displayName?: string | null
  description?: string | null
  courseLanguage?: Locale | null
  isAssessmentEnabled?: boolean | null
  pinCode?: string | null
  status: PublicationStatus
  blocks: EvaluationStackSource[]
  feedbacks: EvaluationFeedbackSource[]
  confusionFeedbacks: ConfusionTimestep[]
  course?: { language: Locale } | null
}

type EvaluationFeedbackSource = {
  id: number
  isPublished: boolean
  isPinned: boolean
  isResolved: boolean
  content: string
  votes: number
  resolvedAt?: Date | null
  createdAt: Date
  responses?: {
    id: number
    content: string
    positiveReactions: number
    negativeReactions: number
    createdAt?: Date | null
  }[]
}

type CommonEvaluationProps = {
  id: number
  type: ElementType
  name: string
  content: string
  explanation?: string | null
  hasSampleSolution: boolean
  hasAnswerFeedbacks: boolean
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
    __typename: 'ChoiceElementResults' as const,
    ix: choice.ix,
    value: choice.value,
    count: (results[choice.ix] ?? 0) + (anonymousResults[choice.ix] ?? 0),
    correct: choice.correct,
    feedback: choice.feedback,
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
  ].reduce<{ value: number; count: number; correct?: boolean | null }[]>(
    (acc, response) => {
      const responseValue = parseFloat(response.value)
      const ix = acc.findIndex(
        (entry) => Math.abs(entry.value - responseValue) < Number.EPSILON
      )

      if (ix === -1) {
        acc.push({
          value: responseValue,
          count: response.count,
          correct: response.correct,
        })
      } else {
        acc[ix] = {
          ...acc[ix]!,
          count: acc[ix]!.count + response.count,
        }
      }

      return acc
    },
    []
  )
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
  ].reduce<{ value: string; count: number; correct?: boolean | null }[]>(
    (acc, response) => {
      const ix = acc.findIndex((entry) => entry.value === response.value)

      if (ix === -1) {
        acc.push({
          value: response.value,
          count: response.count,
          correct: response.correct,
        })
      } else {
        acc[ix] = {
          ...acc[ix]!,
          count: acc[ix]!.count + response.count,
        }
      }

      return acc
    },
    []
  )
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

function quantile(sortedValues: number[], q: number) {
  if (sortedValues.length === 0) return 0
  if (sortedValues.length === 1) return sortedValues[0]!

  const position = (sortedValues.length - 1) * q
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  const lower = sortedValues[lowerIndex]!
  const upper = sortedValues[upperIndex]!

  return lower + (upper - lower) * (position - lowerIndex)
}

function computeNumericalStatistics(
  results: {
    value: number
    count: number
  }[]
) {
  const values = results
    .flatMap(({ count, value }) => Array(count).fill(value) as number[])
    .sort((a, b) => a - b)

  if (values.length === 0) return null

  const sum = values.reduce((acc, value) => acc + value, 0)
  const mean = sum / values.length
  const variance =
    values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / values.length

  return {
    __typename: 'Statistics' as const,
    max: values[values.length - 1]!,
    mean,
    median: quantile(values, 0.5),
    min: values[0]!,
    q1: quantile(values, 0.25),
    q3: quantile(values, 0.75),
    sd: Math.sqrt(variance),
  }
}

function combineCaseStudyResults({
  results,
  anonymousResults,
  options,
}: {
  results: ElementResultsCaseStudy
  anonymousResults: ElementResultsCaseStudy
  options: ElementOptionsCaseStudy
}) {
  return options.cases.map((caseObj) => {
    const caseSolutions = caseObj.solutions

    return {
      __typename: 'CaseStudyElementResultCase' as const,
      caseId: caseObj.id,
      items:
        options.items?.map((item) => {
          const itemSolutions = caseSolutions?.find(
            (solution) => solution.itemId === item.id
          )

          return {
            __typename: 'CaseStudyElementResultItem' as const,
            itemId: item.id,
            criteria: options.criteria.map((criterion) => {
              const criterionSolution = itemSolutions?.criteriaSolutions.find(
                (solution) => solution.criterionId === criterion.id
              )
              const criterionResults =
                results.assessments[caseObj.id]?.[item.id]?.[criterion.id]
              const criterionAnonymousResults =
                anonymousResults.assessments[caseObj.id]?.[item.id]?.[
                  criterion.id
                ]

              const mergedResults = [
                ...Object.entries(criterionResults ?? {}),
                ...Object.entries(criterionAnonymousResults ?? {}),
              ].reduce<
                Record<
                  string,
                  { value: number; count: number; correct?: boolean }
                >
              >((acc, [key, entry]) => {
                if (acc[key]) {
                  acc[key] = {
                    value: acc[key]!.value,
                    count: acc[key]!.count + entry.count,
                    correct: acc[key]!.correct ?? entry.correct,
                  }
                } else {
                  acc[key] = entry
                }

                return acc
              }, {})

              const responses = Object.values(mergedResults)
              const isLikertCriterion = !!criterion.labels

              return {
                __typename: 'CaseStudyElementResultCriterion' as const,
                criterionId: criterion.id,
                name: criterion.name,
                min: criterion.min,
                max: criterion.max,
                step: criterion.step,
                unit: criterion.unit,
                labels: criterion.labels,
                solutionMin: criterionSolution?.min
                  ? isLikertCriterion
                    ? criterionSolution.min - 0.5
                    : criterionSolution.min
                  : undefined,
                solutionMax: criterionSolution?.max
                  ? isLikertCriterion
                    ? criterionSolution.max + 0.5
                    : criterionSolution.max
                  : undefined,
                statistics:
                  responses.length > 0
                    ? (computeNumericalStatistics(responses) ?? undefined)
                    : undefined,
                responses: responses.map((response) => ({
                  __typename: 'CaseStudyElementResultResponse' as const,
                  value: response.value,
                  count: response.count,
                })),
              }
            }),
          }
        }) ?? [],
    }
  })
}

function computeChoicesEvaluation({
  options,
  results,
  anonymousResults,
  common,
}: {
  options: ElementOptionsChoices
  results: ElementResultsChoices
  anonymousResults: ElementResultsChoices
  common: CommonEvaluationProps
}) {
  return {
    __typename: 'ChoicesActivityEvaluationData' as const,
    ...common,
    results: {
      __typename: 'ChoicesElementResults' as const,
      totalAnswers: results.total + anonymousResults.total,
      anonymousAnswers: anonymousResults.total,
      choices: combineChoicesResults({
        choices: options.choices,
        results: results.choices,
        anonymousResults: anonymousResults.choices,
      }),
    },
  }
}

function computeNumericalEvaluation({
  options,
  results,
  anonymousResults,
  common,
}: {
  options: ElementOptionsNumerical
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
  common: CommonEvaluationProps
}) {
  const combinedResults = combineNumericalResults({ results, anonymousResults })

  return {
    __typename: 'NumericalActivityEvaluationData' as const,
    ...common,
    results: {
      __typename: 'NumericalElementResults' as const,
      totalAnswers: results.total + anonymousResults.total,
      anonymousAnswers: anonymousResults.total,
      maxValue: options.restrictions?.max,
      minValue: options.restrictions?.min,
      solutionRanges: options.solutionRanges,
      exactSolutions: options.exactSolutions,
      responseValues: combinedResults.map((response) => ({
        __typename: 'NumericalResponseValue' as const,
        ...response,
      })),
    },
    statistics: computeNumericalStatistics(combinedResults),
  }
}

function computeFreeTextEvaluation({
  options,
  results,
  anonymousResults,
  common,
}: {
  options: ElementOptionsFreeText
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
  common: CommonEvaluationProps
}) {
  return {
    __typename: 'FreeTextActivityEvaluationData' as const,
    ...common,
    results: {
      __typename: 'FreeElementResults' as const,
      totalAnswers: results.total + anonymousResults.total,
      anonymousAnswers: anonymousResults.total,
      maxLength: options.restrictions?.maxLength,
      solutions: options.solutions,
      responses: combineFreeTextResults({ results, anonymousResults }).map(
        (response) => ({
          __typename: 'FreeTextResponseValue' as const,
          ...response,
        })
      ),
    },
  }
}

function computeSelectionEvaluation({
  options,
  results,
  anonymousResults,
  common,
}: {
  options: ElementOptionsSelection
  results: ElementResultsSelection
  anonymousResults: ElementResultsSelection
  common: CommonEvaluationProps
}) {
  return {
    __typename: 'SelectionActivityEvaluationData' as const,
    ...common,
    results: {
      __typename: 'SelectionElementResults' as const,
      totalAnswers: results.total + anonymousResults.total,
      anonymousAnswers: anonymousResults.total,
      numberOfInputs: options.numberOfInputs,
      answerSolutionIds: options.answerCollectionSolutionIds,
      selectionResponses: combineSelectionResults({
        results,
        anonymousResults,
        answerOptions: options.answerCollection!,
      }),
    },
  }
}

function computeCaseStudyEvaluation({
  options,
  results,
  anonymousResults,
  common,
}: {
  options: ElementOptionsCaseStudy
  results: ElementResultsCaseStudy
  anonymousResults: ElementResultsCaseStudy
  common: CommonEvaluationProps
}) {
  return {
    __typename: 'CaseStudyActivityEvaluationData' as const,
    ...common,
    cases: options.cases.map((caseObj) => ({
      __typename: 'CaseStudyElementResultCaseInfo' as const,
      id: caseObj.id,
      name: caseObj.title,
      description: caseObj.description,
    })),
    items:
      options.items?.map((item) => ({
        __typename: 'CaseStudyElementResultItemInfo' as const,
        id: item.id,
        name: item.value,
      })) ?? [],
    criteria: options.criteria.map((criterion) => ({
      __typename: 'CaseStudyElementResultCriterionInfo' as const,
      id: criterion.id,
      name: criterion.name,
      labels: criterion.labels ?? null,
      min: criterion.min,
      max: criterion.max,
      step: criterion.step,
      unit: criterion.unit,
    })),
    results: {
      __typename: 'CaseStudyElementResults' as const,
      totalAnswers: results.total + anonymousResults.total,
      anonymousAnswers: anonymousResults.total,
      caseResults: combineCaseStudyResults({
        results,
        anonymousResults,
        options,
      }),
    },
  }
}

function computeFlashcardEvaluation({
  results,
  anonymousResults,
  common,
}: {
  results: ElementResultsFlashcard
  anonymousResults: ElementResultsFlashcard
  common: CommonEvaluationProps
}) {
  return {
    __typename: 'FlashcardActivityEvaluationData' as const,
    ...common,
    results: {
      __typename: 'FlashcardElementResults' as const,
      totalAnswers: results.total + anonymousResults.total,
      anonymousAnswers: anonymousResults.total,
      correctCount:
        results[FlashcardCorrectness.CORRECT] +
        anonymousResults[FlashcardCorrectness.CORRECT],
      partialCount:
        results[FlashcardCorrectness.PARTIAL] +
        anonymousResults[FlashcardCorrectness.PARTIAL],
      incorrectCount:
        results[FlashcardCorrectness.INCORRECT] +
        anonymousResults[FlashcardCorrectness.INCORRECT],
    },
  }
}

function computeContentEvaluation({
  results,
  anonymousResults,
  common,
}: {
  results: ElementResultsContent
  anonymousResults: ElementResultsContent
  common: CommonEvaluationProps
}) {
  return {
    __typename: 'ContentActivityEvaluationData' as const,
    ...common,
    results: {
      __typename: 'ContentElementResults' as const,
      totalAnswers: results.total + anonymousResults.total,
      anonymousAnswers: anonymousResults.total,
    },
  }
}

function computeInstanceEvaluation(instance: EvaluationElementInstanceSource) {
  const elementData = instance.elementData as ElementData
  const hasSampleSolution =
    'options' in elementData && 'hasSampleSolution' in elementData.options
      ? (elementData.options.hasSampleSolution ?? false)
      : false
  const hasAnswerFeedbacks =
    'options' in elementData && 'hasAnswerFeedbacks' in elementData.options
      ? (elementData.options.hasAnswerFeedbacks ?? false)
      : false
  const common = {
    id: instance.id,
    type: elementData.type as ElementType,
    name: elementData.name,
    content: elementData.content,
    explanation: elementData.explanation,
    hasSampleSolution,
    hasAnswerFeedbacks,
  }

  if (
    (elementData.type === ElementType.SC ||
      elementData.type === ElementType.MC ||
      elementData.type === ElementType.KPRIM) &&
    instance.results &&
    typeof instance.results === 'object' &&
    'choices' in instance.results &&
    instance.anonymousResults &&
    typeof instance.anonymousResults === 'object' &&
    'choices' in instance.anonymousResults
  ) {
    return computeChoicesEvaluation({
      options: elementData.options,
      results: instance.results as ElementResultsChoices,
      anonymousResults: instance.anonymousResults as ElementResultsChoices,
      common,
    })
  }

  if (
    elementData.type === ElementType.NUMERICAL &&
    instance.results &&
    typeof instance.results === 'object' &&
    'responses' in instance.results &&
    instance.anonymousResults &&
    typeof instance.anonymousResults === 'object' &&
    'responses' in instance.anonymousResults
  ) {
    return computeNumericalEvaluation({
      options: elementData.options,
      results: instance.results as ElementResultsOpen,
      anonymousResults: instance.anonymousResults as ElementResultsOpen,
      common,
    })
  }

  if (
    elementData.type === ElementType.FREE_TEXT &&
    instance.results &&
    typeof instance.results === 'object' &&
    'responses' in instance.results &&
    instance.anonymousResults &&
    typeof instance.anonymousResults === 'object' &&
    'responses' in instance.anonymousResults
  ) {
    return computeFreeTextEvaluation({
      options: elementData.options,
      results: instance.results as ElementResultsOpen,
      anonymousResults: instance.anonymousResults as ElementResultsOpen,
      common,
    })
  }

  if (
    elementData.type === ElementType.SELECTION &&
    instance.results &&
    typeof instance.results === 'object' &&
    'selections' in instance.results &&
    instance.anonymousResults &&
    typeof instance.anonymousResults === 'object' &&
    'selections' in instance.anonymousResults
  ) {
    return computeSelectionEvaluation({
      options: elementData.options,
      results: instance.results as ElementResultsSelection,
      anonymousResults: instance.anonymousResults as ElementResultsSelection,
      common,
    })
  }

  if (
    elementData.type === ElementType.CASE_STUDY &&
    instance.results &&
    typeof instance.results === 'object' &&
    'assessments' in instance.results &&
    instance.anonymousResults &&
    typeof instance.anonymousResults === 'object' &&
    'assessments' in instance.anonymousResults
  ) {
    return computeCaseStudyEvaluation({
      options: elementData.options,
      results: instance.results as ElementResultsCaseStudy,
      anonymousResults: instance.anonymousResults as ElementResultsCaseStudy,
      common,
    })
  }

  if (
    elementData.type === ElementType.FLASHCARD &&
    instance.results &&
    typeof instance.results === 'object' &&
    FlashcardCorrectness.CORRECT in instance.results &&
    instance.anonymousResults &&
    typeof instance.anonymousResults === 'object' &&
    FlashcardCorrectness.CORRECT in instance.anonymousResults
  ) {
    return computeFlashcardEvaluation({
      results: instance.results as ElementResultsFlashcard,
      anonymousResults: instance.anonymousResults as ElementResultsFlashcard,
      common,
    })
  }

  if (elementData.type === ElementType.CONTENT) {
    return computeContentEvaluation({
      results: instance.results as ElementResultsContent,
      anonymousResults: instance.anonymousResults as ElementResultsContent,
      common,
    })
  }

  return undefined
}

export function computeStackEvaluation(stacks: EvaluationStackSource[]) {
  return stacks.map((stack) => ({
    __typename: 'StackEvaluation' as const,
    stackId: stack.id,
    stackName: stack.displayName ?? null,
    stackDescription: stack.description ?? null,
    stackOrder: stack.order,
    stackActive: stack.active ?? false,
    status: stack.status ?? null,
    expiresAt: stack.expiresAt ?? null,
    timeLimit: stack.timeLimit ?? null,
    instances: stack.elements
      .map((instance) => computeInstanceEvaluation(instance))
      .filter((instance) => typeof instance !== 'undefined'),
  }))
}

export function toActivityEvaluation(
  activity: ActivityEvaluationSource | null
) {
  if (!activity) return null

  return {
    __typename: 'ActivityEvaluation' as const,
    id: activity.id,
    name: activity.name,
    displayName: activity.displayName,
    description: activity.description,
    courseId: activity.courseId,
    results: computeStackEvaluation(activity.stacks),
  }
}

function toEvaluationFeedback(feedback: EvaluationFeedbackSource) {
  return {
    __typename: 'Feedback' as const,
    id: feedback.id,
    isPublished: feedback.isPublished,
    isPinned: feedback.isPinned,
    isResolved: feedback.isResolved,
    content: feedback.content,
    votes: feedback.votes,
    resolvedAt: feedback.resolvedAt ?? null,
    createdAt: feedback.createdAt,
    responses:
      feedback.responses?.map((response) => ({
        __typename: 'FeedbackResponse' as const,
        id: response.id,
        content: response.content,
        positiveReactions: response.positiveReactions,
        negativeReactions: response.negativeReactions,
        createdAt: response.createdAt ?? null,
      })) ?? null,
  }
}

function toConfusionTimestep(confusion: ConfusionTimestep) {
  return {
    __typename: 'ConfusionTimestep' as const,
    speed: confusion.speed,
    difficulty: confusion.difficulty,
    createdAt: confusion.createdAt,
  }
}

export function toLiveQuizEvaluation({
  activeBlockWithResults,
  liveQuiz,
}: {
  activeBlockWithResults?: EvaluationStackSource
  liveQuiz: LiveQuizEvaluationSource | null
}) {
  if (!liveQuiz) return null

  const blocks = activeBlockWithResults
    ? [...liveQuiz.blocks, { ...activeBlockWithResults, active: true }]
    : liveQuiz.blocks

  return {
    __typename: 'ActivityEvaluation' as const,
    id: liveQuiz.id,
    name: liveQuiz.name,
    displayName: liveQuiz.displayName,
    description: liveQuiz.description,
    courseLanguage: liveQuiz.course?.language ?? liveQuiz.courseLanguage,
    isAssessmentEnabled: liveQuiz.isAssessmentEnabled,
    pinCode: liveQuiz.pinCode,
    results: computeStackEvaluation(blocks),
    feedbacks:
      liveQuiz.status === PublicationStatus.ENDED
        ? liveQuiz.feedbacks.map(toEvaluationFeedback)
        : null,
    confusionFeedbacks:
      liveQuiz.status === PublicationStatus.ENDED
        ? liveQuiz.confusionFeedbacks.map(toConfusionTimestep)
        : null,
  }
}
