import { useTranslations } from 'next-intl'
import { useState } from 'react'
import ConfirmationItem from '../../../common/ConfirmationItem'
import ActivityConfirmationModal from '../../../courses/modals/ActivityConfirmationModal'
import type { ActivityBatchDeletionProgress } from './useActivityBatchDeletion'

function ActivityBatchDeletionConfirmationModal({
  count,
  progress,
  deleting,
  onClose,
  onDelete,
}: {
  count: number
  progress: ActivityBatchDeletionProgress
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
      primaryLabel={t('manage.activities.confirmBatchDeletionSubmit')}
      confirmations={{ irreversibleDeletion: confirmed }}
      confirmationsInitializing={false}
      confirmationType="delete"
    >
      <ConfirmationItem
        confirmationType="delete"
        label={t('manage.activities.confirmBatchDeletionIrreversible', {
          number: count,
        })}
        actionLabel={t('manage.activities.confirmBatchDeletionAcknowledge')}
        onClick={() => setConfirmed(true)}
        confirmed={confirmed}
        notApplicable={false}
        data={{ cy: 'confirm-batch-activity-deletion' }}
      />
      {deleting && (
        <div
          className="mt-3 text-sm text-gray-600"
          role="status"
          aria-live="polite"
        >
          {t('manage.activities.batchDeletionProgress', {
            completed: progress.completed,
            total: progress.total,
          })}
        </div>
      )}
    </ActivityConfirmationModal>
  )
}

export default ActivityBatchDeletionConfirmationModal
