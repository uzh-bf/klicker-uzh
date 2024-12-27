import { MicroLearning, PracticeQuiz } from '@klicker-uzh/graphql/dist/ops'
import { useMemo } from 'react'

function useActivityMap({
  practiceQuizzes,
  microLearnings,
}: {
  practiceQuizzes?: Pick<PracticeQuiz, 'id' | 'name'>[] | null
  microLearnings?: Pick<MicroLearning, 'id' | 'name'>[] | null
}) {
  const activityNameMap = useMemo(
    () => ({
      ...(practiceQuizzes?.reduce<Record<string, string>>((acc, pq) => {
        acc[pq.id] = pq.name
        return acc
      }, {}) ?? {}),
      ...(microLearnings?.reduce<Record<string, string>>((acc, ml) => {
        acc[ml.id] = ml.name
        return acc
      }, {}) ?? {}),
    }),
    [practiceQuizzes, microLearnings]
  )

  const allActivityIds = useMemo(
    () => [
      ...(practiceQuizzes?.map((quiz) => quiz.id) ?? []),
      ...(microLearnings?.map((ml) => ml.id) ?? []),
    ],
    [practiceQuizzes, microLearnings]
  )

  return { activityNameMap, allActivityIds }
}

export default useActivityMap
