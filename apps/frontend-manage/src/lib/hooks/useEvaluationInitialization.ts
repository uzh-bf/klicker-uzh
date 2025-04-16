import { Dispatch, SetStateAction, useEffect } from 'react'
import { ActivityEvaluationType } from '../../components/evaluation/ActivityEvaluation'

function useEvaluationInitialization({
  setActiveInstance,
  setActiveStack,
  questionIx,
  showLeaderboard,
  missingInstanceResults,
  type,
}: {
  setActiveInstance: Dispatch<SetStateAction<number>>
  setActiveStack: Dispatch<
    SetStateAction<number | 'feedbacks' | 'confusion' | 'leaderboard'>
  >
  questionIx?: string | null
  showLeaderboard?: boolean
  missingInstanceResults?: boolean
  type: ActivityEvaluationType
}) {
  useEffect(() => {
    // initialize evaluation with correct element / leaderboard / confusion for live quiz
    if (type === 'LiveQuiz') {
      if (typeof questionIx === 'string' && questionIx !== null) {
        setActiveInstance(parseInt(questionIx))
      } else if (showLeaderboard) {
        setActiveStack('leaderboard')
      } else if (missingInstanceResults) {
        setActiveStack('feedbacks')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, questionIx, showLeaderboard, missingInstanceResults])

  return null
}

export default useEvaluationInitialization
