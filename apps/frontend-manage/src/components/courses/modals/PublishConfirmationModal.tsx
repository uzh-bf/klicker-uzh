import { useMutation } from '@apollo/client'
import {
  ElementInstanceType,
  PublishGroupActivityDocument,
  PublishMicroLearningDocument,
  PublishPracticeQuizDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H3, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface PublishConfirmationModalProps {
  elementType:
    | ElementInstanceType.Microlearning
    | ElementInstanceType.PracticeQuiz
    | ElementInstanceType.GroupActivity
  elementId: string
  title: string
  publicationHint: string
  open: boolean
  setOpen: (value: boolean) => void
}

function PublishConfirmationModal({
  elementType,
  elementId,
  title,
  publicationHint,
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
  const [publishGroupActivity] = useMutation(PublishGroupActivityDocument, {
    variables: {
      id: elementId,
    },
  })

  return (
    <Modal
      title={t(`manage.course.publishItem${elementType}`)}
      onPrimaryAction={
        <Button
          onClick={async () => {
            if (elementType === ElementInstanceType.Microlearning) {
              await publishMicroLearning()
            } else if (elementType === ElementInstanceType.PracticeQuiz) {
              await publishPracticeQuiz()
            } else if (elementType === ElementInstanceType.GroupActivity) {
              await publishGroupActivity()
            }
            setOpen(false)
          }}
          className={{
            root: 'font-bold text-white bg-primary-80 text-base',
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
          className={{ root: 'text-base' }}
        >
          {t('shared.generic.cancel')}
        </Button>
      }
      onClose={(): void => setOpen(false)}
      open={open}
      hideCloseButton={true}
      className={{
        content: 'w-[40rem] h-max self-center pt-0',
        title: 'text-xl',
      }}
    >
      <div>
        <div className="text-base">{t('manage.course.confirmPublishing')}</div>
        <div className="p-2 mt-1 border border-solid rounded border-uzh-grey-40">
          <H3>{title}</H3>
        </div>
        <div className="mt-3 mb-2 text-sm italic">{publicationHint}</div>
      </div>
    </Modal>
  )
}

export default PublishConfirmationModal
