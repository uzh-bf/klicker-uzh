import { PracticeQuiz } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import CatalystNotification from './CatalystNotification'
import PracticeQuizElement from './PracticeQuizElement'

interface PracticeQuizTileProps {
  practiceQuizzes: Pick<
    PracticeQuiz,
    'id' | 'name' | 'status' | 'availableFrom' | 'numOfStacks'
  >[]
  courseId: string
  courseStartDate: string
  userCatalyst?: boolean
}

function PracticeQuizList({
  practiceQuizzes,
  courseId,
  courseStartDate,
  userCatalyst,
}: PracticeQuizTileProps) {
  const t = useTranslations()

  return (
    <>
      {practiceQuizzes && practiceQuizzes.length > 0 ? (
        <div className="flex flex-col gap-2">
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
        <div>{t('manage.course.noPracticeQuizzes')}</div>
      ) : (
        <CatalystNotification />
      )}
    </>
  )
}

export default PracticeQuizList
