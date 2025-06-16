import { faUserGroup } from '@fortawesome/free-solid-svg-icons'
import {
  ElementInstanceType,
  MicroLearning,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import PublishConfirmationModal from '../modals/PublishConfirmationModal'

function PublishMicroLearningButton({
  microLearning,
  courseId,
}: {
  microLearning: Partial<MicroLearning> & Pick<MicroLearning, 'id' | 'name'>
  courseId: string
}) {
  const t = useTranslations()
  const [publishModal, setPublishModal] = useState(false)

  return (
    <div>
      <Button
        basic
        onClick={() => setPublishModal(true)}
        className={{
          root: 'text-primary-100 hover:text-primary-100 h-7 py-0 text-sm',
        }}
        data={{ cy: `publish-microlearning-${microLearning.name}` }}
      >
        <Button.Icon icon={faUserGroup} />
        <Button.Label>{t('manage.course.publishMicrolearning')}</Button.Label>
      </Button>
      {publishModal && (
        <PublishConfirmationModal
          onClose={() => setPublishModal(false)}
          elementType={ElementInstanceType.Microlearning}
          elementId={microLearning.id}
          title={microLearning.name}
          courseId={courseId}
          publicationHint={t('manage.course.microPublishingHint')}
        />
      )}
    </div>
  )
}

export default PublishMicroLearningButton
