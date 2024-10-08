import { ElementType, MicroLearning } from '@klicker-uzh/graphql/dist/ops'
import { StudentResponseType } from '@klicker-uzh/shared-components/src/StudentElement'
import { useMemo } from 'react'

interface UseStackEvaluationAggregationProps {
  microlearning?: Omit<
    MicroLearning,
    'name' | 'status' | 'arePushNotificationsSent' | 'course'
  > | null
}

function useStackEvaluationAggregation({
  microlearning,
}: UseStackEvaluationAggregationProps) {
  return useMemo(() => {
    if (!microlearning) {
      return { evaluation: undefined, totalPointsAwarded: 0 }
    }

    return microlearning.stacks?.reduce<{
      evaluation: Record<
        number,
        { pointsAwarded: number; score: number; maxPoints: number }
      >
      totalPointsAwarded: number
    }>(
      (acc, stack) => {
        const rawStackStorage = localStorage.getItem(
          `qi-${microlearning.id}-${stack.id}`
        )
        const stackStorage: StudentResponseType = rawStackStorage
          ? JSON.parse(rawStackStorage)
          : null

        // if no results for a stack are found, return 0 points
        if (stackStorage === null) {
          return {
            evaluation: {
              ...acc.evaluation,
              [stack.id]: { pointsAwarded: 0, score: 0, maxPoints: 0 },
            },
            totalPointsAwarded: acc.totalPointsAwarded,
          }
        }

        const stackResults = Object.values(stackStorage).reduce<{
          stackPointsAwarded: number
          stackScore: number
          stackMaxPoints: number
        }>(
          (acc, entry) => {
            // flashcards and content elements do not contribute to the score at the moment
            if (
              entry.type === ElementType.Flashcard ||
              entry.type === ElementType.Content
            ) {
              return acc
            }
            // aggregate the awarded points over the questions
            return {
              stackPointsAwarded:
                acc.stackPointsAwarded + (entry.evaluation?.pointsAwarded ?? 0),
              stackScore: acc.stackScore + (entry.evaluation?.score ?? 0),
              stackMaxPoints:
                acc.stackMaxPoints +
                (entry.evaluation?.pointsMultiplier ?? 1) * 10,
            }
          },
          { stackPointsAwarded: 0, stackScore: 0, stackMaxPoints: 0 }
        )

        // combine date over stacks
        return {
          evaluation: {
            ...acc.evaluation,
            [stack.id]: {
              pointsAwarded: stackResults.stackPointsAwarded,
              score: stackResults.stackScore,
              maxPoints: stackResults.stackMaxPoints,
            },
          },
          totalPointsAwarded:
            acc.totalPointsAwarded + stackResults.stackPointsAwarded,
        }
      },
      { evaluation: {}, totalPointsAwarded: 0 }
    )
  }, [microlearning])
}

export default useStackEvaluationAggregation
