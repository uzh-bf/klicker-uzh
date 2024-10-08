import { faUserGroup } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementInstanceType,
  PracticeQuiz,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import PublishConfirmationModal from '../modals/PublishConfirmationModal'

interface PublishPracticeQuizButtonProps {
  practiceQuiz: Partial<PracticeQuiz>
}

function PublishPracticeQuizButton({
  practiceQuiz,
}: PublishPracticeQuizButtonProps) {
  const t = useTranslations()
  const [publishModal, setPublishModal] = useState(false)
  const startFuture =
    practiceQuiz.availableFrom &&
    dayjs(practiceQuiz.availableFrom).isAfter(dayjs())

  return (
    <>
      <Button
        basic
        className={{ root: 'text-primary-100' }}
        onClick={() => setPublishModal(true)}
        data={{ cy: `publish-practice-quiz-${practiceQuiz.name}` }}
      >
        <Button.Icon>
          <FontAwesomeIcon icon={faUserGroup} className="w-[1.1rem]" />
        </Button.Icon>
        <Button.Label>{t('manage.course.publishPracticeQuiz')}</Button.Label>
      </Button>
      <PublishConfirmationModal
        elementType={ElementInstanceType.PracticeQuiz}
        elementId={practiceQuiz.id!}
        title={practiceQuiz.name!}
        publicationHint={
          startFuture
            ? t('manage.course.practiceSchedulingHint', {
                date: dayjs(practiceQuiz.availableFrom).format(
                  'DD.MM.YYYY HH:mm'
                ),
              })
            : t('manage.course.practicePublishingHint')
        }
        open={publishModal}
        setOpen={setPublishModal}
      />
    </>
  )
}

export default PublishPracticeQuizButton
