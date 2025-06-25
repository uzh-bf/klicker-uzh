import { ActivityInfo, ActivityType } from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import { useMemo } from 'react'

function useEarliestLatestCourseDates({
  activities,
}: {
  activities?: Pick<
    ActivityInfo,
    'type' | 'scheduledStartAt' | 'automaticPublicationAt' | 'scheduledEndAt'
  >[]
}) {
  return useMemo(() => {
    if (activities && activities.length > 0) {
      const groupActivityStartDates = [
        ...activities
          .filter(
            (activity) =>
              activity.type === ActivityType.GroupActivity &&
              activity.scheduledStartAt !== null &&
              typeof activity.scheduledStartAt !== 'undefined'
          )
          .map((activity) => Date.parse(activity.scheduledStartAt)),
      ]
      const activityStartDates = [
        ...groupActivityStartDates,
        ...activities
          .filter(
            (activity) =>
              (activity.type !== ActivityType.GroupActivity &&
                activity.scheduledStartAt !== null &&
                typeof activity.scheduledStartAt !== 'undefined') ||
              (activity.automaticPublicationAt !== null &&
                typeof activity.automaticPublicationAt !== 'undefined')
          )
          .map((activity) => {
            return Date.parse(
              activity.scheduledStartAt ?? activity.automaticPublicationAt!
            )
          }),
      ]

      const activityEndDates = activities
        .filter(
          (activity) =>
            activity.scheduledEndAt !== null &&
            typeof activity.scheduledEndAt !== 'undefined'
        )
        .map((activity) => Date.parse(activity.scheduledEndAt))

      return {
        earliestGroupDeadline:
          groupActivityStartDates.length === 0
            ? undefined
            : dayjs(Math.min.apply(null, groupActivityStartDates)).toString(),
        earliestStartDate:
          activityStartDates.length === 0
            ? undefined
            : dayjs(Math.min.apply(null, activityStartDates)).toString(),
        latestEndDate:
          activityEndDates.length === 0
            ? undefined
            : dayjs(Math.max.apply(null, activityEndDates)).toString(),
      }
    }

    return {
      earliestGroupDeadline: undefined,
      earliestStartDate: undefined,
      latestEndDate: undefined,
    }
  }, [activities])
}

export default useEarliestLatestCourseDates
