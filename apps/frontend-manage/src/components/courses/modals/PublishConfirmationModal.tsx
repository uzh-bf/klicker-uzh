import { useMutation } from '@apollo/client'
import {
  ElementInstanceType,
  PublishMicroLearningDocument,
  PublishPracticeQuizDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, H3, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface PublishConfirmationModalProps {
  elementType:
    | ElementInstanceType.Microlearning
    | ElementInstanceType.PracticeQuiz
  elementId: string
  title: string
  open: boolean
  setOpen: (value: boolean) => void
}

function PublishConfirmationModal({
  elementType,
  elementId,
  title,
  open,
  setOpen,
}: PublishConfirmationModalProps) {
  const t = useTranslations()
  const [publishPracticeQuiz] = useMutation(PublishPracticeQuizDocument, {
    variables: {
      id: elementId,
    },
  })
  const [publishMicroLearning] = useMutation(PublishMicroLearningDocument, {
    variables: {
      id: elementId,
    },
  })

  return (
    <Modal
      onPrimaryAction={
        <Button
          onClick={async () => {
            if (elementType === ElementInstanceType.Microlearning) {
              await publishMicroLearning()
            } else if (elementType === ElementInstanceType.PracticeQuiz) {
              await publishPracticeQuiz()
            }
            setOpen(false)
          }}
          className={{
            root: 'font-bold text-white bg-primary-80',
          }}
          data={{ cy: 'confirm-publish-action' }}
        >
          {t('shared.generic.confirm')}
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={(): void => setOpen(false)}
          data={{ cy: 'cancel-publish-action' }}
        >
          {t('shared.generic.cancel')}
        </Button>
      }
      onClose={(): void => setOpen(false)}
      open={open}
      hideCloseButton={true}
      className={{ content: 'w-[40rem] h-max self-center pt-0' }}
    >
      <div>
        <H2>{t(`manage.course.publishItem${elementType}`)}</H2>
        <div>{t('manage.course.confirmPublishing')}</div>
        <div className="p-2 mt-1 border border-solid rounded border-uzh-grey-40">
          <H3>{title}</H3>
        </div>
        <div className="mt-6 mb-2 text-sm italic">
          {t('manage.course.publishingHint')}
          {elementType === ElementInstanceType.Microlearning &&
            t('manage.course.microPublishingHint')}
        </div>
      </div>
    </Modal>
  )
}

export default PublishConfirmationModal
