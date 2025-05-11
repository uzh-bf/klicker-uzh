import { faLink } from '@fortawesome/free-solid-svg-icons'
import { ActivityInfo, MicroLearning } from '@klicker-uzh/graphql/dist/ops'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import ActivityList from '../activities/overview/ActivityList'
import ActivityListLegend from '../activities/overview/ActivityListLegend'
import CatalystNotification from './CatalystNotification'
import MicroLearningElement from './MicroLearningElement'
import QRCodePopover from './QRCodePopover'

interface MicroLearningListProps {
  microLearnings: Pick<
    MicroLearning,
    | 'id'
    | 'name'
    | 'status'
    | 'numOfStacks'
    | 'scheduledStartAt'
    | 'scheduledEndAt'
  >[]
  microLearningActivities: ActivityInfo[]
  courseId: string
  userCatalyst?: boolean
  privatePreview: boolean
}

function MicroLearningList({
  microLearnings,
  microLearningActivities,
  courseId,
  userCatalyst,
  privatePreview,
}: MicroLearningListProps) {
  const t = useTranslations()

  return (
    <div className="flex w-full flex-col items-end">
      <div className="flex flex-row gap-2">
        <QRCodePopover
          triggerStyle="basic"
          triggerText={t('manage.general.qrCode')}
          relHref={`/course/${courseId}/microLearnings`}
          data={{ cy: `qr-link-practice-quiz-list` }}
        />
        <Button
          basic
          onClick={async () => {
            try {
              const link = `${process.env.NEXT_PUBLIC_LTI_URL}?redirectTo=${process.env.NEXT_PUBLIC_PWA_URL}/course/${courseId}/microLearnings`
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
          <Button.Label>{`${t('manage.course.copyLTIAccessLink')}: ${t('manage.course.microLearningList')}`}</Button.Label>
        </Button>
      </div>

      {/* // TODO: remove this old activity overview, once sharing is enabled for all users (& add catalyst notification below) */}
      {microLearnings && microLearnings.length > 0 && !privatePreview ? (
        <div className="flex w-full flex-col gap-2">
          {microLearnings.map((microlearning) => (
            <MicroLearningElement
              microLearning={microlearning}
              courseId={courseId}
              key={microlearning.id}
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
          {t('manage.course.noMicrolearnings')}
        </UserNotification>
      ) : (
        <CatalystNotification />
      )}

      {microLearningActivities &&
      microLearningActivities.length > 0 &&
      privatePreview ? (
        <div className="mt-0.5 flex w-full flex-col">
          {privatePreview ? (
            <>
              <ActivityListLegend className="mr-2" />
              <ActivityList
                activities={microLearningActivities}
                noActivities={false}
                hideActivityType
              />
            </>
          ) : null}
        </div>
      ) : (
        <UserNotification
          type="warning"
          className={{
            root: twMerge('w-full text-left', !privatePreview && 'hidden'),
          }}
        >
          {t('manage.course.noMicrolearnings')}
        </UserNotification>
      )}
    </div>
  )
}

export default MicroLearningList
