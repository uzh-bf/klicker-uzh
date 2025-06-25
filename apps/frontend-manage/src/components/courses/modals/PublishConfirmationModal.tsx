import { useMutation } from '@apollo/client'
import {
  ElementInstanceType,
  GetSingleCourseDocument,
  GetUserActivitiesDocument,
  PublishGroupActivityDocument,
  PublishMicroLearningDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { H3, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface PublishConfirmationModalProps {
  onClose: () => void
  elementType:
    | ElementInstanceType.Microlearning
    | ElementInstanceType.GroupActivity
  elementId: string
  title: string
  courseId: string
  publicationHint: string
}

function PublishConfirmationModal({
  onClose,
  elementType,
  elementId,
  title,
  courseId,
  publicationHint,
}: PublishConfirmationModalProps) {
  const t = useTranslations()

  const [publishMicroLearning, { loading: mlPublishLoading }] = useMutation(
    PublishMicroLearningDocument,
    {
      variables: { id: elementId },
      // TODO: replace with proper cache update
      refetchQueries: [
        { query: GetUserActivitiesDocument },
        { query: GetSingleCourseDocument, variables: { id: courseId } },
      ],
    }
  )
  const [publishGroupActivity, { loading: gaPublishLoading }] = useMutation(
    PublishGroupActivityDocument,
    {
      variables: { id: elementId },
      // TODO: replace with proper cache update
      refetchQueries: [
        { query: GetUserActivitiesDocument },
        { query: GetSingleCourseDocument, variables: { id: courseId } },
      ],
    }
  )

  return (
    <Modal
      open
      title={t(`manage.course.publishItem${elementType}`)}
      primaryLabel={t('shared.generic.confirm')}
      primaryLoading={mlPublishLoading || gaPublishLoading}
      onPrimaryAction={async () => {
        if (elementType === ElementInstanceType.Microlearning) {
          await publishMicroLearning()
        } else if (elementType === ElementInstanceType.GroupActivity) {
          await publishGroupActivity()
        }
        onClose()
      }}
      dataPrimaryAction={{ cy: 'confirm-publish-action' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={() => {
        onClose()
      }}
      dataSecondaryAction={{ cy: 'cancel-publish-action' }}
      onClose={onClose}
      hideCloseButton={true}
      className={{
        content: 'w-[40rem]',
        title: 'text-xl',
      }}
    >
      <div className="mt-2">
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
