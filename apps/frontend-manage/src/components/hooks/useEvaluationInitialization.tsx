import { InstanceResult } from '@klicker-uzh/graphql/dist/ops'
import { useEffect } from 'react'
import { ACTIVE_CHART_TYPES } from 'shared-components/src/constants'

interface useEvaluationInitializationProps {
  selectedInstanceIndex: number
  instanceResults: InstanceResult[]
  currentInstance: Partial<InstanceResult>
  chartType: string
  questionIx?: number
  setSelectedInstance: (id: string) => void
  setSelectedBlockIndex: (index: number) => void
  setCurrentInstance: (instance: InstanceResult) => void
  setSelectedInstanceIndex: (index: number) => void
  setChartType: (type: string) => void
}

function useEvaluationInitialization({
  selectedInstanceIndex,
  instanceResults,
  currentInstance,
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
  }, [questionIx])

  useEffect(() => {
    if (instanceResults?.[selectedInstanceIndex]) {
      const selectedInstance = instanceResults[selectedInstanceIndex].id
      setSelectedInstance(selectedInstance)
      setSelectedBlockIndex(instanceResults[selectedInstanceIndex].blockIx)

      const currInstance = instanceResults?.find(
        (instance) => instance.id === selectedInstance
      )
      if (currInstance) setCurrentInstance(currInstance)

      const possibleChartTypes = ACTIVE_CHART_TYPES[
        currentInstance?.questionData?.type || 0
      ].map((type) => type.value)

      if (!possibleChartTypes.includes(chartType)) {
        setChartType(
          ACTIVE_CHART_TYPES[currentInstance?.questionData?.type || 0][0].value
        )
      }
    } else if (!instanceResults?.[selectedInstanceIndex]) {
      setSelectedInstance('placeholder')
    }
  }, [instanceResults, selectedInstanceIndex])
}

export default useEvaluationInitialization
