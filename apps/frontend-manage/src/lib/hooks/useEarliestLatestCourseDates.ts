import {
  GroupActivity,
  MicroLearning,
  PracticeQuiz,
} from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import { useMemo } from 'react'

interface UseEarliestLatestCourseDatesProps {
  groupActivities?: Pick<GroupActivity, 'scheduledStartAt' | 'scheduledEndAt'>[]
  microLearnings?: Pick<MicroLearning, 'scheduledStartAt' | 'scheduledEndAt'>[]
  practiceQuizzes?: Pick<PracticeQuiz, 'availableFrom'>[]
}

function useEarliestLatestCourseDates({
  groupActivities,
  microLearnings,
  practiceQuizzes,
}: UseEarliestLatestCourseDatesProps) {
  return useMemo(() => {
    if (groupActivities || microLearnings || practiceQuizzes) {
      if (
        (!groupActivities && !microLearnings && !practiceQuizzes) ||
        (groupActivities?.length === 0 &&
          microLearnings?.length === 0 &&
          practiceQuizzes?.length === 0)
      ) {
        return {
          earliestGroupDeadline: undefined,
          earliestStartDate: undefined,
          latestEndDate: undefined,
        }
      }

      const groupActivityStartDates =
        groupActivities?.map((ga) => Date.parse(ga.scheduledStartAt)) ?? []
      const startDates = [
        ...groupActivityStartDates,
        ...(microLearnings?.map((ml) => Date.parse(ml.scheduledStartAt)) ?? []),
        ...(practiceQuizzes?.map((pq) => Date.parse(pq.availableFrom)) ?? []),
      ]
      const endDates = [
        ...(groupActivities?.map((ga) => Date.parse(ga.scheduledEndAt)) ?? []),
        ...(microLearnings?.map((ml) => Date.parse(ml.scheduledEndAt)) ?? []),
      ]

      return {
        earliestGroupDeadline: dayjs(
          Math.min.apply(null, startDates)
        ).toString(),
        earliestStartDate: dayjs(Math.min.apply(null, startDates)).toString(),
        latestEndDate: dayjs(Math.max.apply(null, endDates)).toString(),
      }
    }

    return {
      earliestGroupDeadline: undefined,
      earliestStartDate: undefined,
      latestEndDate: undefined,
    }
  }, [groupActivities, microLearnings, practiceQuizzes])
}

export default useEarliestLatestCourseDates
