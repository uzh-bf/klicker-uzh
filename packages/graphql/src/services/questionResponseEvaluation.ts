import {
  computeAwardedXp,
  computeSimpleAwardedPoints,
} from '@klicker-uzh/grading'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  CaseStudyElementData,
  Choice,
  ChoicesElementData,
  ElementData,
  ElementInstanceResults,
  ElementOptionsAnswerCollection,
  ElementOptionsCaseStudy,
  ElementResultsCaseStudy,
  ElementResultsChoices,
  ElementResultsOpen,
  ElementResultsSelection,
  FreeTextElementData,
  InstanceEvaluationCaseStudy,
  InstanceEvaluationChoices,
  InstanceEvaluationFreeText,
  InstanceEvaluationNumerical,
  InstanceEvaluationSelection,
  NumericalElementData,
  SelectionElementData,
  SingleCaseStudyResponse,
} from '@klicker-uzh/types'
import { max, mean, median, min, quantileSeq, std } from 'mathjs'
import type { ICaseStudyElementEvaluationResults } from '@/schema/evaluation.js'

export const POINTS_PER_INSTANCE = 10

type SharedEvaluationProps =
  | 'elementType'
  | 'feedbacks'
  | 'numAnswers'
  | 'score'
  | 'xp'
  | 'percentile'
  | 'pointsMultiplier'
  | 'explanation'

export type ChoicesEvaluationReturnType = Pick<
  InstanceEvaluationChoices,
  SharedEvaluationProps | 'choices'
>
export type NumericalEvaluationReturnType = Pick<
  InstanceEvaluationNumerical,
  SharedEvaluationProps | 'solutionRanges' | 'exactSolutions' | 'responses'
>
export type FreeTextEvaluationReturnType = Pick<
  InstanceEvaluationFreeText,
  SharedEvaluationProps | 'solutions' | 'answers'
>
export type SelectionEvaluationReturnType = Pick<
  InstanceEvaluationSelection,
  SharedEvaluationProps | 'answerSolutionIds' | 'selectionResponses'
>
export type CaseStudyEvaluationReturnType = Pick<
  InstanceEvaluationCaseStudy,
  SharedEvaluationProps | 'assessments' | 'studySolutions'
>

export function combineChoicesResults({
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
    value: choice.value,
    count: (results[choice.ix] ?? 0) + (anonymousResults[choice.ix] ?? 0),
    correct: choice.correct,
    feedback: choice.feedback,
  }))
}

