import { faLink } from '@fortawesome/free-solid-svg-icons'
import { ActivityInfo, PracticeQuiz } from '@klicker-uzh/graphql/dist/ops'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import ActivityList from '../activities/overview/ActivityList'
import ActivityListLegend from '../activities/overview/ActivityListLegend'
import CatalystNotification from './CatalystNotification'
import PracticeQuizElement from './PracticeQuizElement'
import QRCodePopover from './QRCodePopover'

interface PracticeQuizTileProps {
  practiceQuizzes: Pick<
    PracticeQuiz,
    'id' | 'name' | 'status' | 'availableFrom' | 'numOfStacks'
  >[]
  practiceQuizActivities: ActivityInfo[]
  courseId: string
  courseStartDate: string
  userCatalyst?: boolean
  privatePreview: boolean
}

function PracticeQuizList({
  practiceQuizzes,
  practiceQuizActivities,
  courseId,
  courseStartDate,
  userCatalyst,
  privatePreview,
}: PracticeQuizTileProps) {
  const t = useTranslations()

  return (
    <div className="flex w-full flex-col items-end">
      <div className="flex flex-row gap-2">
        <QRCodePopover
          triggerStyle="basic"
          triggerText={t('manage.general.qrCode')}
          relHref={`/course/${courseId}/practiceQuizzes`}
          data={{ cy: `qr-link-microlearning-list` }}
        />
        <Button
          basic
          onClick={async () => {
            try {
              const link = `${process.env.NEXT_PUBLIC_LTI_URL}?redirectTo=${process.env.NEXT_PUBLIC_PWA_URL}/course/${courseId}/practiceQuizzes`
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
          <Button.Label>{`${t('manage.course.copyLTIAccessLink')}: ${t('manage.course.practiceQuizList')}`}</Button.Label>
        </Button>
        <ActivityListLegend />
      </div>

      {/* // TODO: remove this old activity overview, once sharing is enabled for all users (& add catalyst notification below) */}
      {practiceQuizzes && practiceQuizzes.length > 0 && !privatePreview ? (
        <div className="flex w-full flex-col gap-2">
          {practiceQuizzes.map((quiz) => (
            <PracticeQuizElement
              key={quiz.id}
              practiceQuiz={quiz}
              courseId={courseId}
              courseStartDate={courseStartDate}
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
          {t('manage.course.noPracticeQuizzes')}
        </UserNotification>
      ) : (
        <CatalystNotification />
      )}

      {practiceQuizActivities &&
      practiceQuizActivities.length > 0 &&
      privatePreview ? (
        <div className="mt-0.5 flex w-full flex-col">
          {privatePreview ? (
            <ActivityList
              activities={practiceQuizActivities}
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
          {t('manage.course.noPracticeQuizzes')}
        </UserNotification>
      )}
    </div>
  )
}

export default PracticeQuizList
