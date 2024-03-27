import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { MicroLearning } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import MicroLearningDeletionModal from '../modals/MicroLearningDeletionModal'

interface DeleteMicroLearningButtonProps {
  microLearning: Partial<MicroLearning> & Pick<MicroLearning, 'id' | 'name'>
}

function DeleteMicroLearningButton({
  microLearning,
}: DeleteMicroLearningButtonProps) {
  const t = useTranslations()
  const [deletionModal, setDeletionModal] = useState(false)

  return (
    <>
      <Button
        basic
        className={{ root: 'text-red-600' }}
        onClick={() => setDeletionModal(true)}
        data={{ cy: `delete-microlearning-${microLearning.name}` }}
      >
        <Button.Icon>
          <FontAwesomeIcon icon={faTrashCan} className="w-[1.1rem]" />
        </Button.Icon>
        <Button.Label>{t('manage.course.deleteMicrolearning')}</Button.Label>
      </Button>
      <MicroLearningDeletionModal
        sessionId={microLearning.id}
        title={microLearning.name}
        open={deletionModal}
        setOpen={setDeletionModal}
      />
    </>
  )
}

export default DeleteMicroLearningButton
