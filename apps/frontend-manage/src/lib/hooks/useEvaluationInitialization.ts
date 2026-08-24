import { ElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { Dispatch, SetStateAction, useEffect } from 'react'
import { ActivityEvaluationType } from '../../components/evaluation/ActivityEvaluation'

function useEvaluationInitialization({
  setActiveInstance,
  setActiveStack,
  questionIx,
  results,
  showLeaderboard,
  type,
}: {
  setActiveInstance: Dispatch<SetStateAction<number>>
  setActiveStack: Dispatch<
    SetStateAction<number | 'feedbacks' | 'confusion' | 'leaderboard'>
  >
  questionIx?: string | null
  results: (ElementInstanceEvaluation & { stackIx: number })[]
  showLeaderboard?: boolean
  type: ActivityEvaluationType
}) {
  useEffect(() => {
    // initialize evaluation with correct element / leaderboard / confusion for live quiz
    if (type === 'LiveQuiz') {
      if (typeof questionIx === 'string' && questionIx !== null) {
        setActiveInstance(parseInt(questionIx))
        setActiveStack(results[parseInt(questionIx)]?.stackIx ?? 0)
      } else if (showLeaderboard) {
        setActiveStack('leaderboard')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, results, questionIx, showLeaderboard])

  return null
}

export default useEvaluationInitialization
