import { InstanceResult } from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import {
  CHART_COLORS,
  STATISTICS_ORDER,
} from '@klicker-uzh/shared-components/src/constants'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Statistic from '../../../components/evaluation/Statistic'
import EvaluationCollapsible from '../../../components/sessions/evaluation/EvaluationCollapsible'
import Chart from '../../evaluation/Chart'
import { TextSizeType } from './constants'

interface QuestionEvaluationProps {
  currentInstance: InstanceResult
  selectedInstance: string
  textSize: TextSizeType
  showSolution: boolean
  chartType: string
  totalParticipants: number
  className?: string
}

function QuestionEvaluation({
  currentInstance,
  selectedInstance,
  textSize,
  showSolution,
  chartType,
  totalParticipants,
  className,
}: QuestionEvaluationProps) {
  const t = useTranslations()
  const [statisticStates, setStatisticStates] = useState<{
    [key: string]: boolean
  }>({
    mean: false,
    median: false,
    q1: false,
    q3: false,
    sd: false,
  })

  return (
    <div className={twMerge('h-full flex flex-col', className)}>
      <div className="flex-none">
        <EvaluationCollapsible
          currentInstance={currentInstance}
          selectedInstance={selectedInstance}
          proseSize={textSize.prose}
        />
      </div>

      <div className="flex flex-col flex-1 min-h-0 md:flex-row">
        <div className="flex-1 order-2 px-4 md:order-1">
          <Chart
            chartType={chartType}
            data={currentInstance}
            showSolution={showSolution}
            textSize={textSize}
            statisticsShowSolution={{
              mean: statisticStates.mean,
              median: statisticStates.median,
              q1: statisticStates.q1,
              q3: statisticStates.q3,
              sd: statisticStates.sd,
            }}
          />
        </div>
        <div
          className={twMerge(
            'flex-none flex flex-col gap-2 order-1 px-4 py-2 border-l md:w-64 lg:w-72 xl:w-80 md:order-2',
            textSize.text
          )}
        >
          {(currentInstance.questionData.type === 'SC' ||
            currentInstance.questionData.type === 'MC' ||
            currentInstance.questionData.type === 'KPRIM') && (
            <div className="flex flex-col flex-1 min-h-0 gap-2 mt-2">
              <div
                className={twMerge(
                  'flex-1 overflow-y-auto flex flex-col gap-2.5',
                  textSize.text
                )}
              >
                {currentInstance.questionData.options.choices.map(
                  (choice, innerIndex) => {
                    const correctFraction =
                      parseInt(currentInstance.results[innerIndex].count) /
                      totalParticipants

                    return (
                      <div key={`${currentInstance.blockIx}-${innerIndex}`}>
                        <div className="flex flex-row items-center justify-between leading-5">
                          <div
                            // TODO: possibly use single color for answer options to highlight correct one? or some other approach to distinguish better
                            style={{
                              backgroundColor: showSolution
                                ? choice.correct
                                  ? '#00de0d'
                                  : '#ff0000'
                                : CHART_COLORS[innerIndex % 12],
                              minWidth: '1.75rem',
                              width: `calc(${correctFraction * 100}%)`,
                            }}
                            className={twMerge(
                              'mr-2 items-center flex justify-center rounded-md text-white font-bold h-5',
                              choice.correct && showSolution && 'text-black'
                            )}
                          >
                            {String.fromCharCode(65 + innerIndex)}
                          </div>
                          <div className="text-right whitespace-nowrap">
                            {Math.round(100 * correctFraction)} %
                          </div>
                        </div>

                        <div className="w-full line-clamp-3">
                          <Ellipsis
                            // maxLines={3}
                            maxLength={60}
                            className={{
                              tooltip:
                                'z-20 float-right !text-white min-w-[25rem]',
                              markdown: textSize.text,
                            }}
                          >
                            {choice.value}
                          </Ellipsis>
                        </div>
                      </div>
                    )
                  }
                )}
              </div>
            </div>
          )}

          {currentInstance.questionData.type === 'NUMERICAL' && (
            <div>
              <div className="font-bold">
                {t('manage.evaluation.validSolutionRange')}:
              </div>
              <div>
                [
                {currentInstance.questionData.options.restrictions?.min ?? '-∞'}
                ,
                {currentInstance.questionData.options.restrictions?.max ?? '+∞'}
                ]
              </div>
              <div className="mt-4 font-bold">
                {t('manage.evaluation.statistics')}:
              </div>
              {currentInstance.statistics ? (
                Object.entries(currentInstance.statistics)
                  .slice(1)
                  .sort(
                    (a, b) =>
                      STATISTICS_ORDER.indexOf(a[0]) -
                      STATISTICS_ORDER.indexOf(b[0])
                  )
                  .map((statistic) => {
                    const statisticName = statistic[0]
                    const statisticValue = statistic[1] as number
                    return (
                      <Statistic
                        key={statisticName}
                        statisticName={statisticName}
                        value={statisticValue}
                        hasCheckbox={
                          !(statisticName === 'min' || statisticName === 'max')
                        }
                        chartType={chartType}
                        checked={statisticStates[statisticName]}
                        onCheck={() => {
                          setStatisticStates({
                            ...statisticStates,
                            [statisticName]: !statisticStates[statisticName],
                          })
                        }}
                        size={textSize.size}
                      />
                    )
                  })
              ) : (
                <UserNotification type="info">
                  {t('manage.evaluation.noStatistics')}
                </UserNotification>
              )}
              {showSolution &&
                currentInstance.questionData.options.solutionRanges && (
                  <div>
                    <div className="mt-4 font-bold">
                      {t('manage.evaluation.correctSolutionRanges')}:
                    </div>
                    {currentInstance.questionData.options.solutionRanges.map(
                      (range, innerIndex) => (
                        <div key={innerIndex}>
                          [{range?.min || '-∞'},{range?.max || '+∞'}]
                        </div>
                      )
                    )}
                  </div>
                )}
            </div>
          )}
          {currentInstance.questionData.type === 'FREE_TEXT' &&
            currentInstance.questionData.options.solutions &&
            showSolution && (
              <div>
                <div className="font-bold">
                  {t('manage.evaluation.keywordsSolution')}:
                </div>
                <ul>
                  {currentInstance.questionData.options.solutions.map(
                    (keyword, innerIndex) => (
                      <li key={innerIndex}>{`- ${keyword}`}</li>
                    )
                  )}
                </ul>
              </div>
            )}
        </div>
      </div>
    </div>
  )
}
export default QuestionEvaluation
