import { useTranslations } from 'next-intl'
import { useState } from 'react'
import ConfirmationItem from '../../../common/ConfirmationItem'
import ActivityConfirmationModal from '../../../courses/modals/ActivityConfirmationModal'

function ActivityBatchDeletionConfirmationModal({
  count,
  deleting,
  onClose,
  onDelete,
}: {
  count: number
  deleting: boolean
  onClose: () => void
  onDelete: () => Promise<void>
}) {
  const t = useTranslations()
  const [confirmed, setConfirmed] = useState(false)

  return (
    <ActivityConfirmationModal
      onClose={onClose}
      title={t('manage.activities.confirmBatchDeletionTitle')}
      message={t('manage.activities.confirmBatchDeletionMessage', {
        number: count,
      })}
      onSubmit={onDelete}
      submitting={deleting}
      confirmations={{ irreversibleDeletion: confirmed }}
      confirmationsInitializing={false}
      confirmationType="delete"
    >
      <ConfirmationItem
        confirmationType="delete"
        label={t('manage.activities.confirmBatchDeletionIrreversible', {
          number: count,
        })}
        onClick={() => setConfirmed(true)}
        confirmed={confirmed}
        notApplicable={false}
        data={{ cy: 'confirm-batch-activity-deletion' }}
      />
    </ActivityConfirmationModal>
  )
}

export default ActivityBatchDeletionConfirmationModal
