import type {
  CaseStudyElementOptions,
  CaseStudyInstanceEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import type { CaseStudySolutionsObject } from '@klicker-uzh/types'
import { useMemo } from 'react'

export type CaseStudyOtherAnswersWithSolution = {
  [caseId: string]: {
    [itemId: string]: {
      [criterionId: string]: {
        answers: number[]
        min: number
        max: number
        solutionMin: number
        solutionMax: number
      }
    }
  }
}

function useEvaluationCaseStudyResults({
  options,
  solutions,
  evaluation,
}: {
  evaluation: CaseStudyInstanceEvaluation
  options: CaseStudyElementOptions
  solutions: CaseStudySolutionsObject
}) {
  return useMemo(
    () =>
      options.cases.reduce<CaseStudyOtherAnswersWithSolution>(
        (caseAcc, caseObj) => {
          const caseAnswers =
            evaluation.assessments?.filter(
              (assessment) => assessment.caseId === caseObj.id
            ) ?? []

          caseAcc[caseObj.id] = options.items
            ? options.items?.reduce<CaseStudyOtherAnswersWithSolution['']>(
                (itemAcc, itemObj) => {
                  const itemAnswers = caseAnswers.filter(
                    (assessment) => assessment.itemId === itemObj.id
                  )

                  itemAcc[String(itemObj.id)] = options.criteria?.reduce<
                    CaseStudyOtherAnswersWithSolution['']['']
                  >((criterionAcc, criterionObj) => {
                    const solutionRange =
                      solutions[caseObj.id]?.[itemObj.id]?.[criterionObj.id]

                    criterionAcc[criterionObj.id] = {
                      answers:
                        itemAnswers.find(
                          (assessment) =>
                            assessment.criterionId === criterionObj.id
                        )?.responseValues ?? [],
                      min: criterionObj.min,
                      max: criterionObj.max,
                      solutionMin: solutionRange?.min ?? 0,
                      solutionMax: solutionRange?.max ?? 100,
                    }

                    return criterionAcc
                  }, {})

                  return itemAcc
                },
                {}
              )
            : {}

          return caseAcc
        },
        {}
      ),
    [evaluation, options, solutions]
  )
}

export default useEvaluationCaseStudyResults
