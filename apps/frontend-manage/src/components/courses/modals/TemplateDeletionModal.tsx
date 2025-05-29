import { useMutation } from '@apollo/client'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivityType,
  DeleteActivityTemplateDocument,
  GetUserActivitiesDocument,
  GetUserLiveQuizzesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
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
      refetchQueries: [
        { query: GetUserLiveQuizzesDocument },
        { query: GetUserActivitiesDocument },
      ],
    }
  )

  return (
    <Modal
      title={t('manage.template.deleteTemplate')}
      open={open}
      onClose={() => setOpen(false)}
      data={{ cy: 'delete-template-modal' }}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          {!deleting && <FontAwesomeIcon icon={faTrashCan} />}
          <span>{t('manage.template.deleteTemplate')}</span>
        </div>
      }
      primaryButtonStyle="destructive"
      primaryLoading={deleting}
      onPrimaryAction={async () => {
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
      dataPrimaryAction={{ cy: 'confirm-template-deletion' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={() => setOpen(false)}
      dataSecondaryAction={{ cy: 'cancel-deletion' }}
    >
      {t('manage.template.deleteTemplateExplanation')}
    </Modal>
  )
}

export default TemplateDeletionModal
