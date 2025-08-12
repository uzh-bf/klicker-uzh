import { ActivityInfo, PublicationStatus } from '@klicker-uzh/graphql/dist/ops'
import { Checkbox } from '@uzh-bf/design-system'
import { Dispatch, SetStateAction } from 'react'
import { isEmpty } from 'remeda'

function ActivityListSelectAllCheckbox({
  activities,
  selectedActivities,
  setSelectedActivities,
}: {
  activities: ActivityInfo[]
  selectedActivities: Record<string, ActivityInfo>
  setSelectedActivities: Dispatch<SetStateAction<Record<string, ActivityInfo>>>
}) {
  return (
    <Checkbox
      checked={
        activities.length !== 0 &&
        activities.every((a) => Boolean(selectedActivities[a.id]))
      }
      partial={
        Object.values(selectedActivities).filter((value) => value).length > 0
      }
      onCheck={() => {
        setSelectedActivities((prev) => {
          if (activities) {
            if (!isEmpty(selectedActivities)) {
              // if the selection is non-empty, reset it
              return {}
            }

            // add all activities to the selection
            return activities.reduce<Record<string, ActivityInfo>>(
              (acc, activity) => {
                // if the activity is not in scheduled or draft state, it should not be selectable
                if (
                  activity.status !== PublicationStatus.Draft &&
                  activity.status !== PublicationStatus.Scheduled
                ) {
                  return acc
                }

                acc[activity.id] = activity
                return acc
              },
              {}
            )
          }

          return prev
        })
      }}
      className={{ root: 'border-unset' }}
      data={{ cy: 'select-all-activities' }}
    />
  )
}

export default ActivityListSelectAllCheckbox
