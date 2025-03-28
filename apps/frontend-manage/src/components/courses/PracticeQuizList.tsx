import { faLink } from '@fortawesome/free-solid-svg-icons'
import { PracticeQuiz } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
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
    <div className="flex w-full flex-col items-end">
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
          root: 'text-primary-100 hover:text-primary-100 float-right mb-1 h-7 w-max px-1 py-0 text-sm',
        }}
      >
        <Button.Icon icon={faLink} />
        <Button.Label>{`${t('manage.course.copyLTIAccessLink')}: ${t('manage.course.practiceQuizList')}`}</Button.Label>
      </Button>

      {practiceQuizzes && practiceQuizzes.length > 0 ? (
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
        <div>{t('manage.course.noPracticeQuizzes')}</div>
      ) : (
        <CatalystNotification />
      )}
    </div>
  )
}

export default PracticeQuizList
