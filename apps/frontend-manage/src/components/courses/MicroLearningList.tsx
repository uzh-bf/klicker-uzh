import { faLink } from '@fortawesome/free-solid-svg-icons'
import { MicroLearning } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
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
  courseId: string
  userCatalyst?: boolean
}

function MicroLearningList({
  microLearnings,
  courseId,
  userCatalyst,
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

      {microLearnings && microLearnings.length > 0 ? (
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
        <div>{t('manage.course.noPracticeQuizzes')}</div>
      ) : (
        <CatalystNotification />
      )}
    </div>
  )
}

export default MicroLearningList
