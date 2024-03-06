import { Session, SessionStatus } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { sort } from 'ramda'
import LiveQuizElement from './LiveQuizElement'

interface LiveQuizListProps {
  sessions: Partial<Session>[]
}

function LiveQuizList({ sessions }: LiveQuizListProps) {
  const t = useTranslations()

  const sortingOrderSessions: Record<string, number> = {
    [SessionStatus.Running]: 0,
    [SessionStatus.Scheduled]: 1,
    [SessionStatus.Prepared]: 2,
    [SessionStatus.Completed]: 3,
  }

  return (
    <>
      {sessions && sessions.length > 0 ? (
        <div className="flex flex-col gap-2">
          {sort((a, b) => {
            if (!a.status || !b.status) return 0

            return (
              sortingOrderSessions[a.status] - sortingOrderSessions[b.status]
            )
          }, sessions).map((session) => (
            <LiveQuizElement session={session} key={session.id} />
          ))}
        </div>
      ) : (
        <div>{t('manage.course.noSessions')}</div>
      )}
    </>
  )
}

export default LiveQuizList
