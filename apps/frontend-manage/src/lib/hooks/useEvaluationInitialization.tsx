import { ElementType, InstanceResult } from '@klicker-uzh/graphql/dist/ops'
import {
  ACTIVE_CHART_TYPES,
  ChartType,
} from '@klicker-uzh/shared-components/src/constants'
import { useEffect } from 'react'

interface useEvaluationInitializationProps {
  selectedInstanceIndex: number
  instanceResults: InstanceResult[]
  chartType: ChartType
  questionIx?: number
  setSelectedInstance: (id: string) => void
  setSelectedBlockIndex: (index: number) => void
  setCurrentInstance: (instance: InstanceResult) => void
  setSelectedInstanceIndex: (index: number) => void
  setChartType: (type: ChartType) => void
}

function useEvaluationInitialization({
  selectedInstanceIndex,
  instanceResults,
  chartType,
  questionIx,
  setSelectedInstance,
  setCurrentInstance,
  setSelectedInstanceIndex,
  setChartType,
  setSelectedBlockIndex,
}: useEvaluationInitializationProps) {
  useEffect(() => {
    if (typeof questionIx === 'number') {
      setSelectedInstanceIndex(questionIx)
    }
  }, [questionIx, setSelectedInstanceIndex])

  useEffect(() => {
    if (instanceResults?.[selectedInstanceIndex]) {
      const selectedInstance = instanceResults[selectedInstanceIndex].id
      setSelectedInstance(selectedInstance)
      setSelectedBlockIndex(instanceResults[selectedInstanceIndex].blockIx ?? 0)

      const currInstance = instanceResults?.find(
        (instance) => instance.id === selectedInstance
      )
      if (currInstance) setCurrentInstance(currInstance)

      const possibleChartTypes = ACTIVE_CHART_TYPES[
        currInstance?.questionData?.type || ElementType.Sc
      ].map((type) => type.value)

      if (!possibleChartTypes.includes(chartType)) {
        setChartType(
          ACTIVE_CHART_TYPES[
            currInstance?.questionData?.type || ElementType.Sc
          ][0].value
        )
      }
    } else if (
      !instanceResults?.[selectedInstanceIndex] &&
      selectedInstanceIndex !== -1
    ) {
      setSelectedInstance('placeholder')
    } else {
      setSelectedInstance('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceResults, selectedInstanceIndex])
}

export default useEvaluationInitialization
