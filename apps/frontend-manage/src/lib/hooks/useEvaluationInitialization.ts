import type {
  ActiveStackType,
  ActivityEvaluationType,
} from '@components/evaluation/ActivityEvaluation'
import type { ElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import type { Dispatch, SetStateAction } from 'react'
import { useEffect } from 'react'

function useEvaluationInitialization({
  setActiveInstance,
  setActiveStack,
  questionIx,
  results,
  showLeaderboard,
  missingInstanceResults,
  type,
}: {
  setActiveInstance: Dispatch<SetStateAction<number>>
  setActiveStack: Dispatch<SetStateAction<ActiveStackType>>
  questionIx?: string | null
  results: (ElementInstanceEvaluation & { stackIx: number })[]
  showLeaderboard?: boolean
  missingInstanceResults?: boolean
  type: ActivityEvaluationType
}) {
  useEffect(() => {
    // initialize evaluation with correct element / leaderboard / confusion for live quiz
    if (type === 'LiveQuiz') {
      if (typeof questionIx === 'string' && questionIx !== null) {
        setActiveInstance(parseInt(questionIx))
        setActiveStack(results[parseInt(questionIx)]?.stackIx ?? 0)
      } else if (showLeaderboard || missingInstanceResults) {
        setActiveStack('leaderboard')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, results, questionIx, showLeaderboard, missingInstanceResults])

  return null
}

export default useEvaluationInitialization
