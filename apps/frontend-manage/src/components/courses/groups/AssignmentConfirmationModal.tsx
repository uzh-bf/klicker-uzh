import { Modal, toast, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
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
  const [assignmentPending, setAssignmentPending] = useState(false)
  const assigning = assignmentMutation.isLoading || assignmentPending

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
        if (!assigning) {
          onClose()
        }
      }}
      title={t('manage.course.finalizeRandomGroupAssignment')}
      primaryLabel={t('shared.generic.confirm')}
      primaryLoading={assigning}
      primaryDisabled={assigning}
      onPrimaryAction={async () => {
        if (assigning) {
          return
        }

        let releasePending = true
        setAssignmentPending(true)

        try {
          const res = await assignmentMutation.mutateAsync({ courseId })

          if (!res.participantGroups) {
            showErrorToast()
            return
          }

          try {
            await Promise.all([
              utils.course.groups.invalidate({ courseId }),
              utils.course.summary.invalidate({ courseId }),
            ])
          } catch (error) {
            console.error(
              'Error refreshing random group assignment state',
              error
            )
            toast({
              type: 'error',
              message: t('shared.generic.systemError'),
              options: { duration: 5000 },
            })
            return
          }

          onAssigned()
          toast({
            type: 'success',
            message: t('manage.course.groupAssignmentSuccessful'),
            options: { duration: 5000 },
          })
          releasePending = false
          onClose()
        } catch {
          showErrorToast()
        } finally {
          if (releasePending) {
            setAssignmentPending(false)
          }
        }
      }}
      dataPrimaryAction={{ cy: 'confirm-random-group-assignment' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={() => {
        if (!assigning) {
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
