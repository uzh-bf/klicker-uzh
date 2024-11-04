import { SessionStatus } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { sort } from 'remeda'
import LiveQuizElement, { LiveQuizListElementType } from './LiveQuizElement'

const sortingOrderSessions: Record<string, number> = {
  [SessionStatus.Running]: 0,
  [SessionStatus.Scheduled]: 1,
  [SessionStatus.Prepared]: 2,
  [SessionStatus.Completed]: 3,
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
              sortingOrderSessions[a.status] - sortingOrderSessions[b.status]
            )
          }).map((quiz) => (
            <LiveQuizElement quiz={quiz} key={quiz.id} />
          ))}
        </div>
      ) : (
        <div>{t('manage.course.noSessions')}</div>
      )}
    </div>
  )
}

export default LiveQuizList
