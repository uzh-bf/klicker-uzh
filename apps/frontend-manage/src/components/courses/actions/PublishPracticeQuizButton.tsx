import { faUserGroup } from '@fortawesome/free-solid-svg-icons'
import { PracticeQuiz } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import PracticeQuizPublishingModal from '../modals/PracticeQuizPublishingModal'

function PublishPracticeQuizButton({
  practiceQuiz,
  courseId,
  courseStartDate,
}: {
  practiceQuiz: Pick<PracticeQuiz, 'id' | 'name'>
  courseId: string
  courseStartDate: string
}) {
  const t = useTranslations()
  const [publishModal, setPublishModal] = useState(false)

  return (
    <>
      <Button
        basic
        onClick={() => setPublishModal(true)}
        data={{ cy: `publish-practice-quiz-${practiceQuiz.name}` }}
        className={{
          root: 'text-primary-100 hover:text-primary-100 h-7 py-0 text-sm',
        }}
      >
        <Button.Icon icon={faUserGroup} />
        <Button.Label>{t('manage.course.publishPracticeQuiz')}</Button.Label>
      </Button>
      <PracticeQuizPublishingModal
        elementId={practiceQuiz.id}
        title={practiceQuiz.name}
        open={publishModal}
        setOpen={setPublishModal}
        courseId={courseId}
        courseStartDate={courseStartDate}
      />
    </>
  )
}

export default PublishPracticeQuizButton
