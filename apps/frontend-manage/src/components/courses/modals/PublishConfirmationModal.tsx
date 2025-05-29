import { useMutation } from '@apollo/client'
import {
  ElementInstanceType,
  GetSingleCourseDocument,
  GetUserActivitiesDocument,
  PublishGroupActivityDocument,
  PublishMicroLearningDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H3, ModalLegacy } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface PublishConfirmationModalProps {
  open: boolean
  setOpen: (value: boolean) => void
  elementType:
    | ElementInstanceType.Microlearning
    | ElementInstanceType.GroupActivity
  elementId: string
  title: string
  courseId: string
  publicationHint: string
}

function PublishConfirmationModal({
  open,
  setOpen,
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
    <ModalLegacy
      title={t(`manage.course.publishItem${elementType}`)}
      onPrimaryAction={
        <Button
          primary
          loading={mlPublishLoading || gaPublishLoading}
          onClick={async () => {
            if (elementType === ElementInstanceType.Microlearning) {
              await publishMicroLearning()
            } else if (elementType === ElementInstanceType.GroupActivity) {
              await publishGroupActivity()
            }
            setOpen(false)
          }}
          data={{ cy: 'confirm-publish-action' }}
        >
          <Button.Label>{t('shared.generic.confirm')}</Button.Label>
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={(): void => setOpen(false)}
          data={{ cy: 'cancel-publish-action' }}
        >
          <Button.Label>{t('shared.generic.cancel')}</Button.Label>
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
    </ModalLegacy>
  )
}

export default PublishConfirmationModal
