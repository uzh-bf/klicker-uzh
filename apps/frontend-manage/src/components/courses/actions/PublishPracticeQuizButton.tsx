import { faUserGroup } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { PracticeQuiz } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import PracticeQuizPublishingModal from '../modals/PracticeQuizPublishingModal'

function PublishPracticeQuizButton({
  practiceQuiz,
  courseStartDate,
}: {
  practiceQuiz: Pick<PracticeQuiz, 'id' | 'name'>
  courseStartDate: string
}) {
  const t = useTranslations()
  const [publishModal, setPublishModal] = useState(false)

  return (
    <>
      <Button
        basic
        className={{ root: 'text-primary-100 flex flex-row gap-3' }}
        onClick={() => setPublishModal(true)}
        data={{ cy: `publish-practice-quiz-${practiceQuiz.name}` }}
      >
        <Button.Icon>
          <FontAwesomeIcon icon={faUserGroup} className="w-[1.2rem]" />
        </Button.Icon>
        <Button.Label>{t('manage.course.publishPracticeQuiz')}</Button.Label>
      </Button>
      <PracticeQuizPublishingModal
        elementId={practiceQuiz.id}
        title={practiceQuiz.name}
        open={publishModal}
        setOpen={setPublishModal}
        courseStartDate={courseStartDate}
      />
    </>
  )
}

export default PublishPracticeQuizButton
