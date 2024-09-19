import { NumericalElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import { twMerge } from 'tailwind-merge'
import ElementChart from '../ElementChart'
import { TextSizeType } from '../textSizes'
import NumericalSidebar from './NumericalSidebar'

interface NREvaluationProps {
  instanceEvaluation: NumericalElementInstanceEvaluation
  textSize: TextSizeType
  chartType: ChartType
  showSolution: boolean
}

function NREvaluation({
  instanceEvaluation,
  textSize,
  chartType,
  showSolution,
}: NREvaluationProps) {
  return (
    <>
      <div className="order-2 flex-1 px-4 md:order-1">
        <ElementChart
          chartType={chartType}
          instanceEvaluation={instanceEvaluation}
          showSolution={showSolution}
          textSize={textSize}
        />
      </div>
      <div
        className={twMerge(
          'order-1 flex flex-none flex-col gap-2 border-l px-4 py-2 md:order-2 md:w-64 lg:w-72 xl:w-80',
          textSize.text
        )}
      >
        <NumericalSidebar
          instance={instanceEvaluation}
          textSize={textSize}
          showSolution={showSolution}
        />
      </div>
    </>
  )
}

export default NREvaluation
