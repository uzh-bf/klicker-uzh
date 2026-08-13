import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import {
  ACTIVE_CHART_TYPES,
  ChartType,
} from '@klicker-uzh/shared-components/src/constants'
import { useEffect } from 'react'

interface UseChartTypeUpdateProps {
  activeInstance: number
  activeElementType?: ElementType
  setChartType: (newType: ChartType) => void
}

function useChartTypeUpdate({
  activeInstance,
  activeElementType,
  setChartType,
}: UseChartTypeUpdateProps) {
  useEffect(() => {
    if (activeInstance !== -1 && typeof activeElementType !== 'undefined') {
      // always set the chart type to the standard chart type for this question type
      // (do not keep previous selection when switching between questions)
      setChartType(ACTIVE_CHART_TYPES[activeElementType][0].value)
    }
  }, [activeElementType, activeInstance, setChartType])
}

export default useChartTypeUpdate
