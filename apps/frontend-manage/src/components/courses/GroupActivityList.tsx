import { ActivityInfo, GroupActivity } from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import ActivityList from '../activities/overview/ActivityList'
import ActivityListLegend from '../activities/overview/ActivityListLegend'
import CatalystNotification from './CatalystNotification'
import GroupActivityElement from './GroupActivityElement'

interface GroupActivityListProps {
  groupActivities: (Partial<GroupActivity> &
    Pick<GroupActivity, 'id' | 'name'>)[]
  groupActivityActivities: ActivityInfo[]
  groupDeadlineDate: string
  numOfParticipantGroups: number
  courseId: string
  courseStartDate: string
  userCatalyst?: boolean
  privatePreview: boolean
}

function GroupActivityList({
  groupActivities,
  groupActivityActivities,
  groupDeadlineDate,
  numOfParticipantGroups,
  courseId,
  courseStartDate,
  userCatalyst,
  privatePreview,
}: GroupActivityListProps) {
  const t = useTranslations()

  return (
    <div className="flex w-full flex-col items-end">
      <div className="flex flex-row gap-2">
        <ActivityListLegend />
      </div>
      {/* // TODO: remove this old activity overview, once sharing is enabled for all users (& add catalyst notification below) */}
      {groupActivities && groupActivities.length > 0 && !privatePreview ? (
        <div className="flex flex-col gap-2">
          {groupActivities.map((groupActivity) => (
            <GroupActivityElement
              groupActivity={groupActivity}
              groupDeadlineDate={groupDeadlineDate}
              numOfParticipantGroups={numOfParticipantGroups}
              courseId={courseId}
              courseStartDate={courseStartDate}
              key={groupActivity.id}
            />
          ))}
        </div>
      ) : userCatalyst ? (
        <UserNotification
          type="warning"
          className={{
            root: twMerge('w-full text-left', privatePreview && 'hidden'),
          }}
        >
          {t('manage.course.noGroupActivities')}
        </UserNotification>
      ) : (
        <CatalystNotification />
      )}

      {groupActivityActivities &&
      groupActivityActivities.length > 0 &&
      privatePreview ? (
        <div className="mt-0.5 flex w-full flex-col">
          {privatePreview ? (
            <ActivityList
              activities={groupActivityActivities}
              noActivities={false}
              hideActivityType
            />
          ) : null}
        </div>
      ) : (
        <UserNotification
          type="warning"
          className={{
            root: twMerge('w-full text-left', !privatePreview && 'hidden'),
          }}
        >
          {t('manage.course.noGroupActivities')}
        </UserNotification>
      )}
    </div>
  )
}

export default GroupActivityList
