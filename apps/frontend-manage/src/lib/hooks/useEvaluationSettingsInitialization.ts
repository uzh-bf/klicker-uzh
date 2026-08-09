import { Dispatch, SetStateAction, useEffect } from 'react'
import { ActiveStackType } from '../../components/evaluation/ActivityEvaluation'

function useEvaluationSettingsInitialization({
  setShowSolution,
  setShowExplanation,
  paramsLoaded,
  showSolution,
  showExplanation,
  activeInstance,
  activeStack,
}: {
  setShowSolution: Dispatch<SetStateAction<boolean>>
  setShowExplanation: Dispatch<SetStateAction<boolean>>
  paramsLoaded: boolean
  showSolution: boolean
  showExplanation: boolean
  activeInstance: number
  activeStack: ActiveStackType
}) {
  // The active question/stack values are trigger-only dependencies: query
  // parameters are re-applied when the evaluated item changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: active evaluation values intentionally trigger settings initialization
  useEffect(() => {
    // if the question ix is not given as a query parameter, do not set the settings
    if (!paramsLoaded) {
      return
    }

    // initialize sample solution and explanation correctly based on query parameters
    setShowSolution(showSolution)
    setShowExplanation(showExplanation)
  }, [
    activeInstance,
    activeStack,
    paramsLoaded,
    setShowExplanation,
    setShowSolution,
    showExplanation,
    showSolution,
  ])

  return null
}

export default useEvaluationSettingsInitialization
