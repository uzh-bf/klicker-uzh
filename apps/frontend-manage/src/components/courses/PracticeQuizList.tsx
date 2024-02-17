import { PracticeQuiz } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import CatalystNotification from './CatalystNotification'
import PracticeQuizElement from './PracticeQuizElement'

interface PracticeQuizTileProps {
  practiceQuizzes: Partial<PracticeQuiz>[]
  courseId: string
  userCatalyst?: boolean
}

function PracticeQuizList({
  practiceQuizzes,
  courseId,
  userCatalyst,
}: PracticeQuizTileProps) {
  const t = useTranslations()

  return (
    <>
      {practiceQuizzes && practiceQuizzes.length > 0 ? (
        <div className="flex flex-col gap-2">
          {practiceQuizzes.map((quiz) => (
            <PracticeQuizElement
              practiceQuiz={quiz}
              courseId={courseId}
              key={quiz.id}
            />
          ))}
        </div>
      ) : userCatalyst ? (
        <div>{t('manage.course.noPracticeQuizzes')}</div>
      ) : (
        <CatalystNotification />
      )}
    </>
  )
}

export default PracticeQuizList
