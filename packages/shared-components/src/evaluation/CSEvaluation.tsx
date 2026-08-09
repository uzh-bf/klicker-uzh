import type {
  CaseStudyElementOptions,
  CaseStudyInstanceEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import type { CaseStudySolutionsObject } from '@klicker-uzh/types'
import { Progress } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'
import useEvaluationCaseStudyResults from '../hooks/useEvaluationCaseStudyResults'

function CSEvaluation({
  evaluation,
  options,
  solutions,
}: {
  evaluation: CaseStudyInstanceEvaluation
  options: CaseStudyElementOptions
  solutions: CaseStudySolutionsObject
}) {
  const mappedEvaluation = useEvaluationCaseStudyResults({
    evaluation,
    options,
    solutions,
  })

  return (
    <div>
      {options.cases.map((caseObj, caseIx) => (
        <div
          key={`sidebar-evaluation-case-${caseObj.id}`}
          className={twMerge('mt-10', caseIx === 0 && 'mt-0')}
        >
          <div className="text-lg font-bold">{`${caseIx + 1}. ${caseObj.title}`}</div>

          {options.items?.map((item, itemIx) => (
            <div
              key={`sidebar-evaluation-case-${caseObj.id}-item-${item.id}`}
              className={twMerge('mt-6', itemIx === 0 && 'mt-0')}
            >
              <div className="font-bold">{item.value}</div>

              {options.criteria.map((criterion) => {
                const evaluationValue =
                  mappedEvaluation[caseObj.id]![item.id]![criterion.id]!

                const shift = criterion.min // compute all values - shift to start at zero
                const length = criterion.max - shift
                const lowerSolution = evaluationValue.solutionMin - shift
                const upperSolution = evaluationValue.solutionMax - shift

                return (
                  <div
                    key={`sidebar-evaluation-case-${caseObj.id}-item-${item.id}-criterion-${criterion.id}`}
                  >
                    <div className="mt-1.5 flex w-full flex-row justify-between text-sm">
                      <div>{criterion.name}</div>
                      <div
                        className={twMerge(
                          'min-w-max font-bold text-green-700',
                          !!criterion.labels && 'hidden'
                        )}
                      >{`[${evaluationValue.solutionMin}, ${evaluationValue.solutionMax}]`}</div>
                    </div>
                    <div>
                      <div className="relative">
                        <Progress
                          noMinWidth
                          value={[upperSolution, lowerSolution]}
                          max={length}
                          formatter={() => null}
                          className={{
                            root: 'h-3.5',
                            background: 'bg-gray-300',
                            indicator: [
                              twMerge(
                                'bg-green-600',
                                Math.abs(
                                  evaluationValue.solutionMax - criterion.max
                                ) > Number.EPSILON && 'rounded-r-none'
                              ),
                              'rounded-r-none bg-gray-300',
                            ],
                          }}
                        />
                        {evaluationValue.answers.map((answer) => (
                          <div
                            key={`answer-${answer}`}
                            className="absolute top-0 h-full w-0.5 bg-red-500 bg-opacity-70"
                            style={{
                              left: `${((answer - shift) / length) * 100}%`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default CSEvaluation
