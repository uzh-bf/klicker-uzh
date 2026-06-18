import { useMemo } from 'react'

type ActivityListItem = {
  id: string
  name: string
}

function useActivityMap({
  practiceQuizzes,
  microLearnings,
}: {
  practiceQuizzes?: ActivityListItem[] | null
  microLearnings?: ActivityListItem[] | null
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
