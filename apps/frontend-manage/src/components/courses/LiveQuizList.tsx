import { faLink } from '@fortawesome/free-solid-svg-icons'
import { PublicationStatus } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { sort } from 'remeda'
import LiveQuizElement, { LiveQuizListElementType } from './LiveQuizElement'
import QRCodePopover from './QRCodePopover'

const sortingOrderLiveQuizzes: Record<PublicationStatus, number> = {
  [PublicationStatus.Published]: 0,
  [PublicationStatus.Scheduled]: 1,
  [PublicationStatus.Draft]: 2,
  [PublicationStatus.Template]: 3,
  [PublicationStatus.Ended]: 4,
  [PublicationStatus.Graded]: 5,
}

function LiveQuizList({
  courseId,
  liveQuizzes,
}: {
  courseId: string
  liveQuizzes: LiveQuizListElementType[]
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
      </div>

      {liveQuizzes && liveQuizzes.length > 0 ? (
        <div className="flex w-full flex-col gap-2">
          {sort(liveQuizzes, (a, b) => {
            if (!a.status || !b.status) return 0

            return (
              sortingOrderLiveQuizzes[a.status] -
              sortingOrderLiveQuizzes[b.status]
            )
          }).map((quiz) => (
            <LiveQuizElement quiz={quiz} key={quiz.id} />
          ))}
        </div>
      ) : (
        <div>{t('manage.course.noLiveQuizzes')}</div>
      )}
    </div>
  )
}

export default LiveQuizList
