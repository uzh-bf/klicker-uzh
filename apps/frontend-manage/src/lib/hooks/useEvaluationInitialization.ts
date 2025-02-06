import { Dispatch, SetStateAction, useEffect } from 'react'
import { ActivityEvaluationType } from '../../components/evaluation/ActivityEvaluation'

function useEvaluationInitialization({
  setActiveInstance,
  setActiveStack,
  setShowSolution,
  questionIx,
  showLeaderboard,
  showSolution,
  missingInstanceResults,
  type,
}: {
  setActiveInstance: Dispatch<SetStateAction<number>>
  setActiveStack: Dispatch<
    SetStateAction<number | 'feedbacks' | 'confusion' | 'leaderboard'>
  >
  setShowSolution: Dispatch<SetStateAction<boolean>>
  questionIx?: string | null
  showLeaderboard?: boolean
  showSolution?: boolean
  missingInstanceResults?: boolean
  type: ActivityEvaluationType
}) {
  useEffect(() => {
    if (type === 'LiveQuiz') {
      if (typeof questionIx === 'string' && questionIx !== null) {
        setActiveInstance(parseInt(questionIx))
      } else if (showLeaderboard) {
        setActiveStack('leaderboard')
      } else if (missingInstanceResults) {
        setActiveStack('feedbacks')
      }
      if (showSolution) {
        setShowSolution(true)
      }
    }
  }, [type, questionIx, showLeaderboard, showSolution])

  return null
}

export default useEvaluationInitialization
