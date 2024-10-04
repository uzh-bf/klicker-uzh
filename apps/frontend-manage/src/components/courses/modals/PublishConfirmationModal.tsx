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
  const [publishPracticeQuiz, { loading: pqPublishLoading }] = useMutation(
    PublishPracticeQuizDocument,
    {
      variables: {
        id: elementId,
      },
    }
  )
  const [publishMicroLearning, { loading: mlPublishLoading }] = useMutation(
    PublishMicroLearningDocument,
    {
      variables: {
        id: elementId,
      },
    }
  )
  const [publishGroupActivity, { loading: gaPublishLoading }] = useMutation(
    PublishGroupActivityDocument,
    {
      variables: {
        id: elementId,
      },
    }
  )

  return (
    <Modal
      title={t(`manage.course.publishItem${elementType}`)}
      onPrimaryAction={
        <Button
          loading={pqPublishLoading || mlPublishLoading || gaPublishLoading}
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
            root: 'bg-primary-80 text-base font-bold text-white',
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
        content: 'w-[40rem]',
        title: 'text-xl',
      }}
    >
      <div>
        <div className="text-base">{t('manage.course.confirmPublishing')}</div>
        <div className="border-uzh-grey-40 mt-1 rounded border border-solid p-2">
          <H3>{title}</H3>
        </div>
        <div className="mb-2 mt-3 text-sm italic">{publicationHint}</div>
      </div>
    </Modal>
  )
}

export default PublishConfirmationModal
