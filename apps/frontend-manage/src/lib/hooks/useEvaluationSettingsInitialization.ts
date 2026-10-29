import { Dispatch, SetStateAction, useEffect } from 'react'
import { ActiveStackType } from '../../components/evaluation/ActivityEvaluation'

function useEvaluationSettingsInitialization({
  setShowSolution,
  setShowExplanation,
  paramsLoaded,
  isStackActive,
  showSolution,
  showExplanation,
  activeInstance,
  activeStack,
}: {
  setShowSolution: Dispatch<SetStateAction<boolean>>
  setShowExplanation: Dispatch<SetStateAction<boolean>>
  paramsLoaded: boolean
  isStackActive: boolean
  showSolution: boolean
  showExplanation: boolean
  activeInstance: number
  activeStack: ActiveStackType
}) {
  useEffect(() => {
    // if the question ix is not given as a query parameter, do not set the settings
    if (!paramsLoaded || isStackActive) {
      return
    }

    // initialize sample solution and explanation correctly based on query parameters
    setShowSolution(showSolution)
    setShowExplanation(showExplanation)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    paramsLoaded,
    isStackActive,
    activeStack,
    showSolution,
    showExplanation,
    activeInstance,
  ])

  return null
}

export default useEvaluationSettingsInitialization
