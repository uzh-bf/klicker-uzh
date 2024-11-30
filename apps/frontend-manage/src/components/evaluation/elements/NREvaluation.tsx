import { NumericalElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import { useState } from 'react'
import { ActivityEvaluationType } from '../ActivityEvaluation'
import ElementChart from '../ElementChart'
import { TextSizeType } from '../textSizes'
import NRSidebar from './NRSidebar'

interface NREvaluationProps {
  instanceEvaluation: NumericalElementInstanceEvaluation
  textSize: TextSizeType
  chartType: ChartType
  showSolution: boolean
  type: ActivityEvaluationType
}

export interface ShowStatisticsType {
  mean?: boolean
  median?: boolean
  q1?: boolean
  q3?: boolean
  sd?: boolean
}

function NREvaluation({
  instanceEvaluation,
  textSize,
  chartType,
  showSolution,
  type,
}: NREvaluationProps) {
  const [showStatistics, setShowStatistics] = useState<ShowStatisticsType>({
    mean: false,
    median: false,
    q1: false,
    q3: false,
    sd: false,
  })

  return (
    <>
      <div className="order-2 flex-1 px-4 md:order-1">
        <ElementChart
          chartType={chartType}
          instanceEvaluation={instanceEvaluation}
          showSolution={showSolution}
          showStatistics={showStatistics}
          textSize={textSize}
        />
      </div>
      <NRSidebar
        instance={instanceEvaluation}
        chartType={chartType}
        textSize={textSize}
        showSolution={showSolution}
        showStatistics={showStatistics}
        setShowStatistics={setShowStatistics}
        type={type}
      />
    </>
  )
}

export default NREvaluation
