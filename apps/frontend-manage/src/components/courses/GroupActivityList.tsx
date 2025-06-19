import { ActivityInfo } from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import ActivityList from '../activities/overview/ActivityList'
import ActivityListLegend from '../activities/overview/ActivityListLegend'

function GroupActivityList({
  groupActivities,
}: {
  groupActivities: ActivityInfo[]
}) {
  const t = useTranslations()

  return (
    <div className="flex w-full flex-col items-end">
      <div className="flex flex-row gap-2">
        <ActivityListLegend />
      </div>

      {groupActivities && groupActivities.length > 0 ? (
        <div className="mt-0.5 flex w-full flex-col">
          <ActivityList
            activities={groupActivities}
            noActivities={false}
            hideActivityType
          />
        </div>
      ) : (
        <UserNotification
          type="warning"
          className={{ root: 'w-full text-left' }}
        >
          {t('manage.course.noGroupActivities')}
        </UserNotification>
      )}
    </div>
  )
}

export default GroupActivityList
