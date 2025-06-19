import { faLink } from '@fortawesome/free-solid-svg-icons'
import { ActivityInfo } from '@klicker-uzh/graphql/dist/ops'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import ActivityList from '../activities/overview/ActivityList'
import ActivityListLegend from '../activities/overview/ActivityListLegend'
import QRCodePopover from './QRCodePopover'

function LiveQuizList({
  courseId,
  liveQuizzes,
}: {
  courseId: string
  liveQuizzes: ActivityInfo[]
}) {
  const t = useTranslations()

  return (
    <div className="flex w-full flex-col items-end">
      <div className="flex flex-row gap-2">
        <QRCodePopover
          triggerStyle="basic"
          triggerText={t('manage.general.qrCode')}
          relHref={`/course/${courseId}/liveQuizzes`}
          data={{ cy: `qr-link-live-quiz-list` }}
        />
        <Button
          basic
          onClick={async () => {
            try {
              const link = `${process.env.NEXT_PUBLIC_LTI_URL}?redirectTo=${process.env.NEXT_PUBLIC_PWA_URL}/course/${courseId}/liveQuizzes`
              console.log(link)
              await navigator.clipboard.writeText(link)
            } catch (e) {
              console.log(e)
            }
          }}
          className={{
            root: 'text-primary-100 hover:text-primary-100 float-right mb-1 h-7 w-max px-2 py-0 text-sm',
          }}
        >
          <Button.Icon icon={faLink} />
          <Button.Label>{`${t('manage.course.copyLTIAccessLink')}: ${t('manage.course.liveQuizList')}`}</Button.Label>
        </Button>
        <ActivityListLegend />
      </div>

      {liveQuizzes && liveQuizzes.length > 0 ? (
        <div className="mt-0.5 flex w-full flex-col">
          <ActivityList
            activities={liveQuizzes}
            noActivities={false}
            hideActivityType
          />
        </div>
      ) : (
        <UserNotification
          type="warning"
          className={{ root: 'w-full text-left' }}
        >
          {t('manage.course.noLiveQuizzes')}
        </UserNotification>
      )}
    </div>
  )
}

export default LiveQuizList
