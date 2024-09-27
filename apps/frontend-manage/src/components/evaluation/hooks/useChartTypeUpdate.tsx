import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import {
  ACTIVE_CHART_TYPES,
  ChartType,
} from '@klicker-uzh/shared-components/src/constants'
import { useEffect } from 'react'

interface UseChartTypeUpdateProps {
  activeInstance: number
  activeElementType: ElementType
  chartType: ChartType
  setChartType: (newType: ChartType) => void
}

function useChartTypeUpdate({
  activeInstance,
  activeElementType,
  chartType,
  setChartType,
}: UseChartTypeUpdateProps) {
  useEffect(() => {
    if (activeInstance !== -1) {
      const possibleChartTypes = ACTIVE_CHART_TYPES[activeElementType].map(
        (type) => type.value
      )

      if (!possibleChartTypes.includes(chartType)) {
        setChartType(ACTIVE_CHART_TYPES[activeElementType][0].value)
      }
    }
  }, [activeInstance])
}

export default useChartTypeUpdate
