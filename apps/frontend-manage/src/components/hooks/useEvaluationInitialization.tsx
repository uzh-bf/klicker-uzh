import { InstanceResult } from '@klicker-uzh/graphql/dist/ops'
import { useEffect } from 'react'
import { ACTIVE_CHART_TYPES } from 'shared-components/src/constants'

interface useEvaluationInitializationProps {
  selectedInstance: string
  instanceResults: InstanceResult[]
  currentInstance: Partial<InstanceResult>
  chartType: string
  setSelectedInstance: (id: string) => void
  setCurrentInstance: (instance: InstanceResult) => void
  setSelectedInstanceIndex: (index: number) => void
  setChartType: (type: string) => void
}

function useEvaluationInitialization({
  selectedInstance,
  instanceResults,
  currentInstance,
  chartType,
  setSelectedInstance,
  setCurrentInstance,
  setSelectedInstanceIndex,
  setChartType,
}: useEvaluationInitializationProps) {
  useEffect(() => {
    if (
      !instanceResults ||
      instanceResults.length === 0 ||
      selectedInstance == 'placeholder'
    )
      return

    if (selectedInstance === '' && currentInstance.id === '') {
      setSelectedInstance(instanceResults[0].id)
      setCurrentInstance(instanceResults[0])
      return
    }

    const currentInstanceIndex = instanceResults.findIndex(
      (instance) => instance.id === selectedInstance
    )
    setSelectedInstanceIndex(currentInstanceIndex)

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
  }, [
    selectedInstance,
    instanceResults,
    currentInstance.id,
    chartType,
    currentInstance?.questionData?.type,
    setSelectedInstanceIndex,
    setCurrentInstance,
    setSelectedInstance,
    setChartType,
  ])
}

export default useEvaluationInitialization
