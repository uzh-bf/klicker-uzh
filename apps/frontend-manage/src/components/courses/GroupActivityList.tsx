import { GroupActivity } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import CatalystNotification from './CatalystNotification'
import GroupActivityElement from './GroupActivityElement'

interface GroupActivityListProps {
  groupActivities: (Partial<GroupActivity> &
    Pick<GroupActivity, 'id' | 'name'>)[]
  groupDeadlineDate: Date
  numOfParticipantGroups: number
  courseId: string
  userCatalyst?: boolean
}

function GroupActivityList({
  groupActivities,
  groupDeadlineDate,
  numOfParticipantGroups,
  courseId,
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
              key={groupActivity.id}
            />
          ))}
        </div>
      ) : userCatalyst ? (
        <div>{t('manage.course.noGroupActivities')}</div>
      ) : (
        <CatalystNotification />
      )}
    </>
  )
}

export default GroupActivityList
