import { faCalendar } from '@fortawesome/free-regular-svg-icons'
import { faLink } from '@fortawesome/free-solid-svg-icons'
import {
  ActivityInfo,
  ActivityType,
  LocaleType,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, toast, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import ActivityList from '../activities/overview/ActivityList'
import ActivityListLegend from '../activities/overview/ActivityListLegend'
import QRCodePopover from './QRCodePopover'

function MicroLearningList({
  courseId,
  courseLanguage,
  microLearnings,
  openCalendarView,
  highlightedActivity,
}: {
  courseId: string
  courseLanguage: LocaleType
  microLearnings: ActivityInfo[]
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
          <QRCodePopover
            triggerStyle="basic"
            triggerText={t('manage.general.qrCode')}
            relHref={`/${courseLanguage}/course/${courseId}/microLearnings/overview`}
            data={{ cy: `qr-link-practice-quiz-list` }}
          />
          <Button
            basic
            onClick={async () => {
              try {
                const link = `${process.env.NEXT_PUBLIC_LTI_URL}?redirectTo=${process.env.NEXT_PUBLIC_PWA_URL}/${courseLanguage}/course/${courseId}/microLearnings/overview`
                await navigator.clipboard.writeText(link)
                toast({
                  type: 'success',
                  message: t('manage.course.linkLTICopied'),
                })
              } catch (e) {
                console.error(e)
                toast({
                  type: 'error',
                  message: t('manage.course.linkLTIError'),
                })
              }
            }}
            className={{
              root: 'text-primary-100 hover:text-primary-100 float-right mb-1 h-7 w-max px-2 py-0 text-sm',
            }}
          >
            <Button.Icon icon={faLink} />
            <Button.Label>{`${t('manage.course.copyLTIAccessLink')}: ${t('manage.course.microLearningList')}`}</Button.Label>
          </Button>
          <ActivityListLegend type={ActivityType.MicroLearning} />
        </div>
      </div>

      {microLearnings && microLearnings.length > 0 ? (
        <div className="mt-0.5 flex w-full flex-col">
          <ActivityList
            hideActivityType
            filtersActive={false}
            activities={microLearnings}
            noActivities={false}
            highlightedActivity={highlightedActivity}
          />
        </div>
      ) : (
        <UserNotification
          type="warning"
          className={{ root: 'w-full text-left' }}
        >
          {t('manage.course.noMicrolearnings')}
        </UserNotification>
      )}
    </div>
  )
}

export default MicroLearningList
