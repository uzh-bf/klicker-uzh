import { Modal, toast, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { trpc } from '../../../lib/trpc'

function AssignmentConfirmationModal({
  courseId,
  onAssigned,
  onClose,
}: {
  courseId: string
  onAssigned: () => void
  onClose: () => void
}) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const assignmentMutation =
    trpc.course.manualRandomGroupAssignments.useMutation()

  function showErrorToast() {
    console.error('Error while creating random groups')
    toast({
      type: 'error',
      message: t('manage.course.groupAssignmentFailed'),
      options: { duration: 5000 },
    })
  }

  return (
    <Modal
      open
      onClose={() => {
        if (!assignmentMutation.isLoading) {
          onClose()
        }
      }}
      title={t('manage.course.finalizeRandomGroupAssignment')}
      primaryLabel={t('shared.generic.confirm')}
      primaryLoading={assignmentMutation.isLoading}
      onPrimaryAction={async () => {
        if (assignmentMutation.isLoading) {
          return
        }

        try {
          const res = await assignmentMutation.mutateAsync({ courseId })

          if (!res.participantGroups) {
            showErrorToast()
            return
          }

          void Promise.all([
            utils.course.groups.invalidate({ courseId }),
            utils.course.summary.invalidate({ courseId }),
          ]).catch(console.error)
          onAssigned()
          toast({
            type: 'success',
            message: t('manage.course.groupAssignmentSuccessful'),
            options: { duration: 5000 },
          })
          onClose()
        } catch {
          showErrorToast()
        }
      }}
      dataPrimaryAction={{ cy: 'confirm-random-group-assignment' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={() => {
        if (!assignmentMutation.isLoading) {
          onClose()
        }
      }}
      dataSecondaryAction={{ cy: 'cancel-random-group-assignment' }}
    >
      <div className="mb-2 font-bold">{t('shared.generic.pleaseReview')}</div>
      <UserNotification type="warning">
        {t.rich('manage.course.confirmRandomGroupAssignment', {
          ul: (children) => <ul className="list-disc">{children}</ul>,
          li: (children) => <li>{children}</li>,
        })}
      </UserNotification>
    </Modal>
  )
}

export default AssignmentConfirmationModal
