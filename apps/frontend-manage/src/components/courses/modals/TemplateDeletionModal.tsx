import { useMutation } from '@apollo/client'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import {
  ActivityType,
  DeleteActivityTemplateDocument,
  GetUserActivitiesDocument,
  GetUserLiveQuizzesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface TemplateDeletionModalProps {
  activityId: string
  activityType: ActivityType
  open: boolean
  setOpen: (open: boolean) => void
  onSuccess: () => void
  onError: () => void
}

function TemplateDeletionModal({
  activityId,
  activityType,
  open,
  setOpen,
  onSuccess,
  onError,
}: TemplateDeletionModalProps) {
  const t = useTranslations()
  const [deleteActivityTemplate, { loading: deleting }] = useMutation(
    DeleteActivityTemplateDocument,
    {
      variables: {
        activityId: activityId,
        activityType: activityType,
      },
      // TODO: update cache instead of triggering refetch query once combined activity overview is available
      refetchQueries: [GetUserLiveQuizzesDocument, GetUserActivitiesDocument],
    }
  )

  return (
    <Modal
      title={t('manage.template.deleteTemplate')}
      open={open}
      onClose={() => setOpen(false)}
      data={{ cy: 'delete-template-modal' }}
    >
      <div>{t('manage.template.deleteTemplateExplanation')}</div>
      <div className="mt-4 flex justify-between">
        <Button onClick={() => setOpen(false)} data={{ cy: 'cancel-deletion' }}>
          <Button.Label>{t('shared.generic.cancel')}</Button.Label>
        </Button>
        <Button
          destructive
          onClick={async () => {
            try {
              const { data } = await deleteActivityTemplate()

              if (data?.deleteActivityTemplate) {
                onSuccess()
                setOpen(false)
              } else {
                onError()
              }
            } catch (e) {
              console.error(e)
              onError()
            }
          }}
          disabled={deleting}
          loading={deleting}
          data={{ cy: 'confirm-template-deletion' }}
        >
          <Button.Icon icon={faTrash} loading={deleting} />
          <Button.Label>{t('manage.template.deleteTemplate')}</Button.Label>
        </Button>
      </div>
    </Modal>
  )
}

export default TemplateDeletionModal
