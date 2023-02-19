import { InstanceResult } from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Select } from '@uzh-bf/design-system'
import { useState } from 'react'
import {
  ACTIVE_CHART_TYPES,
  CHART_COLORS,
  STATISTICS_ORDER,
} from 'shared-components/src/constants'
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
  setChartType: (value: string) => void
  className?: string
}

function QuestionEvaluation({
  currentInstance,
  selectedInstance,
  textSize,
  showSolution,
  chartType,
  setChartType,
  className,
}: QuestionEvaluationProps) {
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
    <div className={className}>
      <EvaluationCollapsible
        currentInstance={currentInstance}
        selectedInstance={selectedInstance}
        proseSize={textSize.prose}
      />

      <div className="flex flex-col flex-1 h-full md:flex-row">
        <div className="z-10 flex-1 order-2 px-4 overflow-y-scroll md:order-1">
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
        <div className="order-1 w-full px-4 py-2 overflow-y-scroll border-l md:w-64 md:order-2">
          <div className={twMerge('flex flex-col gap-2', textSize.text)}>
            <div className="font-bold">Diagramm Typ:</div>
            <Select
              className={{ root: '-mt-1 mb-1' }}
              items={ACTIVE_CHART_TYPES[currentInstance.questionData.type]}
              value={chartType}
              onChange={(newValue: string) => setChartType(newValue)}
            />

            {(currentInstance.questionData.type === 'SC' ||
              currentInstance.questionData.type === 'MC' ||
              currentInstance.questionData.type === 'KPRIM') && (
              <div className="flex flex-col gap-2">
                <div className="font-bold">Antwortmöglichkeiten</div>
                {currentInstance.questionData.options.choices.map(
                  (choice, innerIndex) => (
                    <div
                      key={`${currentInstance.blockIx}-${innerIndex}`}
                      className="flex flex-row"
                    >
                      <div
                        // TODO: possibly use single color for answer options to highlight correct one? or some other approach to distinguish better
                        style={{
                          backgroundColor: showSolution
                            ? choice.correct
                              ? '#00de0d'
                              : '#ff0000'
                            : CHART_COLORS[innerIndex % 12],
                        }}
                        className={twMerge(
                          'mr-2 items-center flex justify-center rounded-md w-7 h-7 text-white font-bold',
                          choice.correct && showSolution && 'text-black'
                        )}
                      >
                        {String.fromCharCode(65 + innerIndex)}
                      </div>

                      <div className="w-[calc(100%-3rem)] line-clamp-3">
                        <Ellipsis
                          maxLines={3}
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
                )}
              </div>
            )}

            {currentInstance.questionData.type === 'NUMERICAL' && (
              <div>
                <div className="font-bold">Erlaubter Antwortbereich:</div>
                <div>
                  [
                  {currentInstance.questionData.options.restrictions?.min ??
                    '-∞'}
                  ,
                  {currentInstance.questionData.options.restrictions?.max ??
                    '+∞'}
                  ]
                </div>
                <div className="mt-4 font-bold">Statistik:</div>
                {Object.entries(currentInstance.statistics)
                  .slice(1)
                  .sort(
                    (a, b) =>
                      STATISTICS_ORDER.indexOf(a[0]) -
                      STATISTICS_ORDER.indexOf(b[0])
                  )
                  .map((statistic) => {
                    const statisticName = statistic[0]
                    return (
                      <Statistic
                        key={statisticName}
                        statisticName={statisticName}
                        value={statistic[1]}
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
                  })}
                {showSolution &&
                  currentInstance.questionData.options.solutionRanges && (
                    <div>
                      <div className="mt-4 font-bold">
                        Korrekte Lösungsbereiche:
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
                  <div className="font-bold">Schlüsselwörter Lösung:</div>
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
    </div>
  )
}
export default QuestionEvaluation
