import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import {
  ACTIVE_CHART_TYPES,
  ChartType,
} from '@klicker-uzh/shared-components/src/constants'
import { useEffect } from 'react'

interface UseChartTypeUpdateProps {
  activeInstance: number
  activeElementType?: ElementType
  chartType?: ChartType
  setChartType: (newType: ChartType) => void
}

function useChartTypeUpdate({
  activeInstance,
  activeElementType,
  chartType,
  setChartType,
}: UseChartTypeUpdateProps) {
  useEffect(() => {
    if (
      activeInstance !== -1 &&
      typeof chartType !== 'undefined' &&
      typeof activeElementType !== 'undefined'
    ) {
      const possibleChartTypes = ACTIVE_CHART_TYPES[activeElementType].map(
        (type) => type.value
      )

      // always set the chart type to the standard chart type for this question type
      // (do not keep previous selection when switching between questions - as logic below does)
      setChartType(ACTIVE_CHART_TYPES[activeElementType][0].value)
      // if (!possibleChartTypes.includes(chartType)) {
      //   setChartType(ACTIVE_CHART_TYPES[activeElementType][0].value)
      // }
    }
  }, [activeElementType, activeInstance, chartType, setChartType])
}

export default useChartTypeUpdate
