import { GroupActivity } from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import CatalystNotification from './CatalystNotification'
import GroupActivityElement from './GroupActivityElement'

interface GroupActivityListProps {
  groupActivities: (Partial<GroupActivity> &
    Pick<GroupActivity, 'id' | 'name'>)[]
  groupDeadlineDate: string
  numOfParticipantGroups: number
  courseId: string
  courseStartDate: string
  userCatalyst?: boolean
}

function GroupActivityList({
  groupActivities,
  groupDeadlineDate,
  numOfParticipantGroups,
  courseId,
  courseStartDate,
  userCatalyst,
}: GroupActivityListProps) {
  const t = useTranslations()

  return (
    <>
      {groupActivities && groupActivities.length > 0 ? (
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
          className={{ root: 'w-full text-left' }}
        >
          {t('manage.course.noGroupActivities')}
        </UserNotification>
      ) : (
        <CatalystNotification />
      )}
    </>
  )
}

export default GroupActivityList
