import { faUserGroup } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementInstanceType,
  MicroLearning,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import PublishConfirmationModal from '../modals/PublishConfirmationModal'

interface PublishMicroLearningButtonProps {
  microLearning: Partial<MicroLearning> & Pick<MicroLearning, 'id' | 'name'>
}

function PublishMicroLearningButton({
  microLearning,
}: PublishMicroLearningButtonProps) {
  const t = useTranslations()
  const [publishModal, setPublishModal] = useState(false)

  return (
    <>
      <Button
        basic
        className={{ root: 'text-primary-100' }}
        onClick={() => setPublishModal(true)}
        data={{ cy: `publish-microlearning-${microLearning.name}` }}
      >
        <Button.Icon>
          <FontAwesomeIcon icon={faUserGroup} className="w-[1.2rem]" />
        </Button.Icon>
        <Button.Label>{t('manage.course.publishMicrolearning')}</Button.Label>
      </Button>
      <PublishConfirmationModal
        elementType={ElementInstanceType.Microlearning}
        elementId={microLearning.id}
        title={microLearning.name}
        publicationHint={t('manage.course.microPublishingHint')}
        open={publishModal}
        setOpen={setPublishModal}
      />
    </>
  )
}

export default PublishMicroLearningButton
