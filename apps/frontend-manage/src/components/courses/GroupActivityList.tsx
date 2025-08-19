import { faCalendar } from '@fortawesome/free-regular-svg-icons'
import { ActivityInfo, ActivityType } from '@klicker-uzh/graphql/dist/ops'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import ActivityList from '../activities/overview/ActivityList'
import ActivityListLegend from '../activities/overview/ActivityListLegend'

function GroupActivityList({
  groupActivities,
  openCalendarView,
  highlightedActivity,
}: {
  groupActivities: ActivityInfo[]
  openCalendarView: () => void
  highlightedActivity: string | null
}) {
  const t = useTranslations()

  return (
    <div className="flex w-full flex-col items-end">
      <div className="flex w-full flex-row flex-wrap items-center justify-between gap-2">
        <Button
          basic
          onClick={openCalendarView}
          className={{
            root: 'text-primary-100 hover:text-primary-100 float-right mb-1 h-7 w-max px-2 py-0 text-sm',
          }}
        >
          <Button.Icon icon={faCalendar} />
          <Button.Label>{t('manage.course.calendarView')}</Button.Label>
        </Button>
        <div className="flex flex-row gap-2">
          <ActivityListLegend type={ActivityType.GroupActivity} />
        </div>
      </div>

      {groupActivities && groupActivities.length > 0 ? (
        <div className="mt-0.5 flex w-full flex-col">
          <ActivityList
            hideActivityType
            filtersActive={false}
            activities={groupActivities}
            noActivities={false}
            highlightedActivity={highlightedActivity}
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
