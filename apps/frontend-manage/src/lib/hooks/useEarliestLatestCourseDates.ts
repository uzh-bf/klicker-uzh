import { ActivityType } from '@klicker-uzh/types'
import dayjs from 'dayjs'
import { useMemo } from 'react'

type CourseDateActivity = {
  type: ActivityType
  scheduledStartAt?: string | Date | null
  automaticPublicationAt?: string | Date | null
  scheduledEndAt?: string | Date | null
}

function toTime(value: string | Date) {
  return value instanceof Date ? value.getTime() : Date.parse(value)
}

function useEarliestLatestCourseDates({
  activities,
}: {
  activities?: CourseDateActivity[]
}) {
  return useMemo(() => {
    if (activities && activities.length > 0) {
      const groupActivityStartDates = [
        ...activities
          .filter(
            (activity) =>
              activity.type === ActivityType.GROUP_ACTIVITY &&
              activity.scheduledStartAt !== null &&
              typeof activity.scheduledStartAt !== 'undefined'
          )
          .map((activity) => toTime(activity.scheduledStartAt!)),
      ]
      const activityStartDates = [
        ...groupActivityStartDates,
        ...activities
          .filter(
            (activity) =>
              (activity.type !== ActivityType.GROUP_ACTIVITY &&
                activity.scheduledStartAt !== null &&
                typeof activity.scheduledStartAt !== 'undefined') ||
              (activity.automaticPublicationAt !== null &&
                typeof activity.automaticPublicationAt !== 'undefined')
          )
          .map((activity) => {
            return toTime(
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
        .map((activity) => toTime(activity.scheduledEndAt!))

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
