import { StackEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { Dispatch, SetStateAction, useEffect } from 'react'
import { ActivityEvaluationType } from '../../components/evaluation/ActivityEvaluation'

export function getEvaluationQuestionLocation(
  questionIx: string | null | undefined,
  stacks: StackEvaluation[]
) {
  if (typeof questionIx !== 'string') return null

  if (!/^\d+$/.test(questionIx)) return null

  const questionIndex = Number(questionIx)
  if (!Number.isSafeInteger(questionIndex)) return null

  let questionOffset = 0
  let resultOffset = 0

  for (const [stackIx, stack] of stacks.entries()) {
    const instanceCount = stack.instanceCount ?? stack.instances.length
    if (questionIndex < questionOffset + instanceCount) {
      const localInstanceIx = questionIndex - questionOffset
      return {
        stackIx,
        instanceIx:
          localInstanceIx < stack.instances.length
            ? resultOffset + localInstanceIx
            : -1,
      }
    }

    questionOffset += instanceCount
    resultOffset += stack.instances.length
  }

  return null
}

function useEvaluationInitialization({
  setActiveInstance,
  setActiveStack,
  questionIx,
  stacks,
  showLeaderboard,
  type,
}: {
  setActiveInstance: Dispatch<SetStateAction<number>>
  setActiveStack: Dispatch<
    SetStateAction<number | 'feedbacks' | 'confusion' | 'leaderboard'>
  >
  questionIx?: string | null
  stacks: StackEvaluation[]
  showLeaderboard?: boolean
  type: ActivityEvaluationType
}) {
  useEffect(() => {
    // initialize evaluation with correct element / leaderboard / confusion for live quiz
    if (type === 'LiveQuiz') {
      if (typeof questionIx === 'string' && questionIx !== null) {
        const location = getEvaluationQuestionLocation(questionIx, stacks)
        if (location) {
          setActiveStack(location.stackIx)
          setActiveInstance(location.instanceIx)
        } else {
          setActiveInstance(-1)
          setActiveStack(0)
        }
      } else if (showLeaderboard) {
        setActiveStack('leaderboard')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, stacks, questionIx, showLeaderboard])

  return null
}

export default useEvaluationInitialization
