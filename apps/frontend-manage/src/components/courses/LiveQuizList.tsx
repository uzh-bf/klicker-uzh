import { PublicationStatus } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { sort } from 'remeda'
import LiveQuizElement, { LiveQuizListElementType } from './LiveQuizElement'

const sortingOrderLiveQuizzes: Record<PublicationStatus, number> = {
  [PublicationStatus.Published]: 0,
  [PublicationStatus.Scheduled]: 1,
  [PublicationStatus.Draft]: 2,
  [PublicationStatus.Ended]: 3,
  [PublicationStatus.Graded]: 4,
}

function LiveQuizList({
  liveQuizzes,
}: {
  liveQuizzes: LiveQuizListElementType[]
}) {
  const t = useTranslations()

  return (
    <div className="">
      {liveQuizzes && liveQuizzes.length > 0 ? (
        <div className="flex flex-col gap-2">
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