export function combineNumericalResults({
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
        (r) => Math.abs(r.value - responseValue) < Number.EPSILON
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

export function combineFreeTextResults({
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
      const ix = acc.findIndex((r) => r.value === response.value)
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

export function combineSelectionResults({
  results,
  anonymousResults,
  answerOptions,
}: {
  results: ElementResultsSelection
  anonymousResults: ElementResultsSelection
  answerOptions: ElementOptionsAnswerCollection
}) {
  return answerOptions.entries.map((option) => ({
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
}): SingleCaseStudyResponse[] {
  return options.cases.flatMap((caseObj) =>
    options.items
      ? options.items.flatMap((item) =>
          options.criteria.map((criterion) => {
            const caseId = caseObj.id
            const itemId = item.id
            const criterionId = criterion.id
            const resultValues = Object.values(
              results.assessments[caseId]?.[itemId]?.[criterionId] ?? {}
            ).map((r) => r.value)
            const anonymousResultValues = Object.values(
              anonymousResults.assessments[caseId]?.[itemId]?.[criterionId] ??
                {}
            ).map((r) => r.value)

            return {
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

export function computeNumericalStatistics(
  results: {
    value: number
    count: number
    correct?: boolean | null
  }[]
) {
  const valueArray = results.reduce<number[]>((acc, { count, value }) => {
    const elements = Array(count).fill(value)
    return acc.concat(elements)
  }, [])

  return valueArray.length > 0
    ? {
        max: max(valueArray),
        mean: mean(valueArray),
        median: median(valueArray),
        min: min(valueArray),
        q1: quantileSeq(valueArray, 0.25) as number,
        q3: quantileSeq(valueArray, 0.75) as number,
        sd: std(valueArray) as unknown as number,
      }
    : null
}

export function combineCaseStudyResults({
  results,
  anonymousResults,
  options,
}: {
  results: ElementResultsCaseStudy
  anonymousResults: ElementResultsCaseStudy
  options: ElementOptionsCaseStudy
}): ICaseStudyElementEvaluationResults['caseResults'] {
  return options.cases.map((caseObj) => {
    const caseSolutions = caseObj.solutions

    return {
      caseId: caseObj.id,
      items:
        options.items?.map((item) => {
          const itemSolutions = caseSolutions?.find((s) => s.itemId === item.id)

          return {
            itemId: item.id,
            criteria: options.criteria.map((criterion) => {
              const criterionSolution = itemSolutions?.criteriaSolutions.find(
                (c) => c.criterionId === criterion.id
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
              ].reduce<{
                [valueHash: string]: {
                  value: number
                  count: number
                  correct?: boolean
                }
              }>((acc, [key, entry]) => {
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
                responses,
              }
            }),
          }
        }) ?? [],
    }
  })
}

export function evaluateChoicesElementResponse({
  elementData,
  results,
  anonymousResults,
  correctness,
  multiplier,
}: {
  elementData: ChoicesElementData
  results: ElementResultsChoices
  anonymousResults: ElementResultsChoices
  correctness: number | null
  multiplier?: number
}): ChoicesEvaluationReturnType | null {
  return {
    elementType: elementData.type,
    feedbacks: elementData.options.choices,
    numAnswers: results.total + anonymousResults.total,
    choices: combineChoicesResults({
      choices: elementData.options.choices,
      results: results.choices,
      anonymousResults: anonymousResults.choices,
    }),
    score: computeSimpleAwardedPoints({
      points: POINTS_PER_INSTANCE,
      pointsPercentage: correctness,
      pointsMultiplier: multiplier,
    }),
    xp: computeAwardedXp({ pointsPercentage: correctness }),
    percentile: correctness ?? 0,
    pointsMultiplier: multiplier ?? 1,
    explanation: elementData.explanation,
  }
}

export function evaluateNumericalElementResponse({
  elementData,
  results,
  anonymousResults,
  correctness,
  multiplier,
}: {
  elementData: NumericalElementData
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
  correctness: number | null
  multiplier?: number
}): NumericalEvaluationReturnType | null {
  return {
    elementType: DB.ElementType.NUMERICAL,
    feedbacks: [],
    numAnswers: results.total + anonymousResults.total,
    responses: combineNumericalResults({ results, anonymousResults }),
    score: correctness
      ? correctness * POINTS_PER_INSTANCE * (multiplier ?? 1)
      : 0,
    xp: computeAwardedXp({ pointsPercentage: correctness }),
    percentile: correctness ?? 0,
    pointsMultiplier: multiplier ?? 1,
    explanation: elementData.explanation,
    solutionRanges: elementData.options.solutionRanges ?? [],
    exactSolutions: elementData.options.exactSolutions ?? [],
  }
}

export function evaluateFreeTextElementResponse({
  elementData,
  results,
  anonymousResults,
  correctness,
  multiplier,
}: {
  elementData: FreeTextElementData
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
  correctness: number | null
  multiplier?: number
}): FreeTextEvaluationReturnType | null {
  return {
    elementType: DB.ElementType.FREE_TEXT,
    feedbacks: [],
    numAnswers: results.total + anonymousResults.total,
    answers: combineFreeTextResults({ results, anonymousResults }),
    score: correctness
      ? correctness * POINTS_PER_INSTANCE * (multiplier ?? 1)
      : 0,
    xp: computeAwardedXp({ pointsPercentage: correctness }),
    percentile: correctness ?? 0,
    pointsMultiplier: multiplier ?? 1,
    explanation: elementData.explanation,
    solutions: elementData.options.solutions ?? [],
  }
}

export function evaluateSelectionElementResponse({
  elementData,
  results,
  anonymousResults,
  correctness,
  multiplier,
}: {
  elementData: SelectionElementData
  results: ElementResultsSelection
  anonymousResults: ElementResultsSelection
  correctness: number | null
  multiplier?: number
}): SelectionEvaluationReturnType | null {
  return {
    elementType: DB.ElementType.SELECTION,
    feedbacks: [],
    numAnswers: results.total + anonymousResults.total,
    selectionResponses: combineSelectionResults({
      results,
      anonymousResults,
      answerOptions: elementData.options.answerCollection!,
    }),
    score: correctness
      ? Math.round(correctness * POINTS_PER_INSTANCE * (multiplier ?? 1))
      : 0,
    xp: computeAwardedXp({ pointsPercentage: correctness }),
    percentile: correctness ?? 0,
    pointsMultiplier: multiplier ?? 1,
    explanation: elementData.explanation,
    answerSolutionIds: elementData.options.answerCollectionSolutionIds ?? [],
  }
}

export function evaluateCaseStudyElementResponse({
  elementData,
  results,
  anonymousResults,
  correctness,
  multiplier,
}: {
  elementData: CaseStudyElementData
  results: ElementResultsCaseStudy
  anonymousResults: ElementResultsCaseStudy
  correctness: number | null
  multiplier?: number
}): CaseStudyEvaluationReturnType | null {
  return {
    elementType: DB.ElementType.CASE_STUDY,
    feedbacks: [],
    numAnswers: results.total + anonymousResults.total,
    assessments: reduceCaseStudyResults({
      results,
      anonymousResults,
      options: elementData.options,
    }),
    studySolutions: elementData.options.cases.map((caseItem) => ({
      caseId: caseItem.id,
      solutions: elementData.options.hasSampleSolution
        ? caseItem.solutions!
        : [],
    })),
    score: correctness
      ? Math.round(correctness * POINTS_PER_INSTANCE * (multiplier ?? 1))
      : 0,
    xp: computeAwardedXp({ pointsPercentage: correctness }),
    percentile: correctness ?? 0,
    pointsMultiplier: multiplier ?? 1,
    explanation: elementData.explanation,
  }
}

export function computeQuestionEvaluation({
  elementData,
  results,
  anonymousResults,
  correctness,
  multiplier,
}: {
  elementData: ElementData
  results: ElementInstanceResults
  anonymousResults: ElementInstanceResults
  correctness: number | null
  multiplier?: number
}) {
  if (
    (elementData.type === DB.ElementType.SC ||
      elementData.type === DB.ElementType.MC ||
      elementData.type === DB.ElementType.KPRIM) &&
    'choices' in results &&
    'choices' in anonymousResults
  ) {
    return evaluateChoicesElementResponse({
      elementData,
      results,
      anonymousResults,
      correctness,
      multiplier,
    })
  } else if (
    elementData.type === DB.ElementType.NUMERICAL &&
    'responses' in results &&
    'responses' in anonymousResults
  ) {
    return evaluateNumericalElementResponse({
      elementData,
      results,
      anonymousResults,
      correctness,
      multiplier,
    })
  } else if (
    elementData.type === DB.ElementType.FREE_TEXT &&
    'responses' in results &&
    'responses' in anonymousResults
  ) {
    return evaluateFreeTextElementResponse({
      elementData,
      results,
      anonymousResults,
      correctness,
      multiplier,
    })
  } else if (
    elementData.type === DB.ElementType.SELECTION &&
    'selections' in results &&
    'selections' in anonymousResults
  ) {
    return evaluateSelectionElementResponse({
      elementData,
      results,
      anonymousResults,
      correctness,
      multiplier,
    })
  } else if (
    elementData.type === DB.ElementType.CASE_STUDY &&
    'assessments' in results &&
    'assessments' in anonymousResults
  ) {
    return evaluateCaseStudyElementResponse({
      elementData,
      results,
      anonymousResults,
      correctness,
      multiplier,
    })
  }

  return null
}
